(function () {
  "use strict";

  var CURSOR_SIZE = 40;

  function hasCoarsePointer() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function hasFinePointer() {
    if (!window.matchMedia) return !hasCoarsePointer();
    return window.matchMedia('(any-pointer: fine)').matches || window.matchMedia('(pointer: fine)').matches;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function shouldEnable() {
    return hasFinePointer() && window.innerWidth >= 860 && !prefersReducedMotion();
  }

  function createCursor() {
    var uid = String(Date.now()) + String(Math.floor(Math.random() * 1000));
    var gradientA = 'wingGoldA-' + uid;
    var gradientB = 'wingGoldB-' + uid;
    var el = document.createElement('div');
    el.id = 'butterfly-cursor-overlay';
    el.className = 'butterfly-cursor is-flap-infinite';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '' +
      '<svg class="butterfly-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="' + gradientA + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#f5d878" />' +
            '<stop offset="100%" stop-color="#c49a22" />' +
          '</linearGradient>' +
          '<linearGradient id="' + gradientB + '" x1="0" y1="1" x2="1" y2="0">' +
            '<stop offset="0%" stop-color="#d8ad31" />' +
            '<stop offset="100%" stop-color="#b98e1f" />' +
          '</linearGradient>' +
        '</defs>' +
        '<g class="wing-left-group">' +
          '<path class="wing wing-top-left" fill="url(#' + gradientA + ')" d="M24 22C19 17 13 9 9 12C6 15 8 22 14 25C18 27 21 26 24 22Z" />' +
          '<path class="wing wing-bottom-left" fill="url(#' + gradientB + ')" d="M23 24C17 24 12 28 12 34C12 38 16 40 20 38C23 36 24 30 23 24Z" />' +
        '</g>' +
        '<g class="wing-right-group">' +
          '<path class="wing wing-top-right" fill="url(#' + gradientA + ')" d="M24 22C29 17 35 9 39 12C42 15 40 22 34 25C30 27 27 26 24 22Z" />' +
          '<path class="wing wing-bottom-right" fill="url(#' + gradientB + ')" d="M25 24C31 24 36 28 36 34C36 38 32 40 28 38C25 36 24 30 25 24Z" />' +
        '</g>' +
        '<ellipse class="body" cx="24" cy="24" rx="2.1" ry="9.2" />' +
        '<circle class="spark" cx="24" cy="15" r="1.2" />' +
      '</svg>';
    document.body.appendChild(el);
    window.__butterflyCursor = el;
    return el;
  }

  function spawnTrail(x, y) {
    var dot = document.createElement('span');
    dot.className = 'butterfly-trail-dot';
    dot.style.setProperty('--trail-size', (8 + Math.random() * 8) + 'px');
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    dot.style.animationDuration = (700 + Math.random() * 400) + 'ms';
    document.body.appendChild(dot);
    setTimeout(function () {
      if (dot.parentNode) dot.parentNode.removeChild(dot);
    }, 1200);
  }

  function init() {
    if (!shouldEnable()) {
      document.documentElement.setAttribute('data-butterfly-cursor', 'disabled');
      return;
    }
    var reducedMotion = prefersReducedMotion();
    var enabled = shouldEnable();
    var cursor;
    try {
      cursor = createCursor();
    } catch (err) {
      delete window.__butterflyCursor;
      document.documentElement.classList.remove('butterfly-enabled');
      document.documentElement.setAttribute('data-butterfly-cursor', 'error');
      return;
    }
    if (!cursor) return;
    document.documentElement.setAttribute('data-butterfly-cursor', 'mounted');

    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 2;
    var x = targetX;
    var y = targetY;
    var visible = false;
    var activated = false;
    var flapTimer = null;
    var lastTrail = 0;
    var idleFlapTimer = null;
    var lastPulse = 0;

    function syncEnableState() {
      enabled = shouldEnable();
      cursor.style.display = enabled ? 'block' : 'none';
      if (!enabled) {
        activated = false;
        document.documentElement.classList.remove('butterfly-enabled');
        document.documentElement.setAttribute('data-butterfly-cursor', 'disabled');
        setVisible(false);
      } else if (!activated) {
        document.documentElement.setAttribute('data-butterfly-cursor', 'mounted');
      }
    }

    function activateCustomCursor() {
      if (!enabled) return;
      if (activated) return;
      activated = true;
      document.documentElement.classList.add('butterfly-enabled');
      document.documentElement.setAttribute('data-butterfly-cursor', 'active');
    }

    function setVisible(flag) {
      visible = flag;
      cursor.style.visibility = flag ? 'visible' : 'hidden';
      cursor.style.opacity = flag ? '0.95' : '0';
    }

    function clickFlap() {
      if (reducedMotion) return;
      cursor.classList.add('is-click');
      setTimeout(function () {
        cursor.classList.remove('is-click');
      }, 260);
    }

    function pulseFlap() {
      if (reducedMotion) return;
      var now = performance.now();
      if (now - lastPulse < 90) return;
      lastPulse = now;
      cursor.classList.remove('is-flap-infinite');
      cursor.classList.remove('is-flap');
      void cursor.offsetWidth;
      cursor.classList.add('is-flap');

      clearTimeout(flapTimer);
      flapTimer = setTimeout(function () {
        cursor.classList.remove('is-flap');
      }, 260);

      clearTimeout(idleFlapTimer);
      idleFlapTimer = setTimeout(function () {
        cursor.classList.add('is-flap-infinite');
      }, 220);
    }

    function render() {
      if (reducedMotion) {
        x = targetX;
        y = targetY;
      } else {
        x += (targetX - x) * 0.22;
        y += (targetY - y) * 0.22;
      }
      cursor.style.transform = 'translate3d(' + (x - CURSOR_SIZE / 2) + 'px,' + (y - CURSOR_SIZE / 2) + 'px,0)';
      requestAnimationFrame(render);
    }

    function handleMove(clientX, clientY) {
      if (!enabled) return;
      targetX = clientX;
      targetY = clientY;
      activateCustomCursor();
      if (!visible) setVisible(true);
      if (reducedMotion) return;
      pulseFlap();

      var now = performance.now();
      if (now - lastTrail > 35) {
        spawnTrail(clientX, clientY);
        lastTrail = now;
      }
    }

    function handlePress(clientX, clientY) {
      if (!enabled) return;
      targetX = clientX;
      targetY = clientY;
      activateCustomCursor();
      if (!visible) setVisible(true);
      pulseFlap();
      clickFlap();
    }

    window.addEventListener('mousemove', function (event) {
      handleMove(event.clientX, event.clientY);
    }, { passive: true });

    window.addEventListener('mousedown', function (event) {
      handlePress(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('mouseover', function (event) {
      if (!enabled) return;
      activateCustomCursor();
      if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        targetX = event.clientX;
        targetY = event.clientY;
        if (!visible) setVisible(true);
      }
    }, { passive: true });

    document.addEventListener('mouseout', function (event) {
      if (event.relatedTarget) return;
      setVisible(false);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) setVisible(false);
    });

    window.addEventListener('blur', function () {
      setVisible(false);
      cursor.classList.add('is-flap-infinite');
    });

    window.addEventListener('focus', function () {
      if (activated && targetX > 0 && targetY > 0) setVisible(true);
    });

    window.addEventListener('resize', function () {
      syncEnableState();
    });

    syncEnableState();
    setVisible(false);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
