(function () {
  "use strict";

  var Admin = window.AdminCommon;

  function setValue(id, value) {
    var field = Admin.qs(id);
    if (!field) return;
    field.value = value == null ? "" : value;
  }

  function fillSettings(settings) {
    setValue("smtp-host", settings.smtp_host || "");
    setValue("smtp-port", settings.smtp_port || 587);
    setValue("smtp-username", settings.smtp_username || "");
    setValue("smtp-password", settings.smtp_password || "");
    setValue("smtp-encryption", settings.smtp_encryption || "tls");
    setValue("smtp-from-email", settings.smtp_from_email || "");
    setValue("smtp-from-name", settings.smtp_from_name || "Tricologia");
    setValue("cancel-reasons", settings.cancellation_reasons || "");
  }

  function renderSidebar(settings) {
    var areaEl = Admin.qs("sidebar-report-month");
    var doctorEl = Admin.qs("sidebar-selected-day");
    if (areaEl) {
      areaEl.textContent = "Notificações";
    }
    if (doctorEl) {
      doctorEl.textContent = settings.doctor_name || "Médico";
    }
  }

  function loadPage() {
    return Admin.getDashboardData("").then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao carregar notificações.");
      }
      fillSettings(response.settings || {});
      renderSidebar(response.settings || {});
    }).catch(function (error) {
      Admin.note("notifications-feedback", error.message, "error");
    });
  }

  function onSaveNotifications(event) {
    event.preventDefault();
    var submit = event.submitter || event.target.querySelector('button[type="submit"]');
    var payload = {
      smtp_host: (Admin.qs("smtp-host").value || "").trim(),
      smtp_port: Number(Admin.qs("smtp-port").value || 587),
      smtp_username: (Admin.qs("smtp-username").value || "").trim(),
      smtp_password: (Admin.qs("smtp-password").value || ""),
      smtp_encryption: (Admin.qs("smtp-encryption").value || "tls").trim(),
      smtp_from_email: (Admin.qs("smtp-from-email").value || "").trim(),
      smtp_from_name: (Admin.qs("smtp-from-name").value || "").trim(),
      cancellation_reasons: (Admin.qs("cancel-reasons").value || "").trim()
    };

    Admin.setButtonBusy(submit, true, "Salvando...");
    Admin.apiPost("/admin/save_settings.php", payload).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao salvar notificações.");
      }
      Admin.note("notifications-feedback", "Notificações salvas com sucesso.", "ok");
      loadPage();
    }).catch(function (error) {
      Admin.note("notifications-feedback", error.message, "error");
    }).finally(function () {
      Admin.setButtonBusy(submit, false);
    });
  }

  function init() {
    Admin.initProtectedPage("notifications", loadPage).then(loadPage);

    var form = Admin.qs("notifications-form");
    if (form) {
      form.addEventListener("submit", onSaveNotifications);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
