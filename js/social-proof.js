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

  function authorInitial(name) {
    var value = String(name || "").trim();
    return value ? value.charAt(0).toUpperCase() : "G";
  }

  function renderReviewStars(rating) {
    var rounded = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
    if (!rounded) return "";
    return new Array(rounded + 1).join(String.fromCharCode(9733));
  }

  function renderReviews(payload) {
    var reviewsTitle = document.querySelector("#reviews .section-title");
    var summary = qs("reviews-summary");
    var grid = qs("reviews-grid");
    var googleLink = qs("google-reviews-link");
    var doctoraliaLink = qs("doctoralia-reviews-link");
    if (!summary || !grid) return;

    var sourceName = String((payload && payload.source) || "").toLowerCase();
    var googleHref = cfg.GOOGLE_BUSINESS_URL || "";
    if (payload && payload.ok && sourceName === "google") {
      googleHref = payload.reviews_url || payload.canonical_url || payload.place_url || googleHref;
    }
    if (googleLink) {
      googleLink.href = googleHref || "#";
      googleLink.hidden = !googleHref;
    }
    if (doctoraliaLink) {
      doctoraliaLink.href = cfg.DOCTORALIA_URL || "#";
      doctoraliaLink.hidden = !(cfg.DOCTORALIA_URL && sourceName === "doctoralia");
    }
    if (reviewsTitle) {
      reviewsTitle.textContent = sourceName === "google" ? "Avaliacoes Google" : "Avaliacoes publicas";
    }

    if (!payload || !payload.ok) {
      summary.innerHTML = '<div class="social-empty">Nao foi possivel carregar as avaliacoes agora.</div>';
      grid.innerHTML = "";
      return;
    }

    var ratingValue = Number(payload.rating);
    var rating = payload.rating != null && Number.isFinite(ratingValue)
      ? ratingValue.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : "--";
    var reviewCount = Number(payload.review_count || 0);
    var staleLabel = payload.stale ? " - cache local" : "";
    var primaryHref = sourceName === "google" ? googleHref : (cfg.DOCTORALIA_URL || googleHref || "#");
    var primaryLabel = sourceName === "google" ? "Ver no Google" : "Ver no Doctoralia";
    var countCopy = sourceName === "google"
      ? "(" + reviewCount.toLocaleString("pt-BR") + ")"
      : reviewCount.toLocaleString("pt-BR") + " opinioes publicas";
    var summaryTitle = sourceName === "google"
      ? '<span class="google-wordmark"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></span> <span>Reviews</span>'
      : "Avaliacoes publicas";

    summary.innerHTML = [
      '<div class="reviews-summary-card">',
      '  <div class="reviews-summary-copy">',
      '    <span class="social-kicker">' + escapeHtml(sourceName === "google" ? "Fonte Google" : (payload.source_label || "Fonte publica")) + staleLabel + "</span>",
      '    <div class="reviews-summary-title">' + summaryTitle + "</div>",
      '    <div class="reviews-summary-rating">',
      '      <strong class="reviews-summary-value">' + escapeHtml(rating) + "</strong>",
      '      <span class="reviews-summary-stars">' + escapeHtml(renderReviewStars(payload.rating)) + "</span>",
      '      <span class="reviews-summary-count">' + escapeHtml(countCopy) + "</span>",
      "    </div>",
      "  </div>",
      (primaryHref
        ? '  <a class="reviews-summary-button" href="' + escapeHtml(primaryHref) + '" target="_blank" rel="noopener">' + escapeHtml(primaryLabel) + "</a>"
        : ""),
      "</div>"
    ].join("");

    var reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
    if (!reviews.length) {
      grid.innerHTML = '<div class="social-empty">Nenhuma avaliacao publica encontrada no momento.</div>';
      return;
    }

    grid.innerHTML = reviews.map(function (review) {
      var author = escapeHtml(review.author || "Paciente");
      var metaParts;

      if (sourceName === "google") {
        metaParts = [
          trimText(review.reviewer_meta || "", 48),
          review.relative_date || ""
        ].filter(Boolean).map(escapeHtml);
      } else {
        var service = trimText(review.service || "", 48);
        var dateLabel = formatDate(review.date_published);
        metaParts = [service, dateLabel].filter(Boolean).map(escapeHtml);
      }

      return [
        '<article class="review-card">',
        '  <div class="review-card__header">',
        '    <div class="review-card__avatar-wrap">',
        '      <div class="review-card__avatar">' + escapeHtml(authorInitial(review.author)) + "</div>",
        (sourceName === "google" ? '      <span class="review-card__google-badge">G</span>' : ""),
        "    </div>",
        '    <div class="review-card__header-main">',
        '      <div class="review-card__author-row">',
        '        <strong class="review-card__author">' + author + "</strong>",
        (sourceName === "google" ? '        <span class="review-card__verified" aria-hidden="true"></span>' : ""),
        "      </div>",
        '      <div class="review-card__meta">' + (metaParts.join(" / ") || "Avaliacao publica") + "</div>",
        '      <span class="review-stars">' + escapeHtml(renderReviewStars(review.rating)) + "</span>",
        "    </div>",
        "  </div>",
        '  <p class="review-card__body">' + escapeHtml(review.body || "") + "</p>",
        ((review.profile_url || primaryHref)
          ? '  <a class="review-card__link" href="' + escapeHtml(review.profile_url || primaryHref) + '" target="_blank" rel="noopener">Ler review</a>'
          : ""),
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
    var title = profile.username ? ("@" + profile.username) : (profile.full_name || "Instagram");
    var staleLabel = payload.stale ? " - cache local" : "";
    var profileUrl = cfg.INSTAGRAM_URL || payload.source_url || "#";

    profileShell.innerHTML = [
      '<div class="instagram-profile-card">',
      '  <div class="instagram-profile-card__main">',
      '    <strong class="instagram-profile-card__title">' + escapeHtml(title) + "</strong>",
      '    <div class="instagram-profile-card__stats">',
      '      <span><strong>' + escapeHtml(compactNumber(profile.followers)) + "</strong> seguidores</span>",
      '      <span><strong>' + escapeHtml(compactNumber(profile.posts)) + "</strong> posts</span>",
      "    </div>",
      "  </div>",
      '  <a class="ghost-button" href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener">Abrir perfil</a>',
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
    function fallbackToDoctoralia() {
      if (!cfg.DOCTORALIA_URL) {
        renderReviews({ ok: false });
        return;
      }

      apiGet("/public/doctoralia_reviews.php?url=" + encodeURIComponent(cfg.DOCTORALIA_URL))
        .then(function (payload) {
          renderReviews(payload && payload.ok ? payload : { ok: false });
        })
        .catch(function () {
          renderReviews({ ok: false });
        });
    }

    if (!cfg.GOOGLE_BUSINESS_URL) {
      fallbackToDoctoralia();
      return;
    }

    apiGet("/public/google_reviews.php?url=" + encodeURIComponent(cfg.GOOGLE_BUSINESS_URL))
      .then(function (payload) {
        if (payload && payload.ok) {
          renderReviews(payload);
          return;
        }

        fallbackToDoctoralia();
      })
      .catch(fallbackToDoctoralia);
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
    loadReviews();
    loadInstagram();
  });
})();
