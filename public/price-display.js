(function () {
  const LABEL = {
    en: 'Price upon request',
    ru: 'Цена по запросу',
    tg: 'Нарх бо дархост',
  };

  function label() {
    if (typeof window.__tdPriceUponRequestLabel === 'function') {
      return window.__tdPriceUponRequestLabel();
    }
    const lang = localStorage.getItem('td-lang') || 'en';
    return LABEL[lang] || LABEL.en;
  }

  function isZeroPriceText(text) {
    const t = (text || '').trim();
    return (
      t === '0' ||
      t === '$0' ||
      t === '$1' ||
      /^\$0(\s*\/?\s*person)?$/i.test(t) ||
      /^\$[\d,]+(\s*\/?\s*person)?$/i.test(t)
    );
  }

  function patchEl(el) {
    if (!el || el.dataset.tdPricePatched) return;
    const text = (el.textContent || '').trim();
    if (!isZeroPriceText(text)) return;
    el.textContent = label();
    el.dataset.tdPricePatched = '1';
  }

  function scan(root) {
    if (!root) return;
    root.querySelectorAll('.td-dest-tour-price').forEach((el) => {
      el.textContent = label();
      el.dataset.tdPricePatched = '1';
    });
    root.querySelectorAll('span, div, p, li').forEach((el) => {
      if (el.children.length <= 2) patchEl(el);
    });
  }

  document.addEventListener('DOMContentLoaded', () => scan(document.body));
  new MutationObserver(() => scan(document.body)).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener('td-lang-change', () => {
    document.querySelectorAll('[data-td-price-patched]').forEach((el) => {
      delete el.dataset.tdPricePatched;
    });
    scan(document.body);
  });
})();