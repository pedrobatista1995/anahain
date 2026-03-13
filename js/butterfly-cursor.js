(function () {
  "use strict";

  var CURSOR_OFFSET_X = 21;
  var CURSOR_OFFSET_Y = 16;

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function createButterfly() {
    var el = document.createElement("div");
    el.className = "butterfly-cursor";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = [
      '<span class="wing wing-left"></span>',
      '<span class="body"></span>',
      '<span class="wing wing-right"></span>'
    ].join("");
    document.body.appendChild(el);
    return el;
  }

  function init() {
    if (!document.body) return;

    var butterfly = createButterfly();
    var reducedMotion = prefersReducedMotion();
    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 2;
    var currentX = targetX;
    var currentY = targetY;
    var rafId = 0;
    var hideTimer = 0;

    document.body.classList.add("js-ready");

    function setVisible(flag) {
      butterfly.classList.toggle("is-visible", !!flag);
    }

    function place(x, y) {
      butterfly.style.left = x + "px";
      butterfly.style.top = y + "px";
    }

    function updateTarget(x, y, immediate) {
      targetX = x;
      targetY = y;
      setVisible(true);

      if (immediate || reducedMotion) {
        currentX = x;
        currentY = y;
        place(currentX, currentY);
      }
    }

    function clearHideTimer() {
      if (!hideTimer) return;
      window.clearTimeout(hideTimer);
      hideTimer = 0;
    }

    function scheduleTouchHide() {
      clearHideTimer();
      hideTimer = window.setTimeout(function () {
        setVisible(false);
      }, 180);
    }

    function animate() {
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      place(currentX, currentY);
      rafId = window.requestAnimationFrame(animate);
    }

    window.addEventListener("mousemove", function (event) {
      clearHideTimer();
      updateTarget(event.clientX, event.clientY, false);
    }, { passive: true });

    window.addEventListener("mousedown", function (event) {
      clearHideTimer();
      updateTarget(event.clientX, event.clientY, true);
    }, { passive: true });

    window.addEventListener("mouseleave", function () {
      setVisible(false);
    });

    document.addEventListener("mouseout", function (event) {
      if (!event.relatedTarget) {
        setVisible(false);
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        setVisible(false);
      }
    });

    window.addEventListener("blur", function () {
      setVisible(false);
    });

    window.addEventListener("touchstart", function (event) {
      var touch = event.touches && event.touches[0];
      if (!touch) return;
      clearHideTimer();
      updateTarget(touch.clientX, touch.clientY, true);
    }, { passive: true });

    window.addEventListener("touchmove", function (event) {
      var touch = event.touches && event.touches[0];
      if (!touch) return;
      clearHideTimer();
      updateTarget(touch.clientX, touch.clientY, true);
    }, { passive: true });

    window.addEventListener("touchend", scheduleTouchHide, { passive: true });
    window.addEventListener("touchcancel", scheduleTouchHide, { passive: true });

    if (reducedMotion) {
      place(currentX, currentY);
    } else {
      rafId = window.requestAnimationFrame(animate);
    }

    butterfly.style.marginLeft = "-" + CURSOR_OFFSET_X + "px";
    butterfly.style.marginTop = "-" + CURSOR_OFFSET_Y + "px";

    window.addEventListener("beforeunload", function () {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
