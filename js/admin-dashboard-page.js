(function () {
  "use strict";

  var Admin = window.AdminCommon;
  var state = {
    month: "",
    selectedDate: "",
    calendarDays: [],
    monthlyBookings: [],
    recordsByBookingId: {}
  };

  function buildRecordMap(records) {
    var map = {};
    (records || []).forEach(function (record) {
      map[String(record.booking_id)] = record;
    });
    return map;
  }

  function getRecordForBooking(bookingId) {
    return state.recordsByBookingId[String(bookingId)] || null;
  }

  function getBookingsForDate(dateKey) {
    return state.monthlyBookings.filter(function (booking) {
      return Admin.toDateKey(booking.slot_start) === dateKey;
    });
  }

  function findCalendarDay(dateKey) {
    return state.calendarDays.find(function (day) {
      return day.date_key === dateKey;
    }) || null;
  }

  function ensureSelection() {
    var availableDates = state.calendarDays.map(function (day) { return day.date_key; });
    if (!availableDates.length) {
      state.selectedDate = "";
      return;
    }

    if (availableDates.indexOf(state.selectedDate) !== -1) {
      return;
    }

    var withBookings = state.calendarDays.find(function (day) {
      return day.bookings_count > 0;
    });
    state.selectedDate = withBookings ? withBookings.date_key : availableDates[0];
  }

  function renderSidebar() {
    var monthEl = Admin.qs("sidebar-report-month");
    var dayEl = Admin.qs("sidebar-selected-day");
    if (monthEl) {
      monthEl.textContent = Admin.formatMonthLabel(state.month);
    }
    if (dayEl) {
      dayEl.textContent = state.selectedDate
        ? Admin.formatDateKey(state.selectedDate, { day: "2-digit", month: "short" })
        : "Nenhum";
    }
  }

  function renderCalendar() {
    var grid = Admin.qs("calendar-grid");
    if (!grid) return;

    if (!state.calendarDays.length) {
      grid.innerHTML = '<p class="note">Sem agenda disponível para o mês selecionado.</p>';
      return;
    }

    var blanks = (Number(state.calendarDays[0].weekday) + 6) % 7;
    var todayKey = new Date().toISOString().slice(0, 10);
    var html = [];
    for (var i = 0; i < blanks; i++) {
      html.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
    }

    state.calendarDays.forEach(function (day) {
      var classes = ["calendar-day"];
      if (day.date_key === state.selectedDate) classes.push("is-selected");
      if (day.date_key === todayKey) classes.push("is-today");
      if (day.is_blocked) classes.push("is-blocked");

      var pills = [];
      if (day.is_blocked) {
        pills.push('<span class="calendar-pill is-blocked">Bloqueado</span>');
      } else if (day.capacity > 0) {
        pills.push('<span class="calendar-pill is-free">' + Admin.escapeHtml(day.remaining_count) + ' vagas</span>');
      } else {
        pills.push('<span class="calendar-pill">Sem base</span>');
      }

      if (day.confirmed_count > 0) {
        pills.push('<span class="calendar-pill is-primary">' + Admin.escapeHtml(day.confirmed_count) + ' confirm.</span>');
      }

      html.push(
        '<button type="button" class="' + classes.join(" ") + '" data-date-key="' + day.date_key + '">' +
          '<span class="calendar-day-head">' +
            '<strong>' + Admin.escapeHtml(day.day_number) + '</strong>' +
            '<span>' + (day.bookings_count > 0 ? Admin.escapeHtml(day.bookings_count) + ' atend.' : 'Sem atendimentos') + '</span>' +
          '</span>' +
          '<span class="calendar-day-body">' + pills.join("") + "</span>" +
        "</button>"
      );
    });

    grid.innerHTML = html.join("");
  }

  function renderSelectedDay() {
    var title = Admin.qs("selected-day-title");
    var summary = Admin.qs("selected-day-summary");
    var list = Admin.qs("selected-day-bookings");
    if (!title || !summary || !list) return;

    if (!state.selectedDate) {
      title.textContent = "Selecione um dia do calendário";
      summary.textContent = "Os atendimentos do dia selecionado aparecerão aqui.";
      list.innerHTML = "";
      return;
    }

    var day = findCalendarDay(state.selectedDate);
    var bookings = getBookingsForDate(state.selectedDate);
    title.textContent = Admin.formatDateKey(state.selectedDate, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });

    if (day) {
      var parts = [];
      if (day.confirmed_count) parts.push(day.confirmed_count + " confirmadas");
      if (day.cancelled_count) parts.push(day.cancelled_count + " canceladas");
      if (day.is_blocked) parts.push("Dia bloqueado");
      else if (day.capacity > 0) parts.push(day.remaining_count + " vagas restantes");
      summary.textContent = parts.join(" · ") || "Dia sem movimentação.";
    }

    if (!bookings.length) {
      list.innerHTML = '<div class="empty-state">Nenhum atendimento para este dia.</div>';
      return;
    }

    list.innerHTML = bookings.map(function (booking) {
      var hasRecord = !!getRecordForBooking(booking.id);
      var statusClass = booking.status === "cancelled" ? "is-danger" : "is-ok";
      var statusLabel = booking.status === "cancelled" ? "Cancelada" : "Confirmada";
      return '<article class="booking-card">' +
        '<div class="booking-card-head">' +
          '<div>' +
            '<strong>' + Admin.escapeHtml(booking.patient_name || "-") + '</strong>' +
            '<div class="booking-subline">' + Admin.escapeHtml(booking.patient_email || "-") + " · " + Admin.escapeHtml(booking.patient_phone || "-") + '</div>' +
          '</div>' +
          '<div class="booking-chip-row">' +
            '<span class="status-badge ' + statusClass + '">' + statusLabel + '</span>' +
            (hasRecord ? '<span class="status-badge">Prontuário</span>' : "") +
          '</div>' +
        '</div>' +
        '<div class="booking-meta-grid">' +
          '<span><strong>Horário</strong><em>' + Admin.escapeHtml(Admin.formatDateTime(booking.slot_start)) + '</em></span>' +
          '<span><strong>Ação</strong><em><a class="text-link" href="admin-prontuarios.html?booking=' + Admin.escapeHtml(booking.id) + '&month=' + encodeURIComponent(state.month) + '">Abrir prontuário</a></em></span>' +
        '</div>' +
      '</article>';
    }).join("");
  }

  function selectDate(dateKey) {
    state.selectedDate = dateKey;
    renderSidebar();
    renderCalendar();
    renderSelectedDay();
  }

  function loadPage() {
    return Admin.getDashboardData(state.month).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao carregar agenda.");
      }
      state.month = response.report_month || state.month;
      state.calendarDays = response.calendar_days || [];
      state.monthlyBookings = response.monthly_bookings || [];
      state.recordsByBookingId = buildRecordMap(response.records || []);
      var monthInput = Admin.qs("report-month");
      if (monthInput && state.month) {
        monthInput.value = state.month;
      }
      ensureSelection();
      renderSidebar();
      renderCalendar();
      renderSelectedDay();
    }).catch(function (error) {
      Admin.note("page-feedback", error.message, "error");
    });
  }

  function init() {
    state.month = Admin.getQueryParam("month") || new Date().toISOString().slice(0, 7);
    Admin.initProtectedPage("dashboard", loadPage).then(loadPage);

    var applyBtn = Admin.qs("apply-report-month");
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        state.month = (Admin.qs("report-month").value || "").trim();
        loadPage();
      });
    }

    document.addEventListener("click", function (event) {
      var btn = event.target.closest(".calendar-day[data-date-key]");
      if (!btn) return;
      selectDate(btn.getAttribute("data-date-key"));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
