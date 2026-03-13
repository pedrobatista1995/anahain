(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var apiBase = cfg.API_BASE || "api";
  var defaultVerseSource = cfg.VERSE_SOURCE_URL || "https://www.bible.com/pt/bible/211/1PE.5.7.NTLH";
  var weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex"];

  var state = {
    slotsByDate: {},
    rules: null,
    currentMonth: new Date(),
    selectedDate: "",
    selectedSlot: "",
    isSubmitting: false
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function qsa(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function apiGet(path) {
    return fetch(apiBase + path, { credentials: "same-origin" }).then(function (response) {
      return response.json();
    });
  }

  function apiPost(path, data) {
    return fetch(apiBase + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {})
    }).then(function (response) {
      return response.json();
    });
  }

  function track(eventName) {
    if (!eventName) return;
    apiPost("/public/track.php", { event: eventName }).catch(function () {});
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function applyPhoneMask(raw) {
    var d = digitsOnly(raw).slice(0, 11);
    if (!d) return "";
    if (d.length <= 2) return "(" + d;
    if (d.length <= 7) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  function formatDateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function formatHumanDate(key) {
    var parts = key.split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function setText(id, value) {
    var el = qs(id);
    if (el && value != null) el.textContent = value;
  }

  function setLink(id, href, hiddenWhenEmpty) {
    var el = qs(id);
    if (!el) return;

    if (!href) {
      if (hiddenWhenEmpty) {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
      } else {
        el.href = "#";
      }
      return;
    }

    el.href = href;
    el.hidden = false;
    el.removeAttribute("aria-hidden");
  }

  function setBrand() {
    var brandName = cfg.BRAND_NAME || "Dra. Ana Hain | Tricologia Curitiba";
    var shortName = brandName.split("|")[0].trim() || "Dra. Ana Hain";

    qsa("[data-brand-name]").forEach(function (node) {
      node.textContent = shortName;
    });

    [
      "public-whatsapp",
      "public-whatsapp-mobile",
      "public-whatsapp-hero",
      "public-whatsapp-2",
      "public-whatsapp-3",
      "public-whatsapp-footer",
      "floating-whatsapp-link"
    ].forEach(function (id) {
      setLink(id, cfg.WHATSAPP_PUBLIC_URL || "#");
    });

    [
      "public-instagram-3",
      "public-instagram-footer",
      "floating-instagram-link"
    ].forEach(function (id) {
      setLink(id, cfg.INSTAGRAM_URL || "#");
    });

    [
      "public-google-business",
      "public-google-business-2",
      "google-reviews-link"
    ].forEach(function (id) {
      setLink(id, cfg.GOOGLE_BUSINESS_URL || "", true);
    });

    setLink("verse-source-link", defaultVerseSource);
  }

  function initSplitText() {
    var nodes = document.querySelectorAll("[data-split]");

    nodes.forEach(function (node) {
      if (node.dataset.splitReady === "1") return;

      var original = node.innerHTML;
      var temp = document.createElement("div");
      temp.innerHTML = original;

      var text = temp.textContent.trim();
      if (!text) return;

      var words = text.split(/\s+/);
      node.dataset.splitReady = "1";
      node.classList.add("split-text");
      node.innerHTML = "";

      words.forEach(function (word, index) {
        var mask = document.createElement("span");
        mask.className = "word-mask";

        var inner = document.createElement("span");
        inner.className = "word";
        inner.style.transitionDelay = (index * 40) + "ms";
        inner.textContent = word;

        mask.appendChild(inner);
        node.appendChild(mask);

        if (index !== words.length - 1) {
          node.appendChild(document.createTextNode(" "));
        }
      });
    });
  }

  function initRevealObserver() {
    var elements = document.querySelectorAll("[data-reveal], [data-split]");
    if (!elements.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        el.classList.add("is-visible");
        observer.unobserve(el);
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -6% 0px"
    });

    elements.forEach(function (el) {
      if (el.closest(".marquee-track")) return;
      observer.observe(el);
    });
  }

  function setActiveBeforeAfterCard(element) {
    var container = qs("before-after-container");
    if (!container || !element) return;

    var cards = container.querySelectorAll("[data-result-card]");
    cards.forEach(function (card) {
      card.classList.remove("active", "lg:flex-[3]");
      card.classList.add("lg:flex-1");
      card.setAttribute("aria-pressed", "false");
    });

    element.classList.add("active", "lg:flex-[3]");
    element.classList.remove("lg:flex-1");
    element.setAttribute("aria-pressed", "true");
  }

  function initBeforeAfterCards() {
    var cards = document.querySelectorAll("[data-result-card]");
    if (!cards.length) return;

    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        setActiveBeforeAfterCard(card);
      });

      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setActiveBeforeAfterCard(card);
        }
      });
    });
  }

  function renderWeekdays() {
    var el = qs("calendar-weekdays");
    if (!el) return;

    el.innerHTML = weekdays.map(function (day) {
      return "<div>" + day + "</div>";
    }).join("");
  }

  function renderCalendar() {
    var title = qs("calendar-title");
    var grid = qs("calendar-grid");
    if (!title || !grid) return;

    var monthDate = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth(), 1);
    var year = monthDate.getFullYear();
    var month = monthDate.getMonth();
    var lastDay = new Date(year, month + 1, 0).getDate();

    title.textContent = monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    var html = [];
    for (var dayNumber = 1; dayNumber <= lastDay; dayNumber++) {
      var day = new Date(year, month, dayNumber);
      var dow = day.getDay();
      if (dow === 0 || dow === 6) continue;

      var key = formatDateKey(day);
      var slots = state.slotsByDate[key] || [];
      if (!slots.length) continue;

      var selected = state.selectedDate === key ? " is-selected" : "";
      html.push(
        "<button type=\"button\" class=\"day-cell" + selected + "\" data-date=\"" + key + "\">" +
          "<strong>" + day.getDate() + "</strong>" +
          "<small>disponível</small>" +
        "</button>"
      );
    }

    grid.innerHTML = html.length ? html.join("") : "<p class=\"calendar-empty\">Sem horários neste mês.</p>";
  }

  function renderSlots() {
    var list = qs("slots-list");
    var label = qs("selected-date-label");
    var hiddenInput = qs("slot-start");
    if (!list || !label || !hiddenInput) return;

    if (!state.selectedDate) {
      label.textContent = "Selecione um dia no calendário acima.";
      list.innerHTML = "<p class=\"hint\">Nenhum dia selecionado.</p>";
      hiddenInput.value = "";
      return;
    }

    var slots = state.slotsByDate[state.selectedDate] || [];
    label.textContent = formatHumanDate(state.selectedDate);

    if (!slots.length) {
      list.innerHTML = "<p class=\"hint\">Sem horários para este dia.</p>";
      hiddenInput.value = "";
      return;
    }

    if (!state.selectedSlot || !slots.some(function (slot) { return slot.slot_start === state.selectedSlot; })) {
      state.selectedSlot = slots[0].slot_start;
    }

    hiddenInput.value = state.selectedSlot;

    list.innerHTML = slots.map(function (slot) {
      var selected = state.selectedSlot === slot.slot_start ? " is-selected" : "";
      return "<button type=\"button\" class=\"slot-btn" + selected + "\" data-slot=\"" + slot.slot_start + "\"><strong>" + slot.time_label + "</strong></button>";
    }).join("");
  }

  function setRulesText(rules) {
    var el = qs("rules-text");
    if (!el || !rules) return;

    el.textContent = "Antecedência mínima de " + rules.min_notice_hours + " horas. Janela de agendamento em até " + rules.max_days_ahead + " dias.";
  }

  function firstDateWithSlots() {
    var keys = Object.keys(state.slotsByDate).sort();
    return keys.length ? keys[0] : "";
  }

  function loadSlots() {
    return apiGet("/public/slots.php").then(function (response) {
      if (!response.ok) throw new Error(response.message || "Falha ao carregar a agenda.");

      state.slotsByDate = response.slots_by_date || {};
      state.rules = response.rules || null;
      setRulesText(state.rules);

      var first = firstDateWithSlots();
      if (!state.selectedDate && first) {
        state.selectedDate = first;
        var parts = first.split("-");
        state.currentMonth = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      }

      renderCalendar();
      renderSlots();
      track("view_calendar");
    }).catch(function (error) {
      var list = qs("slots-list");
      if (list) list.innerHTML = "<p class=\"hint\">Erro ao carregar a agenda: " + error.message + "</p>";
    });
  }

  function handleCalendarClick(event) {
    var dayButton = event.target.closest(".day-cell");
    if (dayButton) {
      state.selectedDate = dayButton.getAttribute("data-date") || "";
      state.selectedSlot = "";
      renderCalendar();
      renderSlots();
      return;
    }

    var slotButton = event.target.closest(".slot-btn");
    if (slotButton) {
      state.selectedSlot = slotButton.getAttribute("data-slot") || "";
      var hiddenInput = qs("slot-start");
      if (hiddenInput) hiddenInput.value = state.selectedSlot;
      renderSlots();
      track("select_slot");
    }
  }

  function bindCalendarNav() {
    var prev = qs("prev-month");
    var next = qs("next-month");

    if (prev) {
      prev.addEventListener("click", function () {
        state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
        renderCalendar();
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
        renderCalendar();
      });
    }
  }

  function submitBooking(event) {
    event.preventDefault();
    if (state.isSubmitting) return;

    var form = event.currentTarget;
    var feedback = qs("booking-feedback");
    var submit = form.querySelector("button[type=\"submit\"]");
    if (!feedback || !submit) return;

    var payload = {
      name: (form.name.value || "").trim(),
      email: (form.email.value || "").trim(),
      phone: digitsOnly(form.phone.value || ""),
      slot_start: (qs("slot-start").value || "").trim()
    };

    feedback.className = "booking-feedback";

    if (!payload.name || !payload.email || !payload.phone || !payload.slot_start) {
      feedback.textContent = "Preencha nome, e-mail, WhatsApp e horário.";
      feedback.classList.add("error");
      return;
    }

    if (!isValidEmail(payload.email)) {
      feedback.textContent = "Informe um e-mail válido.";
      feedback.classList.add("error");
      return;
    }

    if (payload.phone.length < 10) {
      feedback.textContent = "Informe um WhatsApp válido com DDD.";
      feedback.classList.add("error");
      return;
    }

    state.isSubmitting = true;
    submit.disabled = true;
    feedback.textContent = "Confirmando seu agendamento...";

    apiPost("/public/book.php", payload).then(function (response) {
      if (!response.ok) throw new Error(response.message || "Não foi possível agendar.");

      feedback.textContent = response.message || "Consulta agendada com sucesso.";
      feedback.classList.add("ok");
      form.reset();
      state.selectedSlot = "";
      return loadSlots();
    }).catch(function (error) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    }).finally(function () {
      state.isSubmitting = false;
      submit.disabled = false;
    });
  }

  function loadVerse() {
    var reference = qs("verse-reference");
    var text = qs("verse-text");
    var footer = qs("footer-verse-preview");
    if (!reference || !text) return;

    function render(data) {
      var verseText = data.text || "Entreguem todas as suas preocupações a Deus, pois ele cuida de vocês.";
      reference.textContent = data.reference || "1 Pedro 5:7 (NTLH)";
      text.textContent = verseText;
      if (footer) footer.textContent = verseText;
    }

    apiGet("/public/verse.php").then(function (response) {
      if (!response.ok) throw new Error(response.message || "Falha ao carregar o versículo.");
      render(response);
    }).catch(function () {
      render({
        text: "Entreguem todas as suas preocupações a Deus, pois ele cuida de vocês.",
        reference: "1 Pedro 5:7 (NTLH)",
        source_url: defaultVerseSource
      });
    });
  }

  function initTracking() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-track-event]");
      if (!target) return;
      track(target.getAttribute("data-track-event"));
    });
  }

  function initFooterYear() {
    setText("footer-year", String(new Date().getFullYear()));
  }

  function initPhoneMask() {
    var phone = qs("patient-phone");
    if (!phone) return;

    phone.addEventListener("input", function (event) {
      event.target.value = applyPhoneMask(event.target.value);
    });

    phone.addEventListener("blur", function (event) {
      event.target.value = applyPhoneMask(event.target.value);
    });
  }

  function initMobileMenu() {
    var button = qs("mobile-menu-button");
    var panel = qs("mobile-menu-panel");
    if (!button || !panel) return;

    function closeMenu() {
      panel.classList.add("hidden");
      panel.classList.remove("flex");
      button.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
      var open = panel.classList.contains("hidden");
      panel.classList.toggle("hidden");
      panel.classList.toggle("flex");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    }

    button.addEventListener("click", toggleMenu);

    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (panel.classList.contains("hidden")) return;
      if (panel.contains(event.target) || button.contains(event.target)) return;
      closeMenu();
    });
  }

  function initMesojectVideo() {
    var video = qs("mesoject-video");
    var toggle = qs("mesoject-toggle");
    var label = qs("mesoject-toggle-label");
    if (!video || !toggle || !label) return;

    function updateState() {
      var isPlaying = !video.paused && !video.ended;
      label.textContent = isPlaying ? "Pausar" : "Reproduzir";
      toggle.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    }

    try {
      video.muted = true;
      video.loop = true;
      video.volume = 0.18;
    } catch (error) {}

    function tryAutoplay() {
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          updateState();
        });
      }
    }

    toggle.addEventListener("click", function () {
      if (video.paused) {
        video.play().catch(function () {});
      } else {
        video.pause();
      }
    });

    video.addEventListener("play", updateState);
    video.addEventListener("pause", updateState);
    video.addEventListener("ended", updateState);
    video.addEventListener("loadeddata", tryAutoplay, { once: true });

    tryAutoplay();
    updateState();
  }

  function initCounters() {
    var counters = qsa("[data-counter-target]");
    if (!counters.length) return;

    function paint(el, value) {
      var suffix = el.getAttribute("data-counter-suffix") || "";
      el.textContent = Math.round(value).toLocaleString("pt-BR") + suffix;
    }

    if (typeof IntersectionObserver === "undefined") {
      counters.forEach(function (el) {
        paint(el, Number(el.getAttribute("data-counter-target") || "0"));
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        var target = Number(el.getAttribute("data-counter-target") || "0");
        var start = null;
        var duration = 1400;

        function step(timestamp) {
          if (start === null) start = timestamp;
          var progress = Math.min((timestamp - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          paint(el, target * eased);

          if (progress < 1) {
            window.requestAnimationFrame(step);
          } else {
            paint(el, target);
          }
        }

        window.requestAnimationFrame(step);
        observer.unobserve(el);
      });
    }, { threshold: 0.45 });

    counters.forEach(function (el) {
      paint(el, 0);
      observer.observe(el);
    });
  }

  function init() {
    setBrand();
    initSplitText();
    initRevealObserver();
    initBeforeAfterCards();
    initFooterYear();
    initTracking();
    renderWeekdays();
    bindCalendarNav();
    initPhoneMask();
    initMobileMenu();
    initMesojectVideo();
    initCounters();
    loadVerse();
    document.addEventListener("click", handleCalendarClick);

    var form = qs("booking-form");
    if (form) form.addEventListener("submit", submitBooking);

    loadSlots();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();