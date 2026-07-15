(function () {
  'use strict';

  function initMemosPage(root) {
    if (!root || root.dataset.memosReady === 'true') return;
    root.dataset.memosReady = 'true';

    var waterfall = root.querySelector('[data-memos-waterfall]');
    var loading = root.querySelector('[data-memos-loading]');
    var empty = root.querySelector('[data-memos-empty]');
    var error = root.querySelector('[data-memos-error]');
    var sentinel = root.querySelector('[data-memos-sentinel]');
    var proxy = String(root.dataset.ech0Proxy || '').replace(/\/$/, '');
    var api = String(root.dataset.ech0Api || '').replace(/\/$/, '');
    var baseUrl = String(root.dataset.ech0BaseUrl || '').replace(/\/$/, '');
    var pageSize = Number(root.dataset.ech0PageSize) || 10;
    var page = 1;
    var total = 0;
    var hasMore = true;
    var loadingMore = false;

    if (!api && !proxy) return;

    /* ---- Helpers ---- */
    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderMarkdown(raw) {
      var s = escapeHtml(String(raw == null ? '' : raw)).replace(/[\u0000-\u001f\u007f]/g, ' ');
      s = s.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '%%IMG%%$2%%/IMG%%');
      s = s.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
      s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
      s = s.replace(/^#{1,6}\s+/gm, '');
      s = s.replace(/^>\s+/gm, '');
      s = s.replace(/^-{3,}$/gm, '');
      s = s.replace(/^\*{3,}$/gm, '');
      s = s.replace(/\n+/g, '<br>');
      return s;
    }

    function extractImages(html) {
      var regex = /%%IMG%%([^%]+)%%\/IMG%%/g;
      var images = [];
      var match;
      while ((match = regex.exec(html)) !== null) images.push(match[1]);
      return { html: html.replace(regex, ''), images: images };
    }

    function formatTs(ts) {
      var d = ts ? new Date(ts * 1000) : null;
      if (!d || isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function formatTimeHm(ts) {
      var d = ts ? new Date(ts * 1000) : null;
      if (!d || isNaN(d.getTime())) return '';
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    /* ---- Image extraction from echo_files ---- */
    function getImages(item) {
      if (!Array.isArray(item.echo_files)) return [];
      return item.echo_files
        .map(function (entry) { return entry.file || entry; })
        .filter(function (f) {
          var cat = String(f && f.category || '').toLowerCase();
          var ct = String(f && f.content_type || '').toLowerCase();
          return cat === 'image' || ct.indexOf('image/') === 0;
        })
        .map(function (f) {
          var url = f && f.url;
          if (!url) return null;
          if (baseUrl && url.indexOf('/') === 0) return baseUrl + url;
          if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return url;
          return baseUrl ? baseUrl + '/' + url : url;
        })
        .filter(Boolean);
    }

    /* ---- Extension card builders ---- */
    function buildWebsiteCard(payload) {
      var site = payload.site || payload.url || '';
      var title = payload.title || site;
      return '<div class="memos-ext-card">' +
        '<div class="memos-ext-card__icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>' +
        '<div class="memos-ext-card__info">' +
          '<span class="memos-ext-card__label">网站</span>' +
          '<a href="' + escapeHtml(site) + '" target="_blank" rel="noopener" class="memos-ext-card__title">' + escapeHtml(title) + '</a>' +
          '<span class="memos-ext-card__url">' + escapeHtml(site.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</span>' +
        '</div>' +
        '<svg class="memos-ext-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      '</div>';
    }

    function buildGithubCard(payload) {
      var repoUrl = payload.repoUrl || payload.url || '';
      var title = payload.title || repoUrl.replace(/^https?:\/\/github\.com\//, '');
      return '<div class="memos-ext-card">' +
        '<div class="memos-ext-card__icon memos-ext-card__icon--gh"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg></div>' +
        '<div class="memos-ext-card__info">' +
          '<span class="memos-ext-card__label">GITHUB</span>' +
          '<a href="' + escapeHtml(repoUrl) + '" target="_blank" rel="noopener" class="memos-ext-card__title">' + escapeHtml(title) + '</a>' +
          '<span class="memos-ext-card__url">github.com</span>' +
        '</div>' +
        '<svg class="memos-ext-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      '</div>';
    }

    function buildMusicCard(payload) {
      var musicUrl = payload.url || '';
      return '<div class="memos-ext-card memos-ext-card--music">' +
        '<div class="memos-ext-card__icon memos-ext-card__icon--music"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>' +
        '<div class="memos-ext-card__info">' +
          '<span class="memos-ext-card__label">音乐</span>' +
          '<a href="' + escapeHtml(musicUrl) + '" target="_blank" rel="noopener" class="memos-ext-card__title">在音乐平台打开</a>' +
          '<span class="memos-ext-card__url">' + escapeHtml(musicUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40)) + '</span>' +
        '</div>' +
        '<svg class="memos-ext-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      '</div>';
    }

    function buildVideoCard(payload) {
      var videoId = payload.videoId || '';
      var videoUrl = payload.url || '';
      /* Bilibili */
      if (videoId && /^[Bb][Vv]/.test(videoId)) {
        return '<div class="memos-ext-video">' +
          '<iframe src="//player.bilibili.com/player.html?bvid=' + escapeHtml(videoId) + '&high_quality=1" scrolling="no" frameborder="0" allowfullscreen="true" loading="lazy"></iframe>' +
        '</div>';
      }
      /* YouTube */
      var ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?/]+)/);
      if (ytMatch) {
        return '<div class="memos-ext-video">' +
          '<iframe src="//www.youtube.com/embed/' + escapeHtml(ytMatch[1]) + '" scrolling="no" frameborder="0" allowfullscreen="true" loading="lazy"></iframe>' +
        '</div>';
      }
      /* Generic video link */
      if (videoUrl) {
        return '<div class="memos-ext-card">' +
          '<div class="memos-ext-card__icon memos-ext-card__icon--video"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>' +
          '<div class="memos-ext-card__info">' +
            '<span class="memos-ext-card__label">视频</span>' +
            '<a href="' + escapeHtml(videoUrl) + '" target="_blank" rel="noopener" class="memos-ext-card__title">观看视频</a>' +
          '</div>' +
          '<svg class="memos-ext-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
        '</div>';
      }
      return '';
    }

    function buildExtension(ext) {
      if (!ext || !ext.type || !ext.payload) return '';
      switch (ext.type) {
        case 'WEBSITE': return buildWebsiteCard(ext.payload);
        case 'GITHUBPROJ': return buildGithubCard(ext.payload);
        case 'MUSIC': return buildMusicCard(ext.payload);
        case 'VIDEO': return buildVideoCard(ext.payload);
        default: return '';
      }
    }

    /* ---- Card rendering ---- */
    function createCard(item) {
      var card = document.createElement('div');
      card.className = 'memos-card';

      var tape = document.createElement('span');
      tape.className = 'memos-card__tape';
      tape.setAttribute('aria-hidden', 'true');
      card.appendChild(tape);

      /* Text content */
      var rendered = renderMarkdown(item.content);
      var mdResult = extractImages(rendered);
      var mdImages = mdResult.images;
      var allImages = getImages(item).concat(mdImages);

      if (mdResult.html.trim()) {
        var content = document.createElement('div');
        content.className = 'memos-card__content';
        content.innerHTML = mdResult.html;
        card.appendChild(content);
      }

      /* Extension card */
      if (item.extension) {
        var extHtml = buildExtension(item.extension);
        if (extHtml) {
          var extWrap = document.createElement('div');
          extWrap.className = 'memos-card__ext';
          extWrap.innerHTML = extHtml;
          card.appendChild(extWrap);
        }
      }

      /* Images gallery */
      if (allImages.length) {
        var gallery = document.createElement('div');
        gallery.className = 'memos-card__gallery';
        allImages.forEach(function (src) {
          var link = document.createElement('a');
          link.href = src;
          link.dataset.fancybox = 'gallery';
          link.rel = 'noopener';
          link.className = 'memos-card__img-link';
          var img = document.createElement('img');
          img.src = src;
          img.alt = '';
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          img.className = 'memos-card__img';
          img.onerror = function () { link.style.display = 'none'; };
          link.appendChild(img);
          gallery.appendChild(link);
        });
        card.appendChild(gallery);
      }

      /* Footer */
      var tags = item.tags || [];
      var footer = document.createElement('div');
      footer.className = 'memos-card__footer';

      var meta = document.createElement('div');
      meta.className = 'memos-card__meta';
      var tagWrap = document.createElement('div');
      tagWrap.className = 'memos-card__tags';
      tags.forEach(function (t) {
        var name = typeof t === 'string' ? t : (t.name || '');
        if (!name) return;
        var tagEl = document.createElement('span');
        tagEl.className = 'memos-card__tag';
        tagEl.textContent = '#' + name;
        tagWrap.appendChild(tagEl);
      });
      meta.appendChild(tagWrap);
      footer.appendChild(meta);

      var rightActions = document.createElement('div');
      rightActions.className = 'memos-card__actions';

      if (item.createdAt) {
        var time = document.createElement('span');
        time.className = 'memos-card__time';
        time.textContent = formatTs(item.createdAt) + ' ' + formatTimeHm(item.createdAt);
        rightActions.appendChild(time);
      }

      if (item.originalUrl) {
        /* Quote button */
        var quoteBtn = document.createElement('button');
        quoteBtn.type = 'button';
        quoteBtn.className = 'memos-card__action-btn';
        quoteBtn.title = '引用说说';
        quoteBtn.setAttribute('aria-label', '引用说说');
        quoteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
        quoteBtn.addEventListener('click', function () {
          var quoteText = '> ' + item.content + '\n> [查看原说说](' + item.originalUrl + ')\n';
          var commentEl = document.getElementById('tcomment') || document.getElementById('artalk-comments') || document.querySelector('.comments-section');
          if (commentEl) {
            var ta = commentEl.querySelector('textarea') || commentEl.querySelector('.el-textarea__inner') || commentEl.querySelector('.tk-input textarea');
            if (ta) {
              var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              nativeSet.call(ta, ta.value + quoteText);
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.focus();
              commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              showToast('已填入引用，请点击发送');
            } else { window.open(item.originalUrl, '_blank'); }
          } else { window.open(item.originalUrl, '_blank'); }
        });
        rightActions.appendChild(quoteBtn);

        /* View original */
        var linkBtn = document.createElement('a');
        linkBtn.href = item.originalUrl;
        linkBtn.target = '_blank';
        linkBtn.rel = 'noopener';
        linkBtn.className = 'memos-card__action-btn';
        linkBtn.title = '查看原文';
        linkBtn.setAttribute('aria-label', '查看原文');
        linkBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
        rightActions.appendChild(linkBtn);
      }

      footer.appendChild(rightActions);
      card.appendChild(footer);

      return card;
    }

    /* ---- Normalize Ech0 items ---- */
    function normalize(list) {
      return list.map(function (item) {
        var raw = String(item && item.content || '');
        return {
          content: raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(),
          createdAt: item && item.created_at,
          tags: (item && item.tags) || [],
          pinned: Boolean(item && item.pinned),
          extension: item && item.extension ? item.extension : null,
          id: item && item.id ? String(item.id) : '',
          originalUrl: item && item.id ? baseUrl + '/echo/' + item.id : '',
          echo_files: item && item.echo_files
        };
      }).filter(function (item) { return item.content; }).sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }

    /* ---- Toast ---- */
    function showToast(msg) {
      var existing = document.querySelector('.memos-toast');
      if (existing) existing.remove();
      var t = document.createElement('div');
      t.className = 'memos-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      requestAnimationFrame(function () { t.classList.add('is-visible'); });
      setTimeout(function () {
        t.classList.remove('is-visible');
        setTimeout(function () { t.remove(); }, 400);
      }, 2200);
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

    /* ---- Load more ---- */
    function loadMore() {
      if (loadingMore || !hasMore) return;
      loadingMore = true;
      if (loading) loading.hidden = false;

      return fetchEch0({ page: page, pageSize: pageSize, search: '' }).then(function (data) {
        if (data.code !== 1 || !Array.isArray(data.data && data.data.items)) {
          throw new Error('Unexpected Ech0 response');
        }
        total = data.data.total || 0;
        var items = normalize(data.data.items);

        if (!items.length && !waterfall.children.length) {
          empty.hidden = false;
          if (loading) loading.hidden = true;
          return;
        }

        items.forEach(function (item) {
          waterfall.appendChild(createCard(item));
        });

        page++;
        hasMore = waterfall.children.length < total;

        /* Rebind lightbox */
        if (typeof Fancybox !== 'undefined') {
          Fancybox.bind('[data-fancybox="gallery"]', { Toolbar: { display: { infobar: false } } });
        }

        if (loading) loading.hidden = true;
        loadingMore = false;
      }).catch(function () {
        if (loading) loading.hidden = true;
        loadingMore = false;
        if (!waterfall.children.length) error.hidden = false;
      });
    }

    /* ---- Infinite scroll ---- */
    if (sentinel && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) loadMore(); });
      }, { rootMargin: '200px' });
      observer.observe(sentinel);
    } else {
      loadMore();
    }

    loadMore();
  }

  function boot() {
    document.querySelectorAll('.memos-page__feed').forEach(initMemosPage);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('pjax:complete', boot);
}());
