(function () {
  const LABEL = {
    en: 'Price upon request',
    ru: 'Цена по запросу',
    tg: 'Нарх бо дархост',
  };

  function lang() {
    return localStorage.getItem('td-lang') || 'en';
  }

  function label() {
    return LABEL[lang()] || LABEL.en;
  }

  function isTourPriceText(text) {
    const t = (text || '').trim();
    return /^\$[\d,]+(\s*\/\s*person)?$/i.test(t);
  }

  function patchPriceEl(el) {
    if (!el || el.dataset.tdPricePatched) return;
    const text = (el.textContent || '').trim();
    if (!isTourPriceText(text)) return;
    el.textContent = label();
    el.dataset.tdPricePatched = '1';
  }

  function scan(root) {
    if (!root) return;

    root.querySelectorAll('.td-dest-tour-price').forEach((el) => {
      el.textContent = label();
      el.dataset.tdPricePatched = '1';
    });

    root.querySelectorAll('.font-serif, [class*="font-serif"], [class*="hsl(35,65%,45%)"]').forEach(patchPriceEl);

    root.querySelectorAll('span, div, p, li').forEach((el) => {
      if (el.dataset.tdPricePatched) return;
      const text = (el.textContent || '').trim();
      if (!isTourPriceText(text)) return;
      if (el.querySelector('span, div')) {
        if (isTourPriceText(el.textContent)) patchPriceEl(el);
        return;
      }
      patchPriceEl(el);
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