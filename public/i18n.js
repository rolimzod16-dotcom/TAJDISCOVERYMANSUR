(function () {
  const SUPPORTED = ['en', 'ru', 'tg'];
  const STORAGE_KEY = 'td-lang';
  const LABELS = { en: 'EN', ru: 'RU', tg: 'TJ' };
  const FULL_NAMES = { en: 'English', ru: 'Русский', tg: 'Тоҷикӣ' };

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
  let menuOpen = false;

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

  function findNavActions() {
    const nav = document.querySelector('nav');
    if (!nav) return null;
    return (
      nav.querySelector('.flex.items-center.justify-end.gap-3') ||
      nav.querySelector('.flex.items-center.justify-end') ||
      nav.querySelector('[class*="justify-end"]')
    );
  }

  function closeMenu() {
    menuOpen = false;
    const menu = document.querySelector('.td-lang-menu');
    const toggle = document.querySelector('.td-lang-toggle');
    if (menu) menu.classList.remove('td-lang-menu--open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function injectStyles() {
    if (document.getElementById('td-i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-i18n-styles';
    style.textContent = `
      /* ── Navbar layout fix ── */
      nav .max-w-7xl[class*="grid"] {
        grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto) !important;
        gap: 12px !important;
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      nav .hidden.md\\:flex.items-center[class*="gap"] {
        justify-content: center;
        flex-wrap: nowrap;
        gap: 14px !important;
        min-width: 0;
        overflow: hidden;
      }
      nav .hidden.md\\:flex.items-center a,
      nav .hidden.md\\:flex.items-center button[type="button"] {
        white-space: nowrap !important;
        flex-shrink: 0;
        font-size: 0.56rem !important;
        letter-spacing: 0.14em !important;
      }
      html[lang="ru"] nav .hidden.md\\:flex.items-center a,
      html[lang="ru"] nav .hidden.md\\:flex.items-center button[type="button"],
      html[lang="tg"] nav .hidden.md\\:flex.items-center a,
      html[lang="tg"] nav .hidden.md\\:flex.items-center button[type="button"] {
        font-size: 0.52rem !important;
        letter-spacing: 0.11em !important;
      }
      @media (min-width: 1100px) {
        nav .hidden.md\\:flex.items-center[class*="gap"] { gap: 18px !important; }
        nav .hidden.md\\:flex.items-center a,
        nav .hidden.md\\:flex.items-center button[type="button"] {
          font-size: 0.58rem !important;
        }
      }
      @media (min-width: 1280px) {
        nav .hidden.md\\:flex.items-center[class*="gap"] { gap: 24px !important; }
        nav .hidden.md\\:flex.items-center a,
        nav .hidden.md\\:flex.items-center button[type="button"] {
          font-size: 0.6rem !important;
        }
      }
      nav .flex.items-center.justify-end {
        flex-shrink: 0;
        gap: 10px !important;
        margin-left: auto;
      }
      a.btn-luxury {
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        padding-left: 16px !important;
        padding-right: 16px !important;
        font-size: 0.56rem !important;
      }

      /* ── Language dropdown ── */
      #td-lang-switcher {
        position: relative;
        flex-shrink: 0;
        font-family: Inter, system-ui, sans-serif;
      }
      .td-lang-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 3px;
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.88);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: border-color .2s, background .2s;
        line-height: 1;
      }
      .td-lang-toggle:hover,
      .td-lang-toggle[aria-expanded="true"] {
        border-color: rgba(212,168,83,0.55);
        background: rgba(212,168,83,0.1);
        color: #fff;
      }
      .td-lang-toggle svg { flex-shrink: 0; opacity: 0.75; }
      .td-lang-toggle .td-lang-chevron {
        transition: transform .2s;
        width: 10px; height: 10px;
      }
      .td-lang-toggle[aria-expanded="true"] .td-lang-chevron {
        transform: rotate(180deg);
      }
      .td-lang-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        min-width: 130px;
        background: hsl(218,60%,8%);
        border: 1px solid rgba(212,168,83,0.35);
        border-radius: 4px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.45);
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-4px);
        transition: opacity .15s, transform .15s, visibility .15s;
        z-index: 100001;
      }
      .td-lang-menu--open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      .td-lang-menu button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 10px 14px;
        border: none;
        background: transparent;
        color: rgba(255,255,255,0.82);
        font-size: 11px;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: background .15s;
      }
      .td-lang-menu button:hover { background: rgba(255,255,255,0.07); }
      .td-lang-menu button.active {
        color: hsl(35,65%,55%);
        background: rgba(212,168,83,0.12);
      }
      .td-lang-menu button + button {
        border-top: 1px solid rgba(255,255,255,0.08);
      }

      @media (max-width: 1280px) {
        .absolute.bottom-8.right-10.hidden.md\\:flex { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const GLOBE_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  const CHEVRON_SVG = `<svg class="td-lang-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>`;

  function renderSwitcher() {
    if (window.location.pathname.startsWith('/admin')) return;

    injectStyles();

    const actions = findNavActions();
    if (!actions) return;

    let wrap = document.getElementById('td-lang-switcher');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'td-lang-switcher';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'td-lang-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-haspopup', 'listbox');
      toggle.innerHTML = `${GLOBE_SVG}<span class="td-lang-current">${LABELS[currentLang]}</span>${CHEVRON_SVG}`;
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menuOpen = !menuOpen;
        const menu = wrap.querySelector('.td-lang-menu');
        if (menu) menu.classList.toggle('td-lang-menu--open', menuOpen);
        toggle.setAttribute('aria-expanded', String(menuOpen));
      });

      const menu = document.createElement('div');
      menu.className = 'td-lang-menu';
      menu.setAttribute('role', 'listbox');

      wrap.appendChild(toggle);
      wrap.appendChild(menu);

      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) closeMenu();
      });

      const bookBtn = actions.querySelector('a.btn-luxury, a[href*="#book"]');
      if (bookBtn) actions.insertBefore(wrap, bookBtn);
      else actions.prepend(wrap);
    }

    const menu = wrap.querySelector('.td-lang-menu');
    const currentLabel = wrap.querySelector('.td-lang-current');
    if (currentLabel) currentLabel.textContent = LABELS[currentLang];

    if (menu) {
      menu.replaceChildren();
      SUPPORTED.forEach((lang) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.lang = lang;
        btn.textContent = FULL_NAMES[lang];
        btn.className = lang === currentLang ? 'active' : '';
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', String(lang === currentLang));
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          setLang(lang);
        });
        menu.appendChild(btn);
      });
    }
  }

  function scheduleApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderSwitcher();
      applyTranslations();
    }, 120);
  }

  async function init() {
    currentLang = readLang();
    persistLang(currentLang);

    renderSwitcher();

    await loadDict(currentLang);
    updateMeta();
    applyTranslations();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(renderSwitcher, 2000);

    window.TD_I18N = { getLang: () => currentLang, setLang, t, apply: applyTranslations };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();