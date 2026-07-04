(function () {
  const SUPPORTED = ['en', 'ru', 'tg'];
  const STORAGE_KEY = 'td-lang';
  const LABELS = { en: 'EN', ru: 'RU', tg: 'TJ' };
  const FULL_NAMES = { en: 'English', ru: 'Русский', tg: 'Тоҷикӣ' };

  function readLang() {
    if (window.__TD_LANG__ && SUPPORTED.includes(window.__TD_LANG__)) return window.__TD_LANG__;
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q && SUPPORTED.includes(q)) return q;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    return 'en';
  }

  function langHref(lang) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    url.searchParams.delete('_lc');
    return url.pathname + url.search + url.hash;
  }

  let currentLang = readLang();
  let dict = {};
  let loaded = false;
  let applying = false;
  let debounceTimer = null;
  let switcherReady = false;

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
      if (!node.__tdOriginal) node.__tdOriginal = core;
      const translated = currentLang === 'en' ? node.__tdOriginal : t(node.__tdOriginal);
      if (translated !== raw.trim()) node.textContent = lead + translated + trail;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || shouldSkip(node)) return;

    ['placeholder', 'title', 'aria-label'].forEach((attr) => {
      const val = node.getAttribute(attr);
      if (!val) return;
      const key = '__tdOrig_' + attr;
      if (!node[key]) node[key] = val;
      const tr = currentLang === 'en' ? node[key] : t(node[key].trim());
      if (tr !== val) node.setAttribute(attr, tr);
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
    if (!loaded || applying) return;
    applying = true;
    try {
      if (currentLang !== 'en') translateNode(document.body);
      updateMeta();
    } finally {
      applying = false;
    }
  }

  function goLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    window.__TD_LANG__ = lang;
    try {
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = langHref(lang);
  }

  function findNavActions() {
    const nav = document.querySelector('nav');
    if (!nav) return null;
    return nav.querySelector('.flex.items-center.justify-end.gap-3') || nav.querySelector('.flex.items-center.justify-end');
  }

  function injectStyles() {
    if (document.getElementById('td-i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-i18n-styles';
    style.textContent = `
      nav, nav .max-w-7xl, nav .flex.items-center.justify-end { overflow: visible !important; }
      nav .max-w-7xl[class*="grid"] {
        grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto) !important;
        gap: 12px !important;
      }
      nav .hidden.md\\:flex.items-center[class*="gap"] {
        justify-content: center; gap: 14px !important; min-width: 0;
      }
      nav .hidden.md\\:flex.items-center a,
      nav .hidden.md\\:flex.items-center button[type="button"] {
        white-space: nowrap !important; flex-shrink: 0;
        font-size: 0.56rem !important; letter-spacing: 0.14em !important;
      }
      html[lang="ru"] nav .hidden.md\\:flex.items-center a,
      html[lang="ru"] nav .hidden.md\\:flex.items-center button[type="button"],
      html[lang="tg"] nav .hidden.md\\:flex.items-center a,
      html[lang="tg"] nav .hidden.md\\:flex.items-center button[type="button"] {
        font-size: 0.52rem !important; letter-spacing: 0.11em !important;
      }
      @media (min-width: 1280px) {
        nav .hidden.md\\:flex.items-center[class*="gap"] { gap: 22px !important; }
      }
      nav .flex.items-center.justify-end { flex-shrink: 0; gap: 10px !important; }
      a.btn-luxury { white-space: nowrap !important; flex-shrink: 0 !important; }

      #td-lang-switcher { position: relative; flex-shrink: 0; z-index: 100002; }
      .td-lang-toggle {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 11px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;
        background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.9);
        font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
        cursor: pointer; text-decoration: none; line-height: 1;
      }
      .td-lang-toggle:hover, #td-lang-switcher.td-lang-open .td-lang-toggle {
        border-color: rgba(212,168,83,0.6); background: rgba(212,168,83,0.12); color: #fff;
      }
      .td-lang-chevron { width: 10px; height: 10px; transition: transform .2s; opacity: 0.7; }
      #td-lang-switcher.td-lang-open .td-lang-chevron { transform: rotate(180deg); }
      .td-lang-menu {
        position: absolute; top: calc(100% + 6px); right: 0; min-width: 140px;
        background: hsl(218,60%,8%); border: 1px solid rgba(212,168,83,0.4); border-radius: 4px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.5); z-index: 100003;
        display: none;
      }
      #td-lang-switcher.td-lang-open .td-lang-menu { display: block; }
      .td-lang-menu a {
        display: block; padding: 11px 16px; color: rgba(255,255,255,0.85);
        font-size: 12px; text-decoration: none; letter-spacing: 0.02em;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .td-lang-menu a:last-child { border-bottom: none; }
      .td-lang-menu a:hover { background: rgba(255,255,255,0.08); color: #fff; }
      .td-lang-menu a.active { color: hsl(35,65%,55%); background: rgba(212,168,83,0.1); }
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
    const actions = findNavActions();
    if (!actions) return;

    injectStyles();

    let wrap = document.getElementById('td-lang-switcher');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'td-lang-switcher';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'td-lang-toggle';
      toggle.innerHTML = `${GLOBE_SVG}<span class="td-lang-current">${LABELS[currentLang]}</span>${CHEVRON_SVG}`;
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrap.classList.toggle('td-lang-open');
      });

      const menu = document.createElement('div');
      menu.className = 'td-lang-menu';
      SUPPORTED.forEach((lang) => {
        const link = document.createElement('a');
        link.href = langHref(lang);
        link.textContent = FULL_NAMES[lang];
        link.className = lang === currentLang ? 'active' : '';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          goLang(lang);
        });
        menu.appendChild(link);
      });

      wrap.appendChild(toggle);
      wrap.appendChild(menu);

      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) wrap.classList.remove('td-lang-open');
      });

      const bookBtn = actions.querySelector('a.btn-luxury, a[href*="#book"]');
      if (bookBtn) actions.insertBefore(wrap, bookBtn);
      else actions.prepend(wrap);

      switcherReady = true;
    } else {
      const label = wrap.querySelector('.td-lang-current');
      if (label) label.textContent = LABELS[currentLang];
      wrap.querySelectorAll('.td-lang-menu a').forEach((a, i) => {
        const lang = SUPPORTED[i];
        if (lang) {
          a.href = langHref(lang);
          a.className = lang === currentLang ? 'active' : '';
        }
      });
    }
  }

  function scheduleApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!switcherReady) renderSwitcher();
      applyTranslations();
    }, 150);
  }

  async function init() {
    currentLang = readLang();
    renderSwitcher();

    await loadDict(currentLang);
    updateMeta();
    applyTranslations();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    window.TD_I18N = { getLang: () => currentLang, setLang: goLang, t, apply: applyTranslations };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();