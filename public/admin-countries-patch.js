(function () {
  if (!window.location.pathname.startsWith('/admin')) return;

  const COUNTRIES = [
    { slug: 'tajikistan', label: 'Tajikistan' },
    { slug: 'uzbekistan', label: 'Uzbekistan' },
    { slug: 'kyrgyzstan', label: 'Kyrgyzstan' },
    { slug: 'kazakhstan', label: 'Kazakhstan' },
    { slug: 'china', label: 'China' },
    { slug: 'pakistan', label: 'Pakistan' },
    { slug: 'afghanistan', label: 'Afghanistan' },
  ];

  let selected = new Set();
  let editingTourId = null;

  function injectStyles() {
    if (document.getElementById('td-admin-countries-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-admin-countries-styles';
    style.textContent = `
      .td-admin-countries-wrap {
        grid-column: span 2;
        border: 1px solid #e5e7eb;
        border-radius: 2px;
        padding: 14px 16px;
        background: #fafafa;
      }
      .td-admin-countries-wrap label.title {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 10px;
        color: #111827;
      }
      .td-admin-countries-wrap .hint {
        font-size: 0.75rem;
        color: #6b7280;
        margin-bottom: 10px;
      }
      .td-admin-countries-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      @media (min-width: 640px) {
        .td-admin-countries-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      .td-admin-country-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        color: #374151;
        cursor: pointer;
        user-select: none;
      }
      .td-admin-country-item input {
        width: 14px;
        height: 14px;
        accent-color: #0a1530;
      }
    `;
    document.head.appendChild(style);
  }

  function getSelected() {
    return [...selected];
  }

  function setSelected(slugs) {
    selected = new Set(slugs || []);
    syncCheckboxes();
  }

  function syncCheckboxes() {
    document.querySelectorAll('.td-admin-country-item input[type="checkbox"]').forEach((cb) => {
      cb.checked = selected.has(cb.value);
    });
  }

  function findTourDialog() {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    return dialogs.find((d) => {
      const title = d.textContent || '';
      return title.includes('Add New Tour') || title.includes('Edit Tour');
    });
  }

  function findTourForm(dialog) {
    return dialog?.querySelector('form');
  }

  function getFormTourName(form) {
    const inputs = [...form.querySelectorAll('input')];
    const nameInput = inputs.find((inp) => {
      const label = inp.closest('div')?.parentElement?.querySelector('label');
      return label?.textContent?.trim() === 'Tour Name';
    });
    return nameInput?.value?.trim() || '';
  }

  async function loadCountriesForTourId(id) {
    if (!id) return;
    try {
      const res = await fetch(`/api/tours/${id}`);
      if (!res.ok) return;
      const tour = await res.json();
      editingTourId = tour.id;
      setSelected(tour.countries || []);
    } catch (_) {}
  }

  async function loadCountriesForEdit(form) {
    const title = findTourDialog()?.textContent || '';
    if (!title.includes('Edit Tour')) {
      editingTourId = null;
      return;
    }

    if (editingTourId) {
      await loadCountriesForTourId(editingTourId);
      return;
    }

    try {
      const res = await fetch('/api/tours');
      if (!res.ok) return;
      const tours = await res.json();
      const name = getFormTourName(form);
      const tour = tours.find((t) => t.name === name);
      if (tour) await loadCountriesForTourId(tour.id);
    } catch (_) {}
  }

  function injectCountriesField() {
    const dialog = findTourDialog();
    const form = findTourForm(dialog);
    if (!form || form.querySelector('.td-admin-countries-wrap')) return;

    injectStyles();

    const grid = form.querySelector('.grid');
    if (!grid) return;

    const wrap = document.createElement('div');
    wrap.className = 'td-admin-countries-wrap';

    const title = document.createElement('label');
    title.className = 'title';
    title.textContent = 'Destination Countries';

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Select countries for destination filtering on the website.';

    const gridBox = document.createElement('div');
    gridBox.className = 'td-admin-countries-grid';

    COUNTRIES.forEach(({ slug, label }) => {
      const item = document.createElement('label');
      item.className = 'td-admin-country-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = slug;
      cb.checked = selected.has(slug);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(slug);
        else selected.delete(slug);
      });

      const text = document.createElement('span');
      text.textContent = label;

      item.appendChild(cb);
      item.appendChild(text);
      gridBox.appendChild(item);
    });

    wrap.appendChild(title);
    wrap.appendChild(hint);
    wrap.appendChild(gridBox);

    const highlightsField = [...grid.children].find((el) => el.textContent?.includes('Highlights'));
    if (highlightsField) grid.insertBefore(wrap, highlightsField);
    else grid.appendChild(wrap);

    void loadCountriesForEdit(form);
  }

  function resetOnNewTour() {
    const dialog = findTourDialog();
    if (dialog?.textContent?.includes('Add New Tour')) {
      editingTourId = null;
      setSelected([]);
    }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (url, options) {
    const href = typeof url === 'string' ? url : url?.url || '';
    const method = (options?.method || 'GET').toUpperCase();

    const subResource = href.match(/\/api\/tours\/(\d+)\/(highlights|itinerary|inclusions|faqs|images)/);
    if (subResource) editingTourId = Number(subResource[1]);

    const putMatch = href.match(/\/api\/tours\/(\d+)$/);
    if (putMatch && method === 'PUT') editingTourId = Number(putMatch[1]);

    if (href.match(/\/api\/tours(\/\d+)?$/) && (method === 'POST' || method === 'PUT')) {
      const countries = getSelected();
      if (options?.body && typeof options.body === 'string') {
        try {
          const body = JSON.parse(options.body);
          body.countries = countries;
          options = { ...options, body: JSON.stringify(body) };
        } catch (_) {}
      }
    }

    const response = await originalFetch(url, options);

    if (href.match(/\/api\/tours(\/\d+)?$/) && method === 'POST' && response.ok) {
      selected.clear();
      syncCheckboxes();
    }

    return response;
  };

  function init() {
    resetOnNewTour();
    injectCountriesField();
  }

  const observer = new MutationObserver(() => init());
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();