(function () {
  "use strict";

  var Admin = window.AdminCommon;
  var state = {
    month: new Date().toISOString().slice(0, 7)
  };

  function renderSidebar() {
    var monthEl = Admin.qs("sidebar-report-month");
    if (monthEl) {
      monthEl.textContent = Admin.formatMonthLabel(state.month);
    }
  }

  function renderMonthly(monthly) {
    var grid = Admin.qs("monthly-kpis");
    if (!grid) return;
    var items = [
      { label: "Consultas confirmadas", value: monthly.confirmed_count || 0 },
      { label: "Consultas canceladas", value: monthly.cancelled_count || 0 },
      { label: "Cliques no Instagram", value: monthly.click_instagram || 0 },
      { label: "Cliques no Google", value: monthly.click_google_business || 0 },
      { label: "Base total de leads", value: monthly.total_leads || 0 }
    ];
    grid.innerHTML = items.map(function (item) {
      return '<article class="metric"><strong>' + Admin.escapeHtml(item.label) + '</strong><span>' + Admin.escapeHtml(item.value) + '</span></article>';
    }).join("");
  }

  function renderTotals(metrics) {
    var grid = Admin.qs("metrics-grid");
    if (!grid) return;
    var keys = Object.keys(metrics || {}).sort();
    if (!keys.length) {
      grid.innerHTML = '<p class="note">Sem métricas acumuladas.</p>';
      return;
    }
    grid.innerHTML = keys.map(function (key) {
      return '<article class="metric"><strong>' + Admin.escapeHtml(key) + '</strong><span>' + Admin.escapeHtml(metrics[key]) + '</span></article>';
    }).join("");
  }

  function loadPage() {
    return Admin.getDashboardData(state.month).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao carregar métricas.");
      }
      state.month = response.report_month || state.month;
      var monthInput = Admin.qs("report-month");
      if (monthInput) {
        monthInput.value = state.month;
      }
      renderSidebar();
      renderMonthly(response.monthly || {});
      renderTotals(response.metrics || {});
    }).catch(function (error) {
      Admin.note("metrics-feedback", error.message, "error");
    });
  }

  function onResetMetrics() {
    if (!window.confirm("Zerar todas as métricas do sistema?")) return;
    Admin.apiPost("/admin/reset_metrics.php", {}).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao zerar métricas.");
      }
      loadPage();
    }).catch(function (error) {
      Admin.note("metrics-feedback", error.message, "error");
    });
  }

  function init() {
    state.month = Admin.getQueryParam("month") || state.month;
    Admin.initProtectedPage("metrics", loadPage).then(loadPage);

    var applyBtn = Admin.qs("apply-report-month");
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        state.month = (Admin.qs("report-month").value || "").trim();
        loadPage();
      });
    }

    var resetBtn = Admin.qs("reset-metrics");
    if (resetBtn) {
      resetBtn.addEventListener("click", onResetMetrics);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
