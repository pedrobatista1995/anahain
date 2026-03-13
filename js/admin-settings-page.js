(function () {
  "use strict";

  var Admin = window.AdminCommon;

  function setValue(id, value) {
    var field = Admin.qs(id);
    if (!field) return;
    field.value = value == null ? "" : value;
  }

  function fillSettings(settings) {
    var rules = settings.rules || {};
    setValue("clinic-name", settings.clinic_name || "");
    setValue("doctor-name", settings.doctor_name || "");
    setValue("doctor-whatsapp", settings.doctor_whatsapp || "");
    setValue("doctor-email", settings.doctor_email || "");
    setValue("public-base-url", settings.public_base_url || "");
    setValue("slot-duration", rules.slot_duration_minutes || 60);
    setValue("min-notice", rules.min_notice_hours || 4);
    setValue("max-days", rules.max_days_ahead || 120);
  }

  function renderSidebar(settings) {
    var areaEl = Admin.qs("sidebar-report-month");
    var doctorEl = Admin.qs("sidebar-selected-day");
    if (areaEl) {
      areaEl.textContent = "Clínica";
    }
    if (doctorEl) {
      doctorEl.textContent = settings.doctor_name || "Médico";
    }
  }

  function loadPage() {
    return Admin.getDashboardData("").then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao carregar configurações.");
      }
      fillSettings(response.settings || {});
      renderSidebar(response.settings || {});
    }).catch(function (error) {
      Admin.note("settings-feedback", error.message, "error");
    });
  }

  function onSaveClinic(event) {
    event.preventDefault();
    var submit = event.submitter || event.target.querySelector('button[type="submit"]');
    var payload = {
      clinic_name: (Admin.qs("clinic-name").value || "").trim(),
      doctor_name: (Admin.qs("doctor-name").value || "").trim(),
      doctor_whatsapp: (Admin.qs("doctor-whatsapp").value || "").trim(),
      doctor_email: (Admin.qs("doctor-email").value || "").trim(),
      public_base_url: (Admin.qs("public-base-url").value || "").trim()
    };

    Admin.setButtonBusy(submit, true, "Salvando...");
    Admin.apiPost("/admin/save_settings.php", payload).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao salvar dados da clínica.");
      }
      Admin.note("settings-feedback", "Dados da clínica salvos com sucesso.", "ok");
      loadPage();
    }).catch(function (error) {
      Admin.note("settings-feedback", error.message, "error");
    }).finally(function () {
      Admin.setButtonBusy(submit, false);
    });
  }

  function onSaveRules(event) {
    event.preventDefault();
    var submit = event.submitter || event.target.querySelector('button[type="submit"]');
    var payload = {
      slot_duration_minutes: Number(Admin.qs("slot-duration").value || 60),
      min_notice_hours: Number(Admin.qs("min-notice").value || 4),
      max_days_ahead: Number(Admin.qs("max-days").value || 120),
      timezone: "America/Sao_Paulo"
    };

    Admin.setButtonBusy(submit, true, "Salvando...");
    Admin.apiPost("/admin/save_settings.php", payload).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao salvar regras da agenda.");
      }
      Admin.note("rules-feedback", "Regras da agenda salvas com sucesso.", "ok");
      loadPage();
    }).catch(function (error) {
      Admin.note("rules-feedback", error.message, "error");
    }).finally(function () {
      Admin.setButtonBusy(submit, false);
    });
  }

  function init() {
    Admin.initProtectedPage("settings", loadPage).then(loadPage);

    var settingsForm = Admin.qs("settings-form");
    if (settingsForm) {
      settingsForm.addEventListener("submit", onSaveClinic);
    }

    var rulesForm = Admin.qs("rules-form");
    if (rulesForm) {
      rulesForm.addEventListener("submit", onSaveRules);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
