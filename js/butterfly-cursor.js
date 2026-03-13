(function () {
  "use strict";

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function hasFinePointer() {
    return !!(window.matchMedia && (window.matchMedia("(any-pointer: fine)").matches || window.matchMedia("(pointer: fine)").matches));
  }

  function createButterfly() {
    var el = document.createElement("div");
    el.className = "butterfly-cursor";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = [
      '<span class="antenna antenna-left"></span>',
      '<span class="antenna antenna-right"></span>',
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
    var touchMode = false;
    var currentAngle = 0;

    document.body.classList.add("js-ready");

    function setVisible(flag) {
      butterfly.classList.toggle("is-visible", !!flag);
    }

    function syncCursorMode() {
      if (touchMode) {
        document.documentElement.classList.remove("butterfly-enabled");
        butterfly.classList.add("is-touch-active");
      } else {
        if (hasFinePointer()) {
          document.documentElement.classList.add("butterfly-enabled");
        }
        butterfly.classList.remove("is-touch-active");
      }
    }

    function place(x, y, angle) {
      butterfly.style.left = x + "px";
      butterfly.style.top = y + "px";
      butterfly.style.transform = "translate(-50%, -50%) rotate(" + angle + "deg)" + (touchMode ? " scale(0.96)" : "");
    }

    function updateTarget(x, y, immediate) {
      targetX = x;
      targetY = y;
      setVisible(true);

      if (immediate || reducedMotion) {
        currentX = x;
        currentY = y;
        currentAngle = 0;
        place(currentX, currentY, currentAngle);
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
      currentX += (targetX - currentX) * 0.24;
      currentY += (targetY - currentY) * 0.24;
      currentAngle += (((targetX - currentX) * 0.08) - currentAngle) * 0.18;
      if (currentAngle > 10) currentAngle = 10;
      if (currentAngle < -10) currentAngle = -10;
      place(currentX, currentY, currentAngle);
      rafId = window.requestAnimationFrame(animate);
    }

    window.addEventListener("mousemove", function (event) {
      touchMode = false;
      syncCursorMode();
      clearHideTimer();
      updateTarget(event.clientX, event.clientY, false);
    }, { passive: true });

    window.addEventListener("mousedown", function (event) {
      touchMode = false;
      syncCursorMode();
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
      touchMode = true;
      syncCursorMode();
      clearHideTimer();
      updateTarget(touch.clientX, touch.clientY, true);
    }, { passive: true });

    window.addEventListener("touchmove", function (event) {
      var touch = event.touches && event.touches[0];
      if (!touch) return;
      touchMode = true;
      syncCursorMode();
      clearHideTimer();
      updateTarget(touch.clientX, touch.clientY, true);
    }, { passive: true });

    window.addEventListener("touchend", scheduleTouchHide, { passive: true });
    window.addEventListener("touchcancel", scheduleTouchHide, { passive: true });

    if (reducedMotion) {
      place(currentX, currentY, 0);
    } else {
      rafId = window.requestAnimationFrame(animate);
    }
    syncCursorMode();

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
