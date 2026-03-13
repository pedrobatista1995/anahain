(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var apiBase = cfg.API_BASE || "api";

  function qs(id) {
    return document.getElementById(id);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function apiGet(path) {
    return fetch(apiBase + path, { credentials: "same-origin" }).then(function (response) {
      return response.json();
    });
  }

  function apiPost(path, data) {
    return fetch(apiBase + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {})
    }).then(function (response) {
      return response.json();
    });
  }

  function note(id, message, type) {
    var el = qs(id);
    if (!el) return;
    el.textContent = message || "";
    el.className = "note" + (type ? (" " + type) : "");
  }

  function setButtonBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = button.textContent;
      }
      button.disabled = true;
      if (busyLabel) {
        button.textContent = busyLabel;
      }
      return;
    }

    button.disabled = false;
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
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

  function formatDateKey(dateKey, options) {
    if (!dateKey) return "-";
    var date = new Date(dateKey + "T12:00:00");
    if (isNaN(date.getTime())) return dateKey;
    return date.toLocaleDateString("pt-BR", options || {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function formatMonthLabel(monthValue) {
    if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return "--/----";
    var label = formatDateKey(monthValue + "-01", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function toDateKey(iso) {
    return String(iso || "").slice(0, 10);
  }

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name) || "";
  }

  function redirectTo(url) {
    window.location.replace(url);
  }

  function markActiveNav(page) {
    qsa(".admin-nav-link").forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("data-page") === page);
    });
  }

  function bindLogout() {
    var btn = qs("logout-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      apiPost("/admin/logout.php", {}).finally(function () {
        redirectTo("admin.html");
      });
    });
  }

  function ensureAuth() {
    return apiGet("/admin/session.php").then(function (response) {
      if (!response.authenticated) {
        redirectTo("admin.html");
        throw new Error("unauthenticated");
      }
      return response;
    });
  }

  function initProtectedPage(page, refreshHandler) {
    markActiveNav(page);
    bindLogout();

    var refreshBtn = qs("refresh-page");
    if (refreshBtn && typeof refreshHandler === "function") {
      refreshBtn.addEventListener("click", refreshHandler);
    }

    return ensureAuth();
  }

  function getDashboardData(month) {
    var query = month ? ("?month=" + encodeURIComponent(month)) : "";
    return apiGet("/admin/dashboard.php" + query);
  }

  window.AdminCommon = {
    qs: qs,
    qsa: qsa,
    escapeHtml: escapeHtml,
    normalizeText: normalizeText,
    apiGet: apiGet,
    apiPost: apiPost,
    note: note,
    setButtonBusy: setButtonBusy,
    formatDateTime: formatDateTime,
    formatDateKey: formatDateKey,
    formatMonthLabel: formatMonthLabel,
    toDateKey: toDateKey,
    getQueryParam: getQueryParam,
    redirectTo: redirectTo,
    markActiveNav: markActiveNav,
    initProtectedPage: initProtectedPage,
    getDashboardData: getDashboardData
  };
})();
