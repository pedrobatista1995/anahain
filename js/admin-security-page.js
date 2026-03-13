(function () {
  "use strict";

  var Admin = window.AdminCommon;

  function renderSidebar(session) {
    var userEl = Admin.qs("sidebar-selected-day");
    if (userEl) {
      userEl.textContent = session.username || "Médico";
    }
  }

  function loadPage() {
    return Admin.apiGet("/admin/session.php").then(function (response) {
      if (!response.authenticated) {
        Admin.redirectTo("admin.html");
        return response;
      }
      renderSidebar(response);
      return response;
    }).catch(function (error) {
      Admin.note("password-feedback", error.message || "Falha ao carregar a sessão.", "error");
    });
  }

  function onChangePassword(event) {
    event.preventDefault();
    var submit = event.submitter || event.target.querySelector('button[type="submit"]');
    var payload = {
      current_password: (Admin.qs("current-password").value || "").trim(),
      new_password: (Admin.qs("new-password").value || "").trim()
    };

    Admin.setButtonBusy(submit, true, "Alterando...");
    Admin.apiPost("/admin/change_password.php", payload).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha ao alterar a senha.");
      }
      Admin.note("password-feedback", "Senha alterada com sucesso.", "ok");
      Admin.qs("password-form").reset();
    }).catch(function (error) {
      Admin.note("password-feedback", error.message, "error");
    }).finally(function () {
      Admin.setButtonBusy(submit, false);
    });
  }

  function init() {
    Admin.initProtectedPage("security", loadPage).then(loadPage);

    var passwordForm = Admin.qs("password-form");
    if (passwordForm) {
      passwordForm.addEventListener("submit", onChangePassword);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
