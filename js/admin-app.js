(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var apiBase = cfg.API_BASE || "api";
  var currentReportMonth = "";
  var cancellationReasons = [];
  var weekdayDefs = [
    { dow: 1, label: "Seg" },
    { dow: 2, label: "Ter" },
    { dow: 3, label: "Qua" },
    { dow: 4, label: "Qui" },
    { dow: 5, label: "Sex" },
    { dow: 6, label: "Sáb" },
    { dow: 0, label: "Dom" }
  ];
  var state = {
    settings: {},
    rules: { timezone: "America/Sao_Paulo" },
    availability: [],
    recentBookings: [],
    monthlyBookings: [],
    calendarDays: [],
    dayBlocks: [],
    recordsByBookingId: {},
    selectedDate: "",
    selectedBookingId: 0,
    currentTab: "overview"
  };

  function qs(id) { return document.getElementById(id); }

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
    return fetch(apiBase + path, { credentials: "same-origin" }).then(function (r) { return r.json(); });
  }

  function apiPost(path, data) {
    return fetch(apiBase + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {})
    }).then(function (r) { return r.json(); });
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

  function setVisibility(auth) {
    qs("login-card").classList.toggle("hidden", auth);
    qs("admin-app").classList.toggle("hidden", !auth);
  }

  function setTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll(".erp-menu-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("hidden", panel.id !== ("tab-" + tab));
    });
  }

  function initTabs() {
    document.querySelectorAll(".erp-menu-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(btn.getAttribute("data-tab"));
      });
    });
    setTab("overview");
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDateKey(dateKey, options) {
    if (!dateKey) return "-";
    var d = new Date(dateKey + "T12:00:00");
    if (isNaN(d.getTime())) return dateKey;
    return d.toLocaleDateString("pt-BR", options || {
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

  function buildRecordMap(records) {
    var map = {};
    (records || []).forEach(function (record) {
      map[String(record.booking_id)] = record;
    });
    return map;
  }

  function findBookingById(bookingId) {
    var id = String(bookingId);
    return state.recentBookings.find(function (booking) {
      return String(booking.id) === id;
    }) || null;
  }

  function findCalendarDay(dateKey) {
    return state.calendarDays.find(function (day) {
      return day.date_key === dateKey;
    }) || null;
  }

  function getBookingsForDate(dateKey) {
    return state.monthlyBookings.filter(function (booking) {
      return toDateKey(booking.slot_start) === dateKey;
    });
  }

  function getRecordForBooking(bookingId) {
    return state.recordsByBookingId[String(bookingId)] || null;
  }

  function getStatusBadge(status) {
    if (status === "cancelled") {
      return '<span class="status-badge is-danger">Cancelada</span>';
    }
    return '<span class="status-badge is-ok">Confirmada</span>';
  }

  function setSelectedDate(dateKey) {
    state.selectedDate = dateKey || "";
    if (qs("block-date") && state.selectedDate) {
      qs("block-date").value = state.selectedDate;
    }
    renderSidebarStatus();
    renderCalendar();
    renderSelectedDay();
  }

  function openRecord(bookingId) {
    var booking = findBookingById(bookingId);
    if (!booking) return;
    state.selectedBookingId = Number(booking.id);
    setSelectedDate(toDateKey(booking.slot_start));
    setTab("records");
    renderRecordsList();
    renderRecordEditor();
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
    if (withBookings) {
      state.selectedDate = withBookings.date_key;
      return;
    }

    var today = new Date();
    var todayKey = today.toISOString().slice(0, 10);
    if (availableDates.indexOf(todayKey) !== -1) {
      state.selectedDate = todayKey;
      return;
    }

    state.selectedDate = availableDates[0];
  }

  function renderSidebarStatus() {
    if (qs("sidebar-report-month")) {
      qs("sidebar-report-month").textContent = formatMonthLabel(currentReportMonth);
    }
    if (qs("sidebar-selected-day")) {
      qs("sidebar-selected-day").textContent = state.selectedDate
        ? formatDateKey(state.selectedDate, { day: "2-digit", month: "short" })
        : "Nenhum";
    }
  }

  function renderAvailability(availability) {
    var grid = qs("availability-grid");
    if (!grid) return;
    var html = [];
    for (var i = 0; i < weekdayDefs.length; i++) {
      var dow = weekdayDefs[i].dow;
      var item = (availability || []).find(function (row) {
        return Number(row.day_of_week) === dow;
      }) || {};
      html.push(
        '<div class="av-row">' +
          '<label><input type="checkbox" data-day="' + dow + '" class="av-enabled" ' + (item.is_enabled ? "checked" : "") + '> ' + weekdayDefs[i].label + "</label>" +
          '<input type="time" data-day="' + dow + '" class="av-start" value="' + escapeHtml(item.start_time || "") + '">' +
          '<input type="time" data-day="' + dow + '" class="av-end" value="' + escapeHtml(item.end_time || "") + '">' +
          '<span>' + (item.is_enabled ? "Disponível" : "Indisponível") + "</span>" +
        "</div>"
      );
    }
    grid.innerHTML = html.join("");
  }

  function renderMetrics(metrics) {
    var grid = qs("metrics-grid");
    if (!grid) return;
    var keys = Object.keys(metrics || {}).sort();
    if (!keys.length) {
      grid.innerHTML = '<p class="note">Sem métricas acumuladas ainda.</p>';
      return;
    }
    grid.innerHTML = keys.map(function (key) {
      return '<article class="metric"><strong>' + escapeHtml(key) + "</strong><span>" + escapeHtml(metrics[key]) + "</span></article>";
    }).join("");
  }

  function renderMonthlyKpis(monthly) {
    var grid = qs("monthly-kpis");
    if (!grid) return;
    var items = [
      { label: "Consultas confirmadas", value: monthly.confirmed_count || 0 },
      { label: "Consultas canceladas", value: monthly.cancelled_count || 0 },
      { label: "Cliques no Instagram", value: monthly.click_instagram || 0 },
      { label: "Cliques no Google", value: monthly.click_google_business || 0 },
      { label: "Base total de leads", value: monthly.total_leads || 0 }
    ];
    grid.innerHTML = items.map(function (item) {
      return '<article class="metric"><strong>' + escapeHtml(item.label) + "</strong><span>" + escapeHtml(item.value) + "</span></article>";
    }).join("");
  }

  function renderCalendar() {
    var grid = qs("calendar-grid");
    if (!grid) return;
    if (!state.calendarDays.length) {
      grid.innerHTML = '<p class="note">Sem agenda disponível para o mês selecionado.</p>';
      return;
    }

    var blanks = (Number(state.calendarDays[0].weekday) + 6) % 7;
    var html = [];
    for (var i = 0; i < blanks; i++) {
      html.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
    }

    var todayKey = new Date().toISOString().slice(0, 10);
    state.calendarDays.forEach(function (day) {
      var classes = ["calendar-day"];
      if (day.date_key === state.selectedDate) classes.push("is-selected");
      if (day.date_key === todayKey) classes.push("is-today");
      if (day.is_blocked) classes.push("is-blocked");
      if (day.confirmed_count > 0) classes.push("has-bookings");
      var remainingLabel = day.is_blocked
        ? '<span class="calendar-pill is-blocked">Bloqueado</span>'
        : (day.capacity > 0
          ? '<span class="calendar-pill is-free">' + escapeHtml(day.remaining_count) + ' livres</span>'
          : '<span class="calendar-pill">Sem base</span>');
      html.push(
        '<button type="button" class="' + classes.join(" ") + '" data-date-key="' + day.date_key + '">' +
          '<span class="calendar-day-head">' +
            '<strong>' + escapeHtml(day.day_number) + '</strong>' +
            (day.confirmed_count > 0 ? '<span>' + escapeHtml(day.confirmed_count) + ' consultas</span>' : '<span>Sem consultas</span>') +
          '</span>' +
          '<span class="calendar-day-body">' +
            remainingLabel +
            (day.cancelled_count > 0 ? '<span class="calendar-pill is-danger">' + escapeHtml(day.cancelled_count) + ' cancel.</span>' : "") +
          '</span>' +
        '</button>'
      );
    });

    grid.innerHTML = html.join("");
  }

  function renderBookingCard(booking, compact) {
    var bookingId = Number(booking.id || 0);
    var safeName = escapeHtml(booking.patient_name || "-");
    var safeEmail = escapeHtml(booking.patient_email || "-");
    var safePhone = escapeHtml(booking.patient_phone || "-");
    var hasRecord = !!getRecordForBooking(bookingId);
    var reasonsOptions = cancellationReasons.map(function (reason) {
      return '<option value="' + escapeHtml(reason) + '">' + escapeHtml(reason) + "</option>";
    }).join("");

    var cancelBlock = "";
    if (booking.status === "cancelled") {
      cancelBlock = '<div class="booking-foot-note">' +
        '<small>Cancelada em: ' + escapeHtml(formatDateTime(booking.cancelled_at)) + '</small>' +
        '<small>Motivo: ' + escapeHtml(booking.cancellation_reason || "-") + '</small>' +
      "</div>";
    } else {
      cancelBlock = '<div class="cancel-actions">' +
        '<select class="cancel-reason-select" data-booking-id="' + bookingId + '">' + reasonsOptions + "</select>" +
        '<button type="button" class="cancel-booking-btn danger-btn" data-booking-id="' + bookingId + '">Cancelar consulta</button>' +
      "</div>";
    }

    return '<article class="booking-card' + (compact ? " is-compact" : "") + '">' +
      '<div class="booking-card-head">' +
        '<div>' +
          "<strong>" + safeName + "</strong>" +
          '<div class="booking-subline">' + safeEmail + " · " + safePhone + "</div>" +
        "</div>" +
        '<div class="booking-chip-row">' +
          getStatusBadge(booking.status) +
          (hasRecord ? '<span class="status-badge">Prontuário</span>' : "") +
        "</div>" +
      "</div>" +
      '<div class="booking-meta-grid">' +
        '<span><strong>Horário</strong><em>' + escapeHtml(formatDateTime(booking.slot_start)) + "</em></span>" +
        '<span><strong>Origem cancel.</strong><em>' + escapeHtml(booking.cancellation_source || "-") + "</em></span>" +
      "</div>" +
      cancelBlock +
      '<div class="booking-actions">' +
        '<button type="button" class="ghost-btn open-record-btn" data-booking-id="' + bookingId + '">Abrir prontuário</button>' +
      "</div>" +
    "</article>";
  }

  function renderSelectedDay() {
    var title = qs("selected-day-title");
    var summary = qs("selected-day-summary");
    var list = qs("selected-day-bookings");
    if (!title || !summary || !list) return;

    if (!state.selectedDate) {
      title.textContent = "Selecione um dia do calendário";
      summary.textContent = "Os atendimentos do dia selecionado aparecerão aqui.";
      list.innerHTML = "";
      return;
    }

    var day = findCalendarDay(state.selectedDate);
    var bookings = getBookingsForDate(state.selectedDate);
    var info = [];
    title.textContent = formatDateKey(state.selectedDate, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    if (day) {
      info.push(day.confirmed_count + " confirmadas");
      info.push(day.cancelled_count + " canceladas");
      if (day.is_blocked) {
        info.push("Dia bloqueado");
      } else if (day.capacity > 0) {
        info.push(day.remaining_count + " vagas restantes");
      }
    }
    summary.textContent = info.join(" · ");

    if (!bookings.length) {
      list.innerHTML = '<div class="empty-state">Nenhum atendimento para este dia.</div>';
      if (day && day.is_blocked && day.block_reason) {
        list.innerHTML += '<p class="note">Motivo do bloqueio: ' + escapeHtml(day.block_reason) + '</p>';
      }
      return;
    }

    list.innerHTML = bookings.map(function (booking) {
      return renderBookingCard(booking, true);
    }).join("");
  }

  function renderBookings(bookings) {
    var list = qs("bookings-list");
    if (!list) return;
    var rows = (bookings || []).slice(0, 50);
    if (!rows.length) {
      list.innerHTML = '<p class="note">Nenhuma consulta registrada ainda.</p>';
      return;
    }
    list.innerHTML = rows.map(function (booking) {
      return renderBookingCard(booking, false);
    }).join("");
  }

  function renderDayBlocks() {
    var list = qs("day-blocks-list");
    if (!list) return;
    if (!state.dayBlocks.length) {
      list.innerHTML = '<p class="note">Nenhum dia bloqueado no momento.</p>';
      return;
    }
    list.innerHTML = state.dayBlocks.map(function (block) {
      var bookingCount = state.recentBookings.filter(function (booking) {
        return toDateKey(booking.slot_start) === block.block_date && booking.status === "confirmed";
      }).length;
      return '<article class="day-block-item">' +
        '<div>' +
          '<strong>' + escapeHtml(formatDateKey(block.block_date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })) + "</strong>" +
          '<div class="booking-subline">' + escapeHtml(block.reason || "Sem motivo informado") + "</div>" +
          '<div class="booking-foot-note"><small>' + bookingCount + ' consulta(s) confirmada(s) neste dia</small></div>' +
        "</div>" +
        '<button type="button" class="ghost-btn delete-day-block-btn" data-block-date="' + escapeHtml(block.block_date) + '">Liberar dia</button>' +
      "</article>";
    }).join("");
  }

  function renderRecordsList() {
    var list = qs("records-booking-list");
    if (!list) return;
    var search = normalizeText(qs("records-search") ? qs("records-search").value : "");
    var filtered = state.recentBookings.filter(function (booking) {
      if (!search) return true;
      var haystack = normalizeText([
        booking.patient_name,
        booking.patient_email,
        booking.patient_phone,
        formatDateTime(booking.slot_start)
      ].join(" "));
      return haystack.indexOf(search) !== -1;
    }).slice(0, 120);

    if (!filtered.length) {
      list.innerHTML = '<p class="note">Nenhuma consulta encontrada para o filtro informado.</p>';
      return;
    }

    list.innerHTML = filtered.map(function (booking) {
      var isSelected = Number(booking.id) === Number(state.selectedBookingId);
      return '<button type="button" class="record-booking-item' + (isSelected ? ' is-selected' : '') + '" data-booking-id="' + escapeHtml(booking.id) + '">' +
        '<strong>' + escapeHtml(booking.patient_name || "-") + "</strong>" +
        '<span>' + escapeHtml(formatDateTime(booking.slot_start)) + "</span>" +
        '<span>' + escapeHtml(booking.status === "cancelled" ? "Consulta cancelada" : "Consulta confirmada") + "</span>" +
        (getRecordForBooking(booking.id) ? '<span class="status-badge">Prontuário salvo</span>' : "") +
      "</button>";
    }).join("");
  }

  function collectRecordForm() {
    return {
      chief_complaint: (qs("record-chief-complaint").value || "").trim(),
      clinical_history: (qs("record-clinical-history").value || "").trim(),
      examination_notes: (qs("record-examination-notes").value || "").trim(),
      diagnosis: (qs("record-diagnosis").value || "").trim(),
      conduct: (qs("record-conduct").value || "").trim(),
      prescription_text: (qs("record-prescription-text").value || "").trim(),
      follow_up: (qs("record-follow-up").value || "").trim(),
      private_notes: (qs("record-private-notes").value || "").trim()
    };
  }

  function renderRecordEditor() {
    var empty = qs("record-empty");
    var editor = qs("record-editor");
    if (!empty || !editor) return;

    var booking = findBookingById(state.selectedBookingId);
    if (!booking) {
      empty.classList.remove("hidden");
      editor.classList.add("hidden");
      return;
    }

    empty.classList.add("hidden");
    editor.classList.remove("hidden");

    var record = getRecordForBooking(booking.id) || {};
    qs("record-patient-name").textContent = booking.patient_name || "-";
    qs("record-patient-contact").textContent = [booking.patient_email || "-", booking.patient_phone || "-"].join(" · ");
    qs("record-booking-date").textContent = formatDateTime(booking.slot_start);
    qs("record-booking-status").textContent = booking.status === "cancelled" ? "Consulta cancelada" : "Consulta confirmada";

    qs("record-chief-complaint").value = record.chief_complaint || "";
    qs("record-clinical-history").value = record.clinical_history || "";
    qs("record-examination-notes").value = record.examination_notes || "";
    qs("record-diagnosis").value = record.diagnosis || "";
    qs("record-conduct").value = record.conduct || "";
    qs("record-prescription-text").value = record.prescription_text || "";
    qs("record-follow-up").value = record.follow_up || "";
    qs("record-private-notes").value = record.private_notes || "";
  }

  function fillSettings(settings) {
    qs("clinic-name").value = settings.clinic_name || "";
    qs("doctor-name").value = settings.doctor_name || "";
    qs("doctor-whatsapp").value = settings.doctor_whatsapp || "";
    qs("doctor-email").value = settings.doctor_email || "";
    qs("public-base-url").value = settings.public_base_url || "";
    qs("smtp-host").value = settings.smtp_host || "";
    qs("smtp-port").value = settings.smtp_port || 587;
    qs("smtp-username").value = settings.smtp_username || "";
    qs("smtp-password").value = settings.smtp_password || "";
    qs("smtp-encryption").value = settings.smtp_encryption || "tls";
    qs("smtp-from-email").value = settings.smtp_from_email || "";
    qs("smtp-from-name").value = settings.smtp_from_name || "Tricologia";
    qs("cancel-reasons").value = settings.cancellation_reasons || "";
    qs("slot-duration").value = settings.rules.slot_duration_minutes || 60;
    qs("min-notice").value = settings.rules.min_notice_hours || 4;
    qs("max-days").value = settings.rules.max_days_ahead || 120;

    cancellationReasons = String(settings.cancellation_reasons || "")
      .split("\n")
      .map(function (item) { return item.trim(); })
      .filter(function (item) { return item.length > 0; });
    if (!cancellationReasons.length) {
      cancellationReasons = ["Indisponibilidade da agenda."];
    }
  }

  function applyDashboardData(res) {
    currentReportMonth = res.report_month || currentReportMonth;
    state.settings = res.settings || {};
    state.rules = (res.settings && res.settings.rules) || {};
    state.availability = res.availability || [];
    state.recentBookings = res.bookings || [];
    state.monthlyBookings = res.monthly_bookings || [];
    state.calendarDays = res.calendar_days || [];
    state.dayBlocks = res.day_blocks || [];
    state.recordsByBookingId = buildRecordMap(res.records || []);

    if (qs("report-month") && currentReportMonth) {
      qs("report-month").value = currentReportMonth;
    }

    fillSettings(state.settings);
    ensureSelection();
    renderSidebarStatus();
    renderAvailability(state.availability);
    renderMetrics(res.metrics || {});
    renderMonthlyKpis(res.monthly || {});
    renderCalendar();
    renderSelectedDay();
    renderBookings(state.recentBookings);
    renderDayBlocks();
    renderRecordsList();
    renderRecordEditor();
  }

  function loadDashboard() {
    var query = currentReportMonth ? ("?month=" + encodeURIComponent(currentReportMonth)) : "";
    return apiGet("/admin/dashboard.php" + query).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao carregar dashboard");
      applyDashboardData(res);
    }).catch(function (err) {
      note("settings-feedback", err.message, "error");
    });
  }

  function checkSession() {
    return apiGet("/admin/session.php").then(function (res) {
      setVisibility(!!res.authenticated);
      if (res.authenticated) {
        loadDashboard();
      }
    });
  }

  function onLogin(event) {
    event.preventDefault();
    var payload = {
      username: (qs("login-username").value || "").trim(),
      password: (qs("login-password").value || "").trim()
    };

    apiPost("/admin/login.php", payload).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha no login");
      note("login-feedback", "Login realizado com sucesso.", "ok");
      setVisibility(true);
      loadDashboard();
    }).catch(function (err) {
      note("login-feedback", err.message, "error");
    });
  }

  function onLogout() {
    apiPost("/admin/logout.php", {}).finally(function () {
      setVisibility(false);
      qs("login-form").reset();
    });
  }

  function onSaveSettings(event) {
    event.preventDefault();
    var payload = {
      clinic_name: (qs("clinic-name").value || "").trim(),
      doctor_name: (qs("doctor-name").value || "").trim(),
      doctor_whatsapp: (qs("doctor-whatsapp").value || "").trim(),
      doctor_email: (qs("doctor-email").value || "").trim(),
      public_base_url: (qs("public-base-url").value || "").trim(),
      smtp_host: (qs("smtp-host").value || "").trim(),
      smtp_port: Number(qs("smtp-port").value || 587),
      smtp_username: (qs("smtp-username").value || "").trim(),
      smtp_password: (qs("smtp-password").value || ""),
      smtp_encryption: (qs("smtp-encryption").value || "tls").trim(),
      smtp_from_email: (qs("smtp-from-email").value || "").trim(),
      smtp_from_name: (qs("smtp-from-name").value || "").trim(),
      cancellation_reasons: (qs("cancel-reasons").value || "").trim(),
      slot_duration_minutes: Number(qs("slot-duration").value || 60),
      min_notice_hours: Number(qs("min-notice").value || 4),
      max_days_ahead: Number(qs("max-days").value || 120),
      timezone: "America/Sao_Paulo"
    };

    apiPost("/admin/save_settings.php", payload).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao salvar regras");
      note("settings-feedback", "Regras salvas com sucesso.", "ok");
      return loadDashboard();
    }).catch(function (err) {
      note("settings-feedback", err.message, "error");
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

    apiPost("/admin/save_availability.php", { availability: availability }).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao salvar disponibilidade");
      note("availability-feedback", "Disponibilidade salva.", "ok");
      return loadDashboard();
    }).catch(function (err) {
      note("availability-feedback", err.message, "error");
    });
  }

  function onChangePassword(event) {
    event.preventDefault();
    var payload = {
      current_password: (qs("current-password").value || "").trim(),
      new_password: (qs("new-password").value || "").trim()
    };

    apiPost("/admin/change_password.php", payload).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao alterar senha");
      note("password-feedback", "Senha alterada com sucesso.", "ok");
      qs("password-form").reset();
    }).catch(function (err) {
      note("password-feedback", err.message, "error");
    });
  }

  function onResetMetrics() {
    if (!confirm("Zerar todas as métricas do painel?")) return;
    apiPost("/admin/reset_metrics.php", {}).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao zerar métricas");
      return loadDashboard();
    }).catch(function (err) {
      alert(err.message);
    });
  }

  function onCancelBookingClick(event) {
    var btn = event.target.closest(".cancel-booking-btn");
    if (!btn) return;
    var bookingId = Number(btn.getAttribute("data-booking-id") || 0);
    if (!bookingId) return;
    var reasonSelect = document.querySelector('.cancel-reason-select[data-booking-id="' + bookingId + '"]');
    var reason = reasonSelect ? String(reasonSelect.value || "").trim() : "";
    if (!reason) reason = "Indisponibilidade da agenda.";

    setButtonBusy(btn, true, "Cancelando...");
    apiPost("/admin/cancel_booking.php", { booking_id: bookingId, reason: reason }).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao cancelar consulta");
      return loadDashboard();
    }).catch(function (err) {
      alert(err.message);
      setButtonBusy(btn, false);
    });
  }

  function onSaveDayBlock(event) {
    event.preventDefault();
    var submit = event.submitter || qs("save-day-block");
    var payload = {
      block_date: (qs("block-date").value || "").trim(),
      reason: (qs("block-reason").value || "").trim(),
      cancel_existing: !!qs("block-cancel-existing").checked
    };

    setButtonBusy(submit, true, "Bloqueando...");
    apiPost("/admin/save_day_block.php", payload).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao bloquear o dia");
      note("day-block-feedback", res.message || "Dia bloqueado com sucesso.", "ok");
      qs("block-cancel-existing").checked = false;
      return loadDashboard();
    }).catch(function (err) {
      note("day-block-feedback", err.message, "error");
    }).finally(function () {
      setButtonBusy(submit, false);
    });
  }

  function onDeleteDayBlock(dateKey) {
    if (!dateKey) return;
    if (!confirm("Liberar este dia para novos agendamentos?")) return;
    apiPost("/admin/delete_day_block.php", { block_date: dateKey }).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao liberar o dia");
      note("day-block-feedback", res.message || "Dia liberado.", "ok");
      return loadDashboard();
    }).catch(function (err) {
      note("day-block-feedback", err.message, "error");
    });
  }

  function onSaveRecord(event) {
    event.preventDefault();
    if (!state.selectedBookingId) {
      note("record-feedback", "Selecione uma consulta antes de salvar o prontuário.", "error");
      return;
    }

    var submit = event.submitter || event.target.querySelector('button[type="submit"]');
    var payload = collectRecordForm();
    payload.booking_id = state.selectedBookingId;

    setButtonBusy(submit, true, "Salvando...");
    apiPost("/admin/save_record.php", payload).then(function (res) {
      if (!res.ok) throw new Error(res.message || "Falha ao salvar prontuário");
      state.recordsByBookingId[String(state.selectedBookingId)] = res.record || payload;
      note("record-feedback", res.message || "Prontuário salvo com sucesso.", "ok");
      renderSelectedDay();
      renderBookings(state.recentBookings);
      renderRecordsList();
    }).catch(function (err) {
      note("record-feedback", err.message, "error");
    }).finally(function () {
      setButtonBusy(submit, false);
    });
  }

  function buildPrescriptionDocument(booking, record) {
    var clinicName = escapeHtml(state.settings.clinic_name || "Clínica");
    var doctorName = escapeHtml(state.settings.doctor_name || "Médico");
    var patientName = escapeHtml(booking.patient_name || "-");
    var appointmentDate = escapeHtml(formatDateTime(booking.slot_start));
    var prescription = escapeHtml(record.prescription_text || "").replace(/\n/g, "<br>");
    var conduct = escapeHtml(record.conduct || "").replace(/\n/g, "<br>");
    var followUp = escapeHtml(record.follow_up || "").replace(/\n/g, "<br>");

    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Receita médica</title>' +
      '<style>' +
        'body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:40px;color:#22303a;background:#fff;}' +
        '.sheet{max-width:820px;margin:0 auto;}' +
        '.top{display:flex;justify-content:space-between;gap:24px;margin-bottom:32px;border-bottom:2px solid #d9e1e7;padding-bottom:20px;}' +
        '.brand h1{margin:0 0 6px;font-size:28px;} .brand p{margin:0;color:#58707f;}' +
        '.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:28px;}' +
        '.box{border:1px solid #d9e1e7;border-radius:14px;padding:18px 20px;margin-bottom:18px;}' +
        '.box h2{margin:0 0 12px;font-size:18px;color:#1b4d63;}' +
        '.prescription{font-size:16px;line-height:1.7;white-space:normal;}' +
        '.signature{margin-top:60px;padding-top:20px;border-top:1px solid #cfd8dd;max-width:320px;}' +
        '@media print{body{padding:0}.sheet{max-width:none;margin:0;padding:24px}}' +
      '</style></head><body><div class="sheet">' +
        '<div class="top">' +
          '<div class="brand"><h1>' + clinicName + '</h1><p>' + doctorName + '</p></div>' +
          '<div><strong>Receita / prescrição</strong><br><span>' + appointmentDate + '</span></div>' +
        '</div>' +
        '<div class="meta">' +
          '<div class="box"><h2>Paciente</h2><div>' + patientName + '</div></div>' +
          '<div class="box"><h2>Consulta</h2><div>' + appointmentDate + '</div></div>' +
        '</div>' +
        '<div class="box"><h2>Prescrição</h2><div class="prescription">' + prescription + '</div></div>' +
        (conduct ? '<div class="box"><h2>Conduta complementar</h2><div class="prescription">' + conduct + '</div></div>' : '') +
        (followUp ? '<div class="box"><h2>Orientação de retorno</h2><div class="prescription">' + followUp + '</div></div>' : '') +
        '<div class="signature"><strong>' + doctorName + '</strong><br><span>Assinatura médica</span></div>' +
      '</div></body></html>';
  }

  function onPrintPrescription() {
    var booking = findBookingById(state.selectedBookingId);
    var record = collectRecordForm();
    if (!booking) {
      note("record-feedback", "Selecione uma consulta antes de imprimir.", "error");
      return;
    }
    if (!record.prescription_text) {
      note("record-feedback", "Preencha a receita antes de imprimir.", "error");
      return;
    }

    var popup = window.open("", "_blank", "width=960,height=1080");
    if (!popup) {
      note("record-feedback", "O navegador bloqueou a janela de impressão.", "error");
      return;
    }

    popup.document.open();
    popup.document.write(buildPrescriptionDocument(booking, record));
    popup.document.close();
    setTimeout(function () {
      popup.focus();
      popup.print();
    }, 250);
  }

  function onDocumentClick(event) {
    var calendarBtn = event.target.closest(".calendar-day[data-date-key]");
    if (calendarBtn) {
      setSelectedDate(calendarBtn.getAttribute("data-date-key"));
      return;
    }

    var openRecordBtn = event.target.closest(".open-record-btn, .record-booking-item");
    if (openRecordBtn) {
      openRecord(Number(openRecordBtn.getAttribute("data-booking-id") || 0));
      return;
    }

    var blockDeleteBtn = event.target.closest(".delete-day-block-btn");
    if (blockDeleteBtn) {
      onDeleteDayBlock(blockDeleteBtn.getAttribute("data-block-date"));
      return;
    }

    onCancelBookingClick(event);
  }

  function init() {
    qs("login-form").addEventListener("submit", onLogin);
    qs("logout-btn").addEventListener("click", onLogout);
    qs("settings-form").addEventListener("submit", onSaveSettings);
    qs("availability-form").addEventListener("submit", onSaveAvailability);
    qs("day-block-form").addEventListener("submit", onSaveDayBlock);
    qs("password-form").addEventListener("submit", onChangePassword);
    qs("record-form").addEventListener("submit", onSaveRecord);
    qs("print-prescription-btn").addEventListener("click", onPrintPrescription);
    qs("refresh-dashboard").addEventListener("click", loadDashboard);
    qs("apply-report-month").addEventListener("click", function () {
      currentReportMonth = (qs("report-month").value || "").trim();
      loadDashboard();
    });
    qs("reset-metrics").addEventListener("click", onResetMetrics);
    qs("jump-to-blocks").addEventListener("click", function () {
      setTab("availability");
      if (state.selectedDate) {
        qs("block-date").value = state.selectedDate;
      }
    });
    qs("records-search").addEventListener("input", renderRecordsList);
    document.addEventListener("click", onDocumentClick);
    initTabs();
    checkSession();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
