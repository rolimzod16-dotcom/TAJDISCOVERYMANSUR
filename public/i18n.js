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

  function findNavSlot() {
    const bookBtn =
      document.querySelector('a.btn-luxury[href*="#book"]') ||
      [...document.querySelectorAll('a[href*="#book"]')].find((a) => a.classList.contains('btn-luxury'));

    if (bookBtn?.parentElement) {
      return { parent: bookBtn.parentElement, before: bookBtn };
    }

    const menuBtn = document.querySelector('button[aria-label="Toggle menu"]');
    if (menuBtn?.parentElement) {
      return { parent: menuBtn.parentElement, before: menuBtn };
    }

    const nav = document.querySelector('nav');
    const actions = nav?.querySelector('.flex.items-center.justify-end');
    if (actions) return { parent: actions, before: null };

    return null;
  }

  function injectStyles() {
    if (document.getElementById('td-i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-i18n-styles';
    style.textContent = `
      #td-lang-switcher {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        border-radius: 3px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.22);
        background: rgba(10,21,48,0.55);
        font-family: Inter, system-ui, sans-serif;
        margin-right: 4px;
      }
      #td-lang-switcher button {
        font-size: 10px;
        letter-spacing: 0.1em;
        font-weight: 700;
        padding: 7px 9px;
        border: none;
        border-right: 1px solid rgba(255,255,255,0.12);
        background: transparent;
        color: rgba(255,255,255,0.8);
        cursor: pointer;
        transition: all .15s ease;
        line-height: 1;
      }
      #td-lang-switcher button:last-child { border-right: none; }
      #td-lang-switcher button:hover {
        color: hsl(35,65%,60%);
        background: rgba(255,255,255,0.08);
      }
      #td-lang-switcher button.active {
        background: hsl(35,65%,45%);
        color: #fff;
      }
      @media (min-width: 768px) {
        #td-lang-switcher { margin-right: 10px; }
        #td-lang-switcher button {
          font-size: 10px;
          padding: 8px 10px;
        }
      }
      nav .flex.items-center.justify-end { flex-wrap: nowrap; }
      a.btn-luxury { white-space: nowrap; flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  }

  function ensureSwitcher() {
    if (window.location.pathname.startsWith('/admin')) return;

    injectStyles();

    const slot = findNavSlot();
    if (!slot) return;

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
    }

    if (slot.before) slot.parent.insertBefore(wrap, slot.before);
    else slot.parent.appendChild(wrap);

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

    setInterval(ensureSwitcher, 1500);

    window.addEventListener('popstate', scheduleApply);
    window.TD_I18N = { getLang: () => currentLang, setLang, t, apply: applyTranslations };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();