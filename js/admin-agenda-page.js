(function () {
  "use strict";

  var Admin = window.AdminCommon;
  var state = {
    month: "",
    dayBlocks: [],
    availability: []
  };

  var weekdayDefs = [
    { dow: 1, label: "Seg" },
    { dow: 2, label: "Ter" },
    { dow: 3, label: "Qua" },
    { dow: 4, label: "Qui" },
    { dow: 5, label: "Sex" },
    { dow: 6, label: "Sáb" },
    { dow: 0, label: "Dom" }
  ];

  function renderSidebar() {
    var monthEl = Admin.qs("sidebar-report-month");
    if (monthEl) {
      monthEl.textContent = Admin.formatMonthLabel(state.month);
    }
  }

  function renderAvailability(availability) {
    var grid = Admin.qs("availability-grid");
    if (!grid) return;
    grid.innerHTML = weekdayDefs.map(function (def) {
      var item = (availability || []).find(function (row) {
        return Number(row.day_of_week) === def.dow;
      }) || {};
      return '<div class="av-row">' +
        '<label><input type="checkbox" data-day="' + def.dow + '" class="av-enabled" ' + (item.is_enabled ? "checked" : "") + '> ' + def.label + "</label>" +
        '<input type="time" data-day="' + def.dow + '" class="av-start" value="' + Admin.escapeHtml(item.start_time || "") + '">' +
        '<input type="time" data-day="' + def.dow + '" class="av-end" value="' + Admin.escapeHtml(item.end_time || "") + '">' +
        '<span>' + (item.is_enabled ? "Disponível" : "Indisponível") + "</span>" +
      "</div>";
    }).join("");
  }

  function renderBlocks() {
    var list = Admin.qs("day-blocks-list");
    if (!list) return;
    if (!state.dayBlocks.length) {
      list.innerHTML = '<p class="note">Nenhum bloqueio ativo neste mês.</p>';
      return;
    }

    list.innerHTML = state.dayBlocks.map(function (block) {
      return '<article class="day-block-item">' +
        '<div>' +
          '<strong>' + Admin.escapeHtml(Admin.formatDateKey(block.block_date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })) + '</strong>' +
          '<div class="booking-subline">' + Admin.escapeHtml(block.reason || "Sem motivo informado") + '</div>' +
        '</div>' +
        '<button type="button" class="ghost-btn delete-day-block-btn" data-block-date="' + Admin.escapeHtml(block.block_date) + '">Liberar dia</button>' +
      '</article>';
    }).join("");
  }

  function loadPage() {
    return Admin.getDashboardData(state.month).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao carregar a agenda.");
      }
      state.month = response.report_month || state.month;
      state.availability = response.availability || [];
      state.dayBlocks = (response.day_blocks || []).filter(function (block) {
        return String(block.block_date || "").slice(0, 7) === state.month;
      });

      var monthInput = Admin.qs("report-month");
      if (monthInput && state.month) {
        monthInput.value = state.month;
      }

      renderSidebar();
      renderAvailability(state.availability);
      renderBlocks();
    }).catch(function (error) {
      Admin.note("day-block-feedback", error.message, "error");
    });
  }

  function onSaveAvailability(event) {
    event.preventDefault();
    var availability = [
      { day_of_week: 0, is_enabled: false, start_time: "", end_time: "" },
      { day_of_week: 1, is_enabled: false, start_time: "", end_time: "" },
      { day_of_week: 2, is_enabled: false, start_time: "", end_time: "" },
      { day_of_week: 3, is_enabled: false, start_time: "", end_time: "" },
      { day_of_week: 4, is_enabled: false, start_time: "", end_time: "" },
      { day_of_week: 5, is_enabled: false, start_time: "", end_time: "" },
      { day_of_week: 6, is_enabled: false, start_time: "", end_time: "" }
    ];

    weekdayDefs.forEach(function (def) {
      var enabled = document.querySelector('.av-enabled[data-day="' + def.dow + '"]');
      var start = document.querySelector('.av-start[data-day="' + def.dow + '"]');
      var end = document.querySelector('.av-end[data-day="' + def.dow + '"]');
      availability[def.dow] = {
        day_of_week: def.dow,
        is_enabled: !!(enabled && enabled.checked),
        start_time: start ? start.value : "",
        end_time: end ? end.value : ""
      };
    });

    Admin.apiPost("/admin/save_availability.php", { availability: availability }).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao salvar disponibilidade.");
      }
      Admin.note("availability-feedback", "Disponibilidade salva com sucesso.", "ok");
      loadPage();
    }).catch(function (error) {
      Admin.note("availability-feedback", error.message, "error");
    });
  }

  function onSaveBlock(event) {
    event.preventDefault();
    var submit = event.submitter || Admin.qs("save-day-block");
    var payload = {
      block_date: (Admin.qs("block-date").value || "").trim(),
      reason: (Admin.qs("block-reason").value || "").trim(),
      cancel_existing: !!Admin.qs("block-cancel-existing").checked
    };

    Admin.setButtonBusy(submit, true, "Bloqueando...");
    Admin.apiPost("/admin/save_day_block.php", payload).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao bloquear o dia.");
      }
      Admin.note("day-block-feedback", response.message || "Dia bloqueado com sucesso.", "ok");
      Admin.qs("block-cancel-existing").checked = false;
      loadPage();
    }).catch(function (error) {
      Admin.note("day-block-feedback", error.message, "error");
    }).finally(function () {
      Admin.setButtonBusy(submit, false);
    });
  }

  function onDeleteBlock(dateKey) {
    if (!dateKey) return;
    if (!window.confirm("Liberar este dia para novos agendamentos?")) return;

    Admin.apiPost("/admin/delete_day_block.php", { block_date: dateKey }).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao liberar o dia.");
      }
      Admin.note("day-block-feedback", response.message || "Dia liberado.", "ok");
      loadPage();
    }).catch(function (error) {
      Admin.note("day-block-feedback", error.message, "error");
    });
  }

  function init() {
    state.month = Admin.getQueryParam("month") || new Date().toISOString().slice(0, 7);
    Admin.initProtectedPage("agenda", loadPage).then(loadPage);

    var monthBtn = Admin.qs("apply-report-month");
    if (monthBtn) {
      monthBtn.addEventListener("click", function () {
        state.month = (Admin.qs("report-month").value || "").trim();
        loadPage();
      });
    }

    var availabilityForm = Admin.qs("availability-form");
    if (availabilityForm) {
      availabilityForm.addEventListener("submit", onSaveAvailability);
    }

    var blockForm = Admin.qs("day-block-form");
    if (blockForm) {
      blockForm.addEventListener("submit", onSaveBlock);
    }

    document.addEventListener("click", function (event) {
      var btn = event.target.closest(".delete-day-block-btn");
      if (!btn) return;
      onDeleteBlock(btn.getAttribute("data-block-date"));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
