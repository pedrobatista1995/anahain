(function () {
  "use strict";

  var Admin = window.AdminCommon;

  function onLogin(event) {
    event.preventDefault();
    var payload = {
      username: (Admin.qs("login-username").value || "").trim(),
      password: (Admin.qs("login-password").value || "").trim()
    };

    Admin.apiPost("/admin/login.php", payload).then(function (response) {
      if (!response.ok) {
        throw new Error(response.message || "Falha no login.");
      }
      Admin.note("login-feedback", "Login realizado com sucesso.", "ok");
      Admin.redirectTo("admin-dashboard.html");
    }).catch(function (error) {
      Admin.note("login-feedback", error.message, "error");
    });
  }

  function init() {
    Admin.apiGet("/admin/session.php").then(function (response) {
      if (response.authenticated) {
        Admin.redirectTo("admin-dashboard.html");
      }
    });

    var form = Admin.qs("login-form");
    if (form) {
      form.addEventListener("submit", onLogin);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
