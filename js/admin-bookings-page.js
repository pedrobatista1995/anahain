(function () {
  "use strict";

  var Admin = window.AdminCommon;
  var state = {
    month: new Date().toISOString().slice(0, 7),
    bookings: [],
    settings: {},
    selectedBookingId: 0
  };

  function parseCancellationReasons() {
    var raw = String(state.settings.cancellation_reasons || "").split(/\r?\n/);
    var items = raw.map(function (line) { return line.trim(); }).filter(Boolean);
    if (!items.length) {
      items = [
        "Indisponibilidade da agenda.",
        "Ajuste interno da clínica.",
        "Reagendamento solicitado."
      ];
    }
    return items;
  }

  function findBookingById(bookingId) {
    return state.bookings.find(function (booking) {
      return Number(booking.id) === Number(bookingId);
    }) || null;
  }

  function formatCancellationSource(source) {
    var map = {
      doctor: "Clínica",
      doctor_block: "Bloqueio médico",
      patient: "Paciente",
      system: "Sistema"
    };
    return map[String(source || "")] || (source ? String(source) : "-");
  }

  function ensureSelection() {
    var requested = Number(Admin.getQueryParam("booking") || 0);
    if (requested && findBookingById(requested)) {
      state.selectedBookingId = requested;
      return;
    }
    if (findBookingById(state.selectedBookingId)) {
      return;
    }
    state.selectedBookingId = state.bookings.length ? Number(state.bookings[0].id) : 0;
  }

  function renderSidebar() {
    var monthEl = Admin.qs("sidebar-report-month");
    var selectedEl = Admin.qs("sidebar-selected-day");
    if (monthEl) {
      monthEl.textContent = Admin.formatMonthLabel(state.month);
    }
    if (selectedEl) {
      var booking = findBookingById(state.selectedBookingId);
      selectedEl.textContent = booking ? booking.patient_name : "Nenhuma";
    }
  }

  function renderReasonOptions(value) {
    var select = Admin.qs("booking-cancel-reason");
    if (!select) return;
    var reasons = parseCancellationReasons();
    select.innerHTML = reasons.map(function (reason) {
      var selected = reason === value ? " selected" : "";
      return '<option value="' + Admin.escapeHtml(reason) + '"' + selected + '>' + Admin.escapeHtml(reason) + '</option>';
    }).join("");
  }

  function renderList() {
    var list = Admin.qs("bookings-list");
    var summary = Admin.qs("bookings-list-summary");
    if (!list) return;

    var search = Admin.normalizeText(Admin.qs("bookings-search") ? Admin.qs("bookings-search").value : "");
    var status = (Admin.qs("bookings-status") ? Admin.qs("bookings-status").value : "all") || "all";
    var rows = state.bookings.filter(function (booking) {
      if (status !== "all" && booking.status !== status) return false;
      if (!search) return true;
      var haystack = Admin.normalizeText([
        booking.patient_name,
        booking.patient_email,
        booking.patient_phone,
        Admin.formatDateTime(booking.slot_start)
      ].join(" "));
      return haystack.indexOf(search) !== -1;
    });

    if (summary) {
      summary.textContent = rows.length + " consultas visíveis de " + state.bookings.length + " no mês.";
    }

    if (!rows.length) {
      list.innerHTML = '<p class="note">Nenhuma consulta encontrada para os filtros atuais.</p>';
      return;
    }

    list.innerHTML = rows.map(function (booking) {
      var selected = Number(booking.id) === Number(state.selectedBookingId);
      var statusBadge = booking.status === "cancelled"
        ? '<span class="status-badge is-danger">Cancelada</span>'
        : '<span class="status-badge is-ok">Confirmada</span>';
      return '<button type="button" class="record-booking-item' + (selected ? ' is-selected' : '') + '" data-booking-id="' + Admin.escapeHtml(booking.id) + '">' +
        '<strong>' + Admin.escapeHtml(booking.patient_name || "-") + '</strong>' +
        '<span>' + Admin.escapeHtml(Admin.formatDateTime(booking.slot_start)) + '</span>' +
        '<span>' + Admin.escapeHtml(booking.patient_phone || booking.patient_email || "-") + '</span>' +
        statusBadge +
      '</button>';
    }).join("");
  }

  function renderDetail() {
    var empty = Admin.qs("booking-empty");
    var detail = Admin.qs("booking-detail");
    if (!empty || !detail) return;

    var booking = findBookingById(state.selectedBookingId);
    if (!booking) {
      empty.classList.remove("hidden");
      detail.classList.add("hidden");
      renderSidebar();
      return;
    }

    empty.classList.add("hidden");
    detail.classList.remove("hidden");

    var badge = Admin.qs("booking-status-badge");
    var isCancelled = booking.status === "cancelled";
    Admin.qs("booking-patient-name").textContent = booking.patient_name || "-";
    Admin.qs("booking-patient-contact").textContent = [booking.patient_email || "-", booking.patient_phone || "-"].join(" · ");
    Admin.qs("booking-slot-date").textContent = Admin.formatDateTime(booking.slot_start);
    Admin.qs("booking-slot-range").textContent = Admin.formatDateTime(booking.slot_start);
    Admin.qs("booking-created-at").textContent = Admin.formatDateTime(booking.created_at);
    Admin.qs("booking-cancelled-at").textContent = booking.cancelled_at ? Admin.formatDateTime(booking.cancelled_at) : "-";
    Admin.qs("booking-cancel-source").textContent = formatCancellationSource(booking.cancellation_source);
    Admin.qs("booking-open-record").href = "admin-prontuarios.html?booking=" + encodeURIComponent(booking.id) + "&month=" + encodeURIComponent(state.month);

    if (badge) {
      badge.textContent = isCancelled ? "Cancelada" : "Confirmada";
      badge.className = "status-badge " + (isCancelled ? "is-danger" : "is-ok");
    }

    renderReasonOptions(booking.cancellation_reason || parseCancellationReasons()[0]);
    Admin.qs("booking-cancel-block").classList.toggle("hidden", isCancelled);
    Admin.qs("booking-cancel-help").textContent = isCancelled
      ? ("Motivo: " + (booking.cancellation_reason || "Não informado."))
      : "Selecione um motivo e confirme o cancelamento se o médico optar por remover esta consulta.";

    renderSidebar();
  }

  function loadPage() {
    return Admin.getDashboardData(state.month).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao carregar atendimentos.");
      }
      state.month = response.report_month || state.month;
      state.bookings = response.monthly_bookings || [];
      state.settings = response.settings || {};

      var monthInput = Admin.qs("report-month");
      if (monthInput) {
        monthInput.value = state.month;
      }

      ensureSelection();
      renderSidebar();
      renderList();
      renderDetail();
    }).catch(function (error) {
      Admin.note("bookings-feedback", error.message, "error");
    });
  }

  function onCancelBooking() {
    var booking = findBookingById(state.selectedBookingId);
    var button = Admin.qs("booking-cancel-btn");
    if (!booking || booking.status !== "confirmed" || !button) return;

    var reason = (Admin.qs("booking-cancel-reason").value || "").trim() || "Indisponibilidade da agenda.";
    if (!window.confirm("Cancelar esta consulta e notificar o paciente por e-mail?")) {
      return;
    }

    Admin.setButtonBusy(button, true, "Cancelando...");
    Admin.apiPost("/admin/cancel_booking.php", {
      booking_id: booking.id,
      reason: reason
    }).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao cancelar consulta.");
      }
      Admin.note("bookings-feedback", response.message || "Consulta cancelada com sucesso.", "ok");
      loadPage();
    }).catch(function (error) {
      Admin.note("bookings-feedback", error.message, "error");
    }).finally(function () {
      Admin.setButtonBusy(button, false);
    });
  }

  function init() {
    state.month = Admin.getQueryParam("month") || state.month;
    Admin.initProtectedPage("bookings", loadPage).then(loadPage);

    var applyBtn = Admin.qs("apply-report-month");
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        state.month = (Admin.qs("report-month").value || "").trim();
        loadPage();
      });
    }

    var search = Admin.qs("bookings-search");
    if (search) {
      search.addEventListener("input", renderList);
    }

    var status = Admin.qs("bookings-status");
    if (status) {
      status.addEventListener("change", renderList);
    }

    var cancelBtn = Admin.qs("booking-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", onCancelBooking);
    }

    document.addEventListener("click", function (event) {
      var item = event.target.closest(".record-booking-item");
      if (!item) return;
      state.selectedBookingId = Number(item.getAttribute("data-booking-id") || 0);
      renderList();
      renderDetail();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
