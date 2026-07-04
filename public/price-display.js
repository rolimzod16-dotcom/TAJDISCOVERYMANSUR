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

  function isOnRequestPrice(text) {
    const t = (text || '').trim();
    return /^\$0(\s*\/\s*person)?$/i.test(t) || t === '$1' || t === '1';
  }

  function patchEl(el) {
    if (!el || el.dataset.tdPricePatched) return;
    const text = (el.textContent || '').trim();
    if (!isOnRequestPrice(text)) return;

    const person = el.querySelector('span');
    if (person && /person/i.test(person.textContent)) {
      el.textContent = label() + ' ';
      el.appendChild(person);
    } else {
      el.textContent = label();
    }
    el.dataset.tdPricePatched = '1';
  }

  function scan(root) {
    if (!root) return;
    root.querySelectorAll('.td-dest-tour-price').forEach((el) => {
      const n = Number((el.textContent || '').replace(/[^\d]/g, ''));
      if (!n || n <= 0) {
        el.textContent = label();
        el.dataset.tdPricePatched = '1';
      }
    });

    root.querySelectorAll('.font-serif, [class*="font-serif"]').forEach(patchEl);
    root.querySelectorAll('span, div, p').forEach((el) => {
      if (el.children.length === 0) patchEl(el);
      else if (el.children.length <= 2 && isOnRequestPrice(el.textContent)) patchEl(el);
    });
  }

  document.addEventListener('DOMContentLoaded', () => scan(document.body));
  new MutationObserver(() => scan(document.body)).observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('td-lang-change', () => {
    document.querySelectorAll('[data-td-price-patched]').forEach((el) => {
      delete el.dataset.tdPricePatched;
    });
    scan(document.body);
  });
})();