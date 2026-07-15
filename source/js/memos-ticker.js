(function () {
  'use strict';

  function initMemosTicker(root) {
    if (!root || root.dataset.memosReady === 'true') return;
    root.dataset.memosReady = 'true';

    var message = root.querySelector('[data-memos-message]');
    var date = root.querySelector('[data-memos-date]');
    var controls = root.querySelector('[data-memos-controls]');
    var count = root.querySelector('[data-memos-count]');
    var previous = root.querySelector('[data-memos-prev]');
    var next = root.querySelector('[data-memos-next]');
    var progress = root.querySelector('[data-memos-progress]');
    var proxy = String(root.dataset.ech0Proxy || '').replace(/\/$/, '');
    var api = String(root.dataset.ech0Api || '').replace(/\/$/, '');
    var pageSize = Number(root.dataset.ech0PageSize) || 10;
    var interval = Number(root.dataset.ech0Interval) || 6000;
    var autoplay = root.dataset.ech0Autoplay !== 'false';
    var items = [];
    var current = 0;
    var timer = null;
    var progressTimer = null;
    var paused = false;
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!api && !proxy) return;

    /* ---- Helpers ---- */
    function renderInlineMd(raw) {
      var s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, ' ');
      s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
      s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
      s = s.replace(/\*\*(.+?)\*\*/g, '$1');
      s = s.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1$2$3');
      s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1$2$3');
      s = s.replace(/`([^`]+)`/g, '$1');
      s = s.replace(/~~(.+?)~~/g, '$1');
      s = s.replace(/^#{1,6}\s+/gm, '');
      s = s.replace(/^>\s+/gm, '');
      s = s.replace(/^-{3,}$/gm, '');
      s = s.replace(/^\*{3,}$/gm, '');
      s = s.replace(/\n+/g, ' ');
      return s.replace(/\s+/g, ' ').trim();
    }

    function formatTs(ts) {
      var d = ts ? new Date(ts * 1000) : null;
      if (!d || isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function setMessage(value, state) {
      if (!message) return;
      message.textContent = value;
      message.classList.toggle('is-loading', state === 'loading');
      message.classList.toggle('is-error', state === 'error');
    }

    /* ---- Progress bar ---- */
    function resetProgress() {
      if (!progress) return;
      progress.style.transition = 'none';
      progress.style.width = '0%';
      void progress.offsetWidth;
      if (!paused && autoplay && !reducedMotion) {
        progress.style.transition = 'width ' + interval + 'ms linear';
        progress.style.width = '100%';
      }
    }

    function stopProgress() {
      if (progressTimer) window.clearTimeout(progressTimer);
      progressTimer = null;
    }

    /* ---- Autoplay ---- */
    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
      stopProgress();
    }

    function start() {
      stop();
      if (!autoplay || reducedMotion || items.length < 2 || paused) return;
      resetProgress();
      timer = window.setInterval(function () { show(current + 1); }, interval);
    }

    function pause() {
      paused = true;
      stop();
      root.classList.add('is-paused');
      if (progress) {
        var computed = window.getComputedStyle(progress);
        progress.style.transition = 'none';
        progress.style.width = computed.width;
      }
    }

    function resume() {
      paused = false;
      root.classList.remove('is-paused');
      start();
    }

    /* ---- Show slide ---- */
    function show(index) {
      if (!items.length) return;
      var nextIndex = (index + items.length) % items.length;
      if (nextIndex === current && items.length > 1) {
        current = (nextIndex + 1) % items.length;
      } else {
        current = nextIndex;
      }
      var item = items[current];

      root.classList.remove('is-ready');
      root.classList.add('is-changing');

      setTimeout(function () {
        setMessage(item.content, 'ready');
        if (date) date.textContent = formatTs(item.createdAt);
        if (count) count.textContent = (current + 1) + ' / ' + items.length;
        root.classList.remove('is-changing');
        void root.offsetWidth;
        root.classList.add('is-ready');
        resetProgress();
      }, reducedMotion ? 0 : 180);
    }

    /* ---- Normalize Ech0 items ---- */
    function normalize(list) {
      return list.map(function (item) {
        var raw = String(item && item.content || '');
        return {
          content: renderInlineMd(raw),
          createdAt: item && item.created_at,
          pinned: Boolean(item && item.pinned)
        };
      }).filter(function (item) { return item.content; }).sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }

    /* ---- Fetch (direct → proxy fallback) ---- */
    function fetchEch0(body) {
      var payload = JSON.stringify(body);
      var opts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'omit',
        body: payload
      };
      return fetch(api, opts).then(function (r) {
        if (r.ok) return r.json();
        if (proxy) return fetch(proxy, opts).then(function (r2) { return r2.json(); });
        throw new Error('request failed');
      }).catch(function () {
        if (!proxy) throw new Error('request failed');
        return fetch(proxy, opts).then(function (r) {
          if (!r.ok) throw new Error('proxy failed');
          return r.json();
        });
      });
    }

    function load() {
      setMessage('正在翻阅最新记录', 'loading');
      return fetchEch0({ page: 1, pageSize: pageSize, search: '' }).then(function (data) {
        if (data.code !== 1 || !Array.isArray(data.data && data.data.items)) {
          throw new Error('Unexpected Ech0 response');
        }
        items = normalize(data.data.items);
        if (!items.length) {
          setMessage('暂时没有新的记录', 'ready');
          if (controls) controls.hidden = true;
          return;
        }
        if (controls) controls.hidden = items.length < 2;
        show(0);
        root.classList.add('is-ready');
        start();
      }).catch(function () {
        stop();
        if (controls) controls.hidden = true;
        setMessage('记录暂时无法读取', 'error');
      });
    }

    /* ---- Button events ---- */
    if (previous) previous.addEventListener('click', function () { show(current - 1); start(); });
    if (next) next.addEventListener('click', function () { show(current + 1); start(); });

    root.addEventListener('mouseenter', pause);
    root.addEventListener('mouseleave', resume);
    root.addEventListener('focusin', pause);
    root.addEventListener('focusout', resume);

    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { show(current - 1); start(); }
      if (event.key === 'ArrowRight') { show(current + 1); start(); }
    });

    /* ---- Touch swipe ---- */
    var touchStartX = 0;
    var swiping = false;

    root.addEventListener('touchstart', function (event) {
      if (!event.touches || !event.touches.length) return;
      touchStartX = event.touches[0].clientX;
      swiping = false;
    }, { passive: true });

    root.addEventListener('touchmove', function (event) {
      if (!event.touches || !event.touches.length) return;
      var dx = event.touches[0].clientX - touchStartX;
      if (!swiping && Math.abs(dx) > 10) swiping = true;
    }, { passive: true });

    root.addEventListener('touchend', function (event) {
      if (!swiping) return;
      var endX = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : touchStartX;
      if (Math.abs(endX - touchStartX) > 40) {
        show(endX > touchStartX ? current - 1 : current + 1);
        start();
      }
      swiping = false;
    }, { passive: true });

    /* ---- Visibility ---- */
    function handleVisibility() {
      if (document.hidden) pause();
      else if (!paused) resume();
    }
    if (document.addEventListener) document.addEventListener('visibilitychange', handleVisibility);

    load();
  }

  function boot() {
    document.querySelectorAll('.memos-ticker').forEach(initMemosTicker);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('pjax:complete', boot);
}());
