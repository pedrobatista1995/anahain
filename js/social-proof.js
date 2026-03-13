(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var apiBase = String(cfg.API_BASE || "api").replace(/\/+$/, "");

  function qs(id) {
    return document.getElementById(id);
  }

  function apiGet(path) {
    return fetch(apiBase + path, { credentials: "same-origin" }).then(function (response) {
      return response.json();
    });
  }

  function proxiedImageUrl(url) {
    if (!url) return "";
    return apiBase + "/public/media_proxy.php?url=" + encodeURIComponent(url);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function compactNumber(value) {
    var number = Number(value || 0);
    if (!Number.isFinite(number)) return "0";
    return new Intl.NumberFormat("pt-BR", {
      notation: number >= 1000 ? "compact" : "standard",
      maximumFractionDigits: 1
    }).format(number);
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function trimText(text, maxLength) {
    var value = String(text || "").trim();
    if (!value || value.length <= maxLength) return value;
    return value.slice(0, Math.max(0, maxLength - 3)).trim() + "...";
  }

  function renderReviewStars(rating) {
    var rounded = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
    if (!rounded) return "";
    return new Array(rounded + 1).join(String.fromCharCode(9733));
  }

  function renderReviews(payload) {
    var summary = qs("reviews-summary");
    var grid = qs("reviews-grid");
    var doctoraliaLink = qs("doctoralia-reviews-link");
    if (doctoraliaLink && cfg.DOCTORALIA_URL) {
      doctoraliaLink.href = cfg.DOCTORALIA_URL;
      doctoraliaLink.hidden = false;
    }
    if (!summary || !grid) return;

    if (!payload || !payload.ok) {
      summary.innerHTML = '<div class="social-empty">Nao foi possivel carregar as avaliacoes agora.</div>';
      grid.innerHTML = "";
      return;
    }

    var rating = payload.rating != null ? String(payload.rating).replace(".", ",") : "--";
    var reviewCount = Number(payload.review_count || 0);
    var staleLabel = payload.stale ? " - cache local" : "";

    summary.innerHTML = [
      '<div class="social-source-shell">',
      '  <div class="social-source-meta">',
      '    <span class="social-kicker">Fonte principal: ' + escapeHtml(payload.source_label || "Doctoralia") + staleLabel + "</span>",
      '    <div class="social-rating-row">',
      '      <strong class="social-rating-value">' + escapeHtml(rating) + "</strong>",
      '      <div class="social-rating-copy">' + escapeHtml(reviewCount.toLocaleString("pt-BR")) + " opinioes publicas de pacientes</div>",
      "    </div>",
      "  </div>",
      "</div>"
    ].join("");

    var reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
    if (!reviews.length) {
      grid.innerHTML = '<div class="social-empty">Nenhuma avaliacao publica encontrada no momento.</div>';
      return;
    }

    grid.innerHTML = reviews.map(function (review) {
      var author = escapeHtml(review.author || "Paciente");
      var service = trimText(review.service || "", 48);
      var dateLabel = formatDate(review.date_published);
      var metaParts = [service, dateLabel].filter(Boolean).map(escapeHtml);

      return [
        '<article class="review-card">',
        '  <div class="review-card__top">',
        "    <div>",
        '      <strong class="review-card__author">' + author + "</strong>",
        '      <div class="review-card__meta">' + (metaParts.join(" / ") || "Avaliacao publica") + "</div>",
        "    </div>",
        '    <span class="review-stars">' + escapeHtml(renderReviewStars(review.rating)) + "</span>",
        "  </div>",
        '  <p class="review-card__body">' + escapeHtml(trimText(review.body || "", 260)) + "</p>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderInstagram(payload) {
    var profileShell = qs("instagram-profile-shell");
    var grid = qs("instagram-feed-grid");
    if (!profileShell || !grid) return;

    if (!payload || !payload.ok || !payload.profile) {
      profileShell.innerHTML = '<div class="social-empty">Nao foi possivel carregar o Instagram agora.</div>';
      grid.innerHTML = "";
      return;
    }

    var profile = payload.profile;
    var title = profile.full_name || ("@" + (profile.username || ""));
    var staleLabel = payload.stale ? " - cache local" : "";
    var profileUrl = cfg.INSTAGRAM_URL || payload.source_url || "#";

    profileShell.innerHTML = [
      '<div class="instagram-profile-card">',
      '  <img alt="' + escapeHtml(title) + '" loading="lazy" src="' + escapeHtml(proxiedImageUrl(profile.profile_pic_url || "")) + '">',
      "  <div>",
      '    <div class="social-kicker">Instagram publico' + staleLabel + "</div>",
      '    <strong class="instagram-profile-card__title">' + escapeHtml(title) + "</strong>",
      '    <div class="instagram-profile-card__stats">',
      '      <span><strong>' + escapeHtml(compactNumber(profile.followers)) + "</strong> seguidores</span>",
      '      <span><strong>' + escapeHtml(compactNumber(profile.posts)) + "</strong> posts</span>",
      (profile.category_name ? '      <span>' + escapeHtml(profile.category_name) + "</span>" : ""),
      "    </div>",
      (profile.biography ? '    <p class="instagram-profile-card__bio">' + escapeHtml(profile.biography) + "</p>" : ""),
      "  </div>",
      '  <div><a class="ghost-button" href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener">Abrir perfil</a></div>',
      "</div>"
    ].join("");

    var posts = Array.isArray(payload.posts) ? payload.posts : [];
    if (!posts.length) {
      grid.innerHTML = '<div class="social-empty">Nenhum post publico encontrado no momento.</div>';
      return;
    }

    grid.innerHTML = posts.slice(0, 6).map(function (post) {
      var meta = [
        post.is_video ? "Reel" : "Post",
        compactNumber(post.like_count || 0) + " curtidas"
      ];

      return [
        '<a class="instagram-card" href="' + escapeHtml(post.permalink || profileUrl) + '" target="_blank" rel="noopener">',
        '  <img class="instagram-card__media" alt="' + escapeHtml(trimText(post.caption || title, 120)) + '" loading="lazy" src="' + escapeHtml(proxiedImageUrl(post.image_url || "")) + '">',
        '  <div class="instagram-card__content">',
        '    <div class="instagram-card__meta">',
        '      <span class="instagram-card__badge">' + escapeHtml(meta[0]) + "</span>",
        '      <span>' + escapeHtml(meta[1]) + "</span>",
        (post.taken_at ? '      <span>' + escapeHtml(formatDate(post.taken_at)) + "</span>" : ""),
        "    </div>",
        '    <p class="instagram-card__caption">' + escapeHtml(trimText(post.caption || "Abrir post no Instagram", 150)) + "</p>",
        "  </div>",
        "</a>"
      ].join("");
    }).join("");
  }

  function loadReviews() {
    if (!cfg.DOCTORALIA_URL) {
      renderReviews({ ok: false });
      return;
    }

    apiGet("/public/doctoralia_reviews.php?url=" + encodeURIComponent(cfg.DOCTORALIA_URL))
      .then(renderReviews)
      .catch(function () {
        renderReviews({ ok: false });
      });
  }

  function loadInstagram() {
    if (!cfg.INSTAGRAM_URL) {
      renderInstagram({ ok: false });
      return;
    }

    apiGet("/public/instagram_feed.php?url=" + encodeURIComponent(cfg.INSTAGRAM_URL))
      .then(renderInstagram)
      .catch(function () {
        renderInstagram({ ok: false });
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var reviewsTitle = document.querySelector("#reviews .section-title");
    if (reviewsTitle) {
      reviewsTitle.textContent = "Avaliacoes publicas";
    }

    loadReviews();
    loadInstagram();
  });
})();
