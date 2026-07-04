(function () {
  const SUPPORTED = ['en', 'ru', 'tg'];
  const STORAGE_KEY = 'td-lang';
  const LABELS = { en: 'EN', ru: 'RU', tg: 'TJ' };

  function readLang() {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q && SUPPORTED.includes(q)) return q;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('tg') || nav.startsWith('tj')) return 'tg';
    return 'en';
  }

  let currentLang = readLang();
  let dict = {};
  let loaded = false;
  let applying = false;
  let debounceTimer = null;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (url, options) {
    let href = typeof url === 'string' ? url : url?.url || '';
    if (href.startsWith('/') && href.includes('/api/') && !href.includes('/api/storage/')) {
      const u = new URL(href, location.origin);
      if (!u.searchParams.has('lang')) {
        u.searchParams.set('lang', currentLang);
        href = u.pathname + u.search;
        if (typeof url === 'string') url = href;
        else url = new Request(href, url);
      }
    }
    return originalFetch(url, options);
  };

  function persistLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    const url = new URL(location.href);
    if (lang === 'en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    url.searchParams.delete('_lc');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  async function loadDict(lang) {
    try {
      const enRes = await fetch('/locales/en.json');
      const en = await enRes.json();
      dict = {};
      if (lang === 'en') {
        for (const k of Object.keys(en)) dict[k] = k;
      } else {
        const locRes = await fetch(`/locales/${lang}.json`);
        const loc = await locRes.json();
        for (const [k] of Object.entries(en)) dict[k] = loc[k] || k;
      }
    } catch (_) {
      dict = {};
    }
    loaded = true;
  }

  function t(text) {
    if (!text || currentLang === 'en') return text;
    return dict[String(text).trim()] ?? text;
  }

  function shouldSkip(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.id === 'td-lang-switcher' || el.closest?.('#td-lang-switcher')) return true;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') return true;
    return false;
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent;
      if (!raw || !/\S/.test(raw)) return;
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      const core = raw.trim();
      const translated = t(core);
      if (translated !== core) node.textContent = lead + translated + trail;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || shouldSkip(node)) return;

    ['placeholder', 'title', 'aria-label'].forEach((attr) => {
      const val = node.getAttribute(attr);
      if (!val) return;
      const tr = t(val.trim());
      if (tr !== val.trim()) node.setAttribute(attr, tr);
    });

    for (const child of [...node.childNodes]) translateNode(child);
  }

  function updateMeta() {
    const titles = {
      en: 'TajDiscovery — Luxury Tajikistan Travel & Pamir Highway Expeditions',
      ru: 'TajDiscovery — Роскошные путешествия по Таджикистану и экспедиции по Памирскому тракту',
      tg: 'TajDiscovery — Сафарҳои люкс ба Тоҷикистон ва экспедитсияҳои Роҳи Помир',
    };
    document.title = titles[currentLang] || titles.en;
    document.documentElement.lang = currentLang === 'tg' ? 'tg' : currentLang;
  }

  function applyTranslations() {
    if (!loaded || applying || currentLang === 'en') return;
    applying = true;
    try {
      translateNode(document.body);
      updateMeta();
    } finally {
      applying = false;
    }
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLang) return;
    localStorage.setItem(STORAGE_KEY, lang);
    const url = new URL(location.href);
    if (lang === 'en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    url.searchParams.set('_lc', String(Date.now()));
    window.location.replace(url.toString());
  }

  function injectStyles() {
    if (document.getElementById('td-i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-i18n-styles';
    style.textContent = `
      #td-lang-switcher {
        position: fixed;
        z-index: 100000;
        display: inline-flex;
        align-items: center;
        gap: 0;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(212,168,83,0.5);
        background: hsl(218,60%,8%);
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        font-family: Inter, system-ui, sans-serif;
        pointer-events: auto;
      }
      #td-lang-switcher button {
        font-size: 11px;
        letter-spacing: 0.12em;
        font-weight: 700;
        padding: 8px 11px;
        border: none;
        border-right: 1px solid rgba(255,255,255,0.15);
        background: transparent;
        color: rgba(255,255,255,0.85);
        cursor: pointer;
        line-height: 1;
        pointer-events: auto;
      }
      #td-lang-switcher button:last-child { border-right: none; }
      #td-lang-switcher button:hover { background: rgba(255,255,255,0.1); color: #fff; }
      #td-lang-switcher button.active {
        background: hsl(35,65%,45%);
        color: #fff;
      }
      a.btn-luxury {
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        max-width: none !important;
      }
      nav .flex.items-center.justify-end {
        flex-shrink: 0;
        gap: 8px !important;
      }
      nav .max-w-7xl {
        gap: 8px;
      }
      nav .hidden.lg\\:flex, nav [class*="lg:flex"] {
        gap: 6px !important;
      }
      .writing-mode-vertical.rotate-90 {
        transform-origin: center center;
        margin-right: 8px;
      }
      @media (max-width: 1280px) {
        .absolute.bottom-8.right-10.hidden.md\\:flex {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function positionSwitcher() {
    const wrap = document.getElementById('td-lang-switcher');
    if (!wrap) return;

    const bookBtn =
      document.querySelector('a.btn-luxury[href*="#book"]') ||
      document.querySelector('a.btn-luxury');
    const menuBtn = document.querySelector('button[aria-label="Toggle menu"]');

    if (bookBtn && bookBtn.offsetParent !== null) {
      const r = bookBtn.getBoundingClientRect();
      wrap.style.top = `${Math.round(r.top + (r.height - wrap.offsetHeight) / 2)}px`;
      wrap.style.left = `${Math.round(r.left - wrap.offsetWidth - 10)}px`;
      wrap.style.right = 'auto';
      return;
    }

    if (menuBtn) {
      const r = menuBtn.getBoundingClientRect();
      wrap.style.top = `${Math.round(r.top + (r.height - wrap.offsetHeight) / 2)}px`;
      wrap.style.left = 'auto';
      wrap.style.right = `${Math.round(window.innerWidth - r.left + 8)}px`;
      return;
    }

    wrap.style.top = '18px';
    wrap.style.right = '16px';
    wrap.style.left = 'auto';
  }

  function renderSwitcher() {
    if (window.location.pathname.startsWith('/admin')) return;

    injectStyles();

    let wrap = document.getElementById('td-lang-switcher');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'td-lang-switcher';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Language');
      document.body.appendChild(wrap);
    }

    wrap.replaceChildren();
    SUPPORTED.forEach((lang) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.lang = lang;
      btn.textContent = LABELS[lang];
      btn.className = lang === currentLang ? 'active' : '';
      btn.setAttribute('aria-pressed', String(lang === currentLang));
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setLang(lang);
      });
      wrap.appendChild(btn);
    });

    requestAnimationFrame(positionSwitcher);
  }

  function scheduleApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderSwitcher();
      applyTranslations();
    }, 100);
  }

  async function init() {
    currentLang = readLang();
    persistLang(currentLang);

    renderSwitcher();
    window.addEventListener('resize', positionSwitcher);
    window.addEventListener('scroll', positionSwitcher, { passive: true });

    await loadDict(currentLang);
    updateMeta();
    applyTranslations();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
      renderSwitcher();
      positionSwitcher();
    }, 800);

    window.TD_I18N = {
      getLang: () => currentLang,
      setLang,
      t,
      apply: applyTranslations,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();