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
      '<svg class="butterfly-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">',
      '  <ellipse class="butterfly-shadow" cx="24" cy="40" rx="8.5" ry="2.2"></ellipse>',
      '  <g class="butterfly-core">',
      '    <g class="wing-left-group">',
      '      <path class="butterfly-wing-fill" d="M24 18C18 10 10 8 7 13C4 18 7 26 14 26C10 29 10 35 15 38C20 40 23 34 24 23Z"></path>',
      '      <path class="butterfly-outline" d="M24 18C18 10 10 8 7 13C4 18 7 26 14 26C10 29 10 35 15 38C20 40 23 34 24 23"></path>',
      '    </g>',
      '    <g class="wing-right-group">',
      '      <path class="butterfly-wing-fill" d="M24 18C30 10 38 8 41 13C44 18 41 26 34 26C38 29 38 35 33 38C28 40 25 34 24 23Z"></path>',
      '      <path class="butterfly-outline" d="M24 18C30 10 38 8 41 13C44 18 41 26 34 26C38 29 38 35 33 38C28 40 25 34 24 23"></path>',
      '    </g>',
      '    <path class="butterfly-body-line" d="M24 14L24 33"></path>',
      '    <path class="butterfly-antenna" d="M24 14C22 10 19 8 16 7"></path>',
      '    <path class="butterfly-antenna" d="M24 14C26 10 29 8 32 7"></path>',
      '    <circle class="butterfly-head" cx="24" cy="14" r="2.2"></circle>',
      '  </g>',
      '</svg>'
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
