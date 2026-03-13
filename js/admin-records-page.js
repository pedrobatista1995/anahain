(function () {
  "use strict";

  var Admin = window.AdminCommon;
  var state = {
    month: new Date().toISOString().slice(0, 7),
    bookings: [],
    recordsByBookingId: {},
    selectedBookingId: 0,
    settings: {}
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

  function findBookingById(bookingId) {
    return state.bookings.find(function (booking) {
      return Number(booking.id) === Number(bookingId);
    }) || null;
  }

  function collectRecordForm() {
    return {
      chief_complaint: (Admin.qs("record-chief-complaint").value || "").trim(),
      clinical_history: (Admin.qs("record-clinical-history").value || "").trim(),
      examination_notes: (Admin.qs("record-examination-notes").value || "").trim(),
      diagnosis: (Admin.qs("record-diagnosis").value || "").trim(),
      conduct: (Admin.qs("record-conduct").value || "").trim(),
      prescription_text: (Admin.qs("record-prescription-text").value || "").trim(),
      follow_up: (Admin.qs("record-follow-up").value || "").trim(),
      private_notes: (Admin.qs("record-private-notes").value || "").trim()
    };
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
    var bookingEl = Admin.qs("sidebar-selected-day");
    if (monthEl) {
      monthEl.textContent = Admin.formatMonthLabel(state.month);
    }
    if (bookingEl) {
      var booking = findBookingById(state.selectedBookingId);
      bookingEl.textContent = booking ? booking.patient_name : "Nenhum";
    }
  }

  function renderBookingList() {
    var list = Admin.qs("records-booking-list");
    if (!list) return;

    var search = Admin.normalizeText(Admin.qs("records-search") ? Admin.qs("records-search").value : "");
    var rows = state.bookings.filter(function (booking) {
      if (!search) return true;
      var haystack = Admin.normalizeText([
        booking.patient_name,
        booking.patient_email,
        booking.patient_phone,
        Admin.formatDateTime(booking.slot_start)
      ].join(" "));
      return haystack.indexOf(search) !== -1;
    });

    if (!rows.length) {
      list.innerHTML = '<p class="note">Nenhuma consulta encontrada neste mês.</p>';
      return;
    }

    list.innerHTML = rows.map(function (booking) {
      var selected = Number(booking.id) === Number(state.selectedBookingId);
      return '<button type="button" class="record-booking-item' + (selected ? ' is-selected' : '') + '" data-booking-id="' + Admin.escapeHtml(booking.id) + '">' +
        '<strong>' + Admin.escapeHtml(booking.patient_name || "-") + '</strong>' +
        '<span>' + Admin.escapeHtml(Admin.formatDateTime(booking.slot_start)) + '</span>' +
        '<span>' + Admin.escapeHtml(booking.status === "cancelled" ? "Consulta cancelada" : "Consulta confirmada") + '</span>' +
        (getRecordForBooking(booking.id) ? '<span class="status-badge">Prontuário salvo</span>' : "") +
      '</button>';
    }).join("");
  }

  function renderEditor() {
    var empty = Admin.qs("record-empty");
    var editor = Admin.qs("record-editor");
    if (!empty || !editor) return;

    var booking = findBookingById(state.selectedBookingId);
    if (!booking) {
      empty.classList.remove("hidden");
      editor.classList.add("hidden");
      renderSidebar();
      return;
    }

    empty.classList.add("hidden");
    editor.classList.remove("hidden");

    var record = getRecordForBooking(booking.id) || {};
    Admin.qs("record-patient-name").textContent = booking.patient_name || "-";
    Admin.qs("record-patient-contact").textContent = [booking.patient_email || "-", booking.patient_phone || "-"].join(" · ");
    Admin.qs("record-booking-date").textContent = Admin.formatDateTime(booking.slot_start);
    Admin.qs("record-booking-status").textContent = booking.status === "cancelled" ? "Consulta cancelada" : "Consulta confirmada";

    Admin.qs("record-chief-complaint").value = record.chief_complaint || "";
    Admin.qs("record-clinical-history").value = record.clinical_history || "";
    Admin.qs("record-examination-notes").value = record.examination_notes || "";
    Admin.qs("record-diagnosis").value = record.diagnosis || "";
    Admin.qs("record-conduct").value = record.conduct || "";
    Admin.qs("record-prescription-text").value = record.prescription_text || "";
    Admin.qs("record-follow-up").value = record.follow_up || "";
    Admin.qs("record-private-notes").value = record.private_notes || "";
    renderSidebar();
  }

  function loadPage() {
    return Admin.getDashboardData(state.month).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao carregar prontuários.");
      }
      state.month = response.report_month || state.month;
      state.settings = response.settings || {};
      state.bookings = response.monthly_bookings || [];
      state.recordsByBookingId = buildRecordMap(response.records || []);

      var monthInput = Admin.qs("report-month");
      if (monthInput) {
        monthInput.value = state.month;
      }

      ensureSelection();
      renderSidebar();
      renderBookingList();
      renderEditor();
    }).catch(function (error) {
      Admin.note("record-feedback", error.message, "error");
    });
  }

  function onSaveRecord(event) {
    event.preventDefault();
    if (!state.selectedBookingId) {
      Admin.note("record-feedback", "Selecione uma consulta antes de salvar.", "error");
      return;
    }

    var submit = event.submitter || event.target.querySelector('button[type="submit"]');
    var payload = collectRecordForm();
    payload.booking_id = state.selectedBookingId;

    Admin.setButtonBusy(submit, true, "Salvando...");
    Admin.apiPost("/admin/save_record.php", payload).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao salvar prontuário.");
      }
      state.recordsByBookingId[String(state.selectedBookingId)] = response.record || payload;
      Admin.note("record-feedback", response.message || "Prontuário salvo com sucesso.", "ok");
      renderBookingList();
    }).catch(function (error) {
      Admin.note("record-feedback", error.message, "error");
    }).finally(function () {
      Admin.setButtonBusy(submit, false);
    });
  }

  function buildPrescriptionDocument(booking, record) {
    var clinicName = Admin.escapeHtml(state.settings.clinic_name || "Clínica");
    var doctorName = Admin.escapeHtml(state.settings.doctor_name || "Médico");
    var patientName = Admin.escapeHtml(booking.patient_name || "-");
    var appointmentDate = Admin.escapeHtml(Admin.formatDateTime(booking.slot_start));
    var prescription = Admin.escapeHtml(record.prescription_text || "").replace(/\n/g, "<br>");
    var conduct = Admin.escapeHtml(record.conduct || "").replace(/\n/g, "<br>");
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Receita médica</title>' +
      '<style>body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:40px;color:#1f2f38}.sheet{max-width:820px;margin:0 auto}.head{display:flex;justify-content:space-between;gap:20px;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #d9e4e8}.box{border:1px solid #d9e4e8;border-radius:14px;padding:18px 20px;margin-bottom:18px}.box h2{margin:0 0 12px;font-size:18px;color:#1b6f7d}.signature{margin-top:56px;padding-top:18px;border-top:1px solid #d9e4e8;max-width:320px}</style></head><body><div class="sheet">' +
        '<div class="head"><div><h1>' + clinicName + '</h1><p>' + doctorName + '</p></div><div>' + appointmentDate + '</div></div>' +
        '<div class="box"><h2>Paciente</h2><div>' + patientName + '</div></div>' +
        '<div class="box"><h2>Prescrição</h2><div>' + prescription + '</div></div>' +
        (conduct ? '<div class="box"><h2>Conduta complementar</h2><div>' + conduct + '</div></div>' : "") +
        '<div class="signature"><strong>' + doctorName + '</strong><br><span>Assinatura médica</span></div>' +
      '</div></body></html>';
  }

  function onPrintPrescription() {
    var booking = findBookingById(state.selectedBookingId);
    var record = collectRecordForm();
    if (!booking) {
      Admin.note("record-feedback", "Selecione uma consulta antes de imprimir.", "error");
      return;
    }
    if (!record.prescription_text) {
      Admin.note("record-feedback", "Preencha a receita antes de imprimir.", "error");
      return;
    }

    var popup = window.open("", "_blank", "width=960,height=1080");
    if (!popup) {
      Admin.note("record-feedback", "O navegador bloqueou a janela de impressão.", "error");
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

  function init() {
    state.month = Admin.getQueryParam("month") || state.month;
    Admin.initProtectedPage("records", loadPage).then(loadPage);

    var search = Admin.qs("records-search");
    if (search) {
      search.addEventListener("input", renderBookingList);
    }

    var form = Admin.qs("record-form");
    if (form) {
      form.addEventListener("submit", onSaveRecord);
    }

    var printBtn = Admin.qs("print-prescription-btn");
    if (printBtn) {
      printBtn.addEventListener("click", onPrintPrescription);
    }

    var applyBtn = Admin.qs("apply-report-month");
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        state.month = (Admin.qs("report-month").value || "").trim();
        loadPage();
      });
    }

    document.addEventListener("click", function (event) {
      var btn = event.target.closest(".record-booking-item");
      if (!btn) return;
      state.selectedBookingId = Number(btn.getAttribute("data-booking-id") || 0);
      renderBookingList();
      renderEditor();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
