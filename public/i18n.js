(function () {
  const SUPPORTED = ['en', 'ru', 'tg'];
  const STORAGE_KEY = 'td-lang';
  const LABELS = { en: 'EN', ru: 'RU', tg: 'TJ' };

  let currentLang = 'en';
  let dict = {};
  let loaded = false;
  let applying = false;
  let debounceTimer = null;

  function parseLangFromPath() {
    const m = location.pathname.match(/^\/(en|ru|tg)(?=\/|$)/);
    return m ? m[1] : null;
  }

  function getLang() {
    const pathLang = parseLangFromPath();
    if (pathLang) return pathLang;
    const q = new URLSearchParams(location.search).get('lang');
    if (q && SUPPORTED.includes(q)) return q;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('tg') || nav.startsWith('tj')) return 'tg';
    return 'en';
  }

  function normalizeUrlPrefix() {
    const pathLang = parseLangFromPath();
    if (!pathLang) return;
    const newPath = location.pathname.replace(/^\/(en|ru|tg)/, '') || '/';
    history.replaceState({}, '', newPath + location.search + location.hash);
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
        for (const [k] of Object.entries(en)) {
          dict[k] = loc[k] || k;
        }
      }
    } catch (_) {
      dict = {};
    }
    loaded = true;
  }

  function t(text) {
    if (!text || currentLang === 'en') return text;
    const trimmed = String(text).trim();
    return dict[trimmed] ?? text;
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

    const descs = {
      en: 'Boutique Tajikistan travel agency crafting private expeditions along the Pamir Highway, Wakhan Corridor, Fann Mountains and Silk Road.',
      ru: 'Бутик-агентство путешествий по Таджикистану: частные экспедиции по Памирскому тракту, коридору Вахан, горам Фанн и Великому шёлковому пути.',
      tg: 'Агентии сафари бутикии Тоҷикистон: экспедитсияҳои хусусӣ дар Роҳи Помир, дарҳи Вахон, кӯҳҳои Фон ва Роҳи Абрешим.',
    };
    const desc = document.querySelector('meta[name="description"]');
    if (desc && descs[currentLang]) desc.content = descs[currentLang];

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

  function scheduleApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      ensureSwitcher();
      applyTranslations();
    }, 80);
  }

  function injectStyles() {
    if (document.getElementById('td-i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-i18n-styles';
    style.textContent = `
      #td-lang-switcher {
        position: fixed;
        top: 14px;
        right: 14px;
        z-index: 99999;
        display: inline-flex;
        align-items: center;
        gap: 0;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
        border: 1px solid rgba(212,168,83,0.45);
        background: hsl(218,60%,8%);
        font-family: Inter, system-ui, sans-serif;
      }
      #td-lang-switcher button {
        font-size: 11px;
        letter-spacing: 0.12em;
        font-weight: 700;
        padding: 9px 12px;
        border: none;
        border-right: 1px solid rgba(255,255,255,0.1);
        background: transparent;
        color: rgba(255,255,255,0.75);
        cursor: pointer;
        transition: all .15s ease;
        min-width: 36px;
      }
      #td-lang-switcher button:last-child { border-right: none; }
      #td-lang-switcher button:hover {
        color: hsl(35,65%,55%);
        background: rgba(255,255,255,0.06);
      }
      #td-lang-switcher button.active {
        background: hsl(35,65%,45%);
        color: white;
      }
      @media (min-width: 768px) {
        #td-lang-switcher {
          top: 18px;
          right: 180px;
        }
      }
      @media (min-width: 1024px) {
        #td-lang-switcher { right: 200px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureSwitcher() {
    if (window.location.pathname.startsWith('/admin')) return;

    injectStyles();

    let wrap = document.getElementById('td-lang-switcher');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'td-lang-switcher';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Language');
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-lang]');
        if (btn) setLang(btn.dataset.lang);
      });
      document.body.appendChild(wrap);
    } else if (!document.body.contains(wrap)) {
      document.body.appendChild(wrap);
    }

    wrap.innerHTML = SUPPORTED.map(
      (l) =>
        `<button type="button" data-lang="${l}" class="${l === currentLang ? 'active' : ''}" aria-pressed="${l === currentLang}">${LABELS[l]}</button>`
    ).join('');
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLang) return;
    localStorage.setItem(STORAGE_KEY, lang);
    const url = new URL(location.href);
    if (lang === 'en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    location.href = url.pathname + url.search + url.hash;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (url, options) {
    let href = typeof url === 'string' ? url : url?.url || '';
    if (
      currentLang !== 'en' &&
      href.startsWith('/') &&
      href.includes('/api/') &&
      !href.includes('/api/storage/')
    ) {
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

  async function init() {
    normalizeUrlPrefix();
    currentLang = getLang();
    localStorage.setItem(STORAGE_KEY, currentLang);

    ensureSwitcher();

    await loadDict(currentLang);
    updateMeta();
    applyTranslations();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(ensureSwitcher, 2000);

    window.addEventListener('popstate', scheduleApply);
    window.TD_I18N = { getLang: () => currentLang, setLang, t, apply: applyTranslations };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();