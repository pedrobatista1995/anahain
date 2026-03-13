(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var apiBase = cfg.API_BASE || "api";
  var Admin = window.AdminCommon || null;

  function qs(id) { return document.getElementById(id); }

  function apiGet(path) {
    return fetch(apiBase + path, { credentials: "same-origin" }).then(function (response) {
      return response.json();
    });
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRows(rows) {
    var tbody = qs("leads-tbody");
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum lead encontrado.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (row) {
      return '<tr>' +
        '<td>' + escapeHtml(row.patient_name || "-") + '</td>' +
        '<td>' + escapeHtml(row.patient_email || "-") + '</td>' +
        '<td>' + escapeHtml(row.patient_phone || "-") + '</td>' +
        '<td>' + formatDateTime(row.first_seen) + '</td>' +
        '<td>' + formatDateTime(row.last_seen) + '</td>' +
        '<td>' + (row.confirmed_count || 0) + '</td>' +
        '<td>' + (row.cancelled_count || 0) + '</td>' +
      '</tr>';
    }).join("");
  }

  function loadLeads() {
    var query = (qs("leads-search").value || "").trim();
    var path = "/admin/leads.php" + (query ? ("?q=" + encodeURIComponent(query)) : "");
    apiGet(path).then(function (response) {
      if (!response.ok) throw new Error(response.message || "Falha ao carregar leads.");
      qs("leads-feedback").textContent = "Leads encontrados: " + (response.count || 0);
      renderRows(response.leads || []);
    }).catch(function (error) {
      qs("leads-feedback").textContent = error.message;
      renderRows([]);
    });
  }

  function exportCsv() {
    var query = (qs("leads-search").value || "").trim();
    var url = apiBase + "/admin/leads_export.php" + (query ? ("?q=" + encodeURIComponent(query)) : "");
    window.location.href = url;
  }

  function init() {
    qs("leads-search-btn").addEventListener("click", loadLeads);
    qs("leads-refresh-btn").addEventListener("click", loadLeads);
    qs("leads-export-btn").addEventListener("click", exportCsv);
    qs("leads-search").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loadLeads();
      }
    });

    if (Admin) {
      Admin.initProtectedPage("leads", loadLeads).then(loadLeads);
      return;
    }

    apiGet("/admin/session.php").then(function (response) {
      if (!response.authenticated) {
        window.location.href = "admin.html";
        return;
      }
      loadLeads();
    }).catch(function () {
      window.location.href = "admin.html";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
