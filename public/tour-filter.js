(function () {
  function tr(text) {
    return window.TD_I18N?.t?.(text) ?? text;
  }

  const DESTINATIONS = [
    { slug: 'tajikistan', country: 'Tajikistan' },
    { slug: 'uzbekistan', country: 'Uzbekistan' },
    { slug: 'kyrgyzstan', country: 'Kyrgyzstan' },
    { slug: 'kazakhstan', country: 'Kazakhstan' },
    { slug: 'china', country: 'China' },
    { slug: 'pakistan', country: 'Pakistan' },
    { slug: 'afghanistan', country: 'Afghanistan' },
  ];

  const KEYWORDS = {
    tajikistan: ['tajikistan', 'dushanbe', 'pamir', 'wakhan', 'fann', 'panjakent', 'iskanderkul', 'bartang', 'hissor', 'khorog', 'pamiri', 'sughd', 'khatlon', 'artuch', 'somoni', 'chilichorchama'],
    uzbekistan: ['uzbekistan', 'samarqand', 'samarkand', 'bukhara', 'khiva', 'fergana', 'uzbek'],
    kyrgyzstan: ['kyrgyzstan', 'osh', 'karakul', 'bishkek', 'lenin peak'],
    kazakhstan: ['kazakhstan', 'almaty', 'astana'],
    china: ['china', 'chinese'],
    pakistan: ['pakistan', 'karakoram'],
    afghanistan: ['afghanistan', 'hindu kush'],
  };

  function tourMatchesCountry(tour, slug) {
    if (Array.isArray(tour.countries) && tour.countries.length) {
      return tour.countries.includes(slug);
    }
    const text = `${tour.location || ''} ${tour.name || ''} ${tour.description || ''}`.toLowerCase();
    const keys = KEYWORDS[slug] || [slug];
    return keys.some((k) => text.includes(k));
  }

  async function fetchTours(country) {
    const url = country ? `/api/tours?country=${encodeURIComponent(country)}` : '/api/tours';
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  }

  function getCountryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('country') || params.get('destination') || null;
  }

  function setCountryInUrl(slug) {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set('country', slug);
    else url.searchParams.delete('country');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  function makeChip(label, slug, active, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.country = slug || 'all';
    btn.className = 'td-country-chip';
    if (active) btn.classList.add('td-country-chip--active');
    btn.addEventListener('click', onClick);
    return btn;
  }

  function injectStyles() {
    if (document.getElementById('td-tour-filter-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-tour-filter-styles';
    style.textContent = `
      .td-country-filter { display:flex; flex-wrap:wrap; gap:8px; margin: 20px 0 28px; }
      .td-country-chip {
        font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase;
        padding: 10px 16px; border: 1px solid hsl(38,20%,88%);
        background: white; color: hsl(218,40%,35%); cursor: pointer;
        transition: all .2s ease; font-weight: 600;
      }
      .td-country-chip:hover { border-color: hsl(35,65%,45%); color: hsl(35,65%,38%); }
      .td-country-chip--active {
        background: hsl(218,60%,8%); color: white; border-color: hsl(218,60%,8%);
      }
      .td-tours-empty {
        grid-column: 1 / -1; text-align:center; padding: 48px 16px;
        color: hsl(218,25%,50%); font-size: 0.9rem;
      }
      .td-dest-tours { margin-top: 12px; }
      .td-dest-tour-card {
        background: white; border: 1px solid hsl(38,20%,88%);
        padding: 20px; margin-bottom: 12px;
        display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;
      }
      .td-dest-tour-card h3 { font-family: Georgia, serif; font-size: 1rem; margin: 0 0 6px; }
      .td-dest-tour-meta { font-size: 0.72rem; color: hsl(218,25%,52%); }
      .td-dest-tour-price { font-family: Georgia, serif; color: hsl(35,65%,45%); font-size: 1.1rem; }
      .td-dest-tour-link {
        font-size: 0.55rem; letter-spacing: 0.14em; text-transform: uppercase;
        padding: 10px 16px; background: hsl(218,60%,8%); color: white; text-decoration:none;
      }
    `;
    document.head.appendChild(style);
  }

  let cachedTours = null;

  async function ensureTours() {
    if (!cachedTours) cachedTours = await fetchTours();
    return cachedTours;
  }

  function getTourIdFromCard(card) {
    const testId = card.querySelector('[data-testid^="button-view-tour-"]')?.dataset?.testid || '';
    const match = testId.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async function filterHomepageCards(slug) {
    const section = document.getElementById('tours');
    if (!section) return;

    const grid = section.querySelector('.grid');
    if (!grid) return;

    const tours = await ensureTours();
    const cards = [...grid.children].filter((el) => el.querySelector('h3'));
    let visible = 0;

    cards.forEach((card) => {
      const tourId = getTourIdFromCard(card);
      const tour = tours.find((t) => t.id === tourId);
      let show = !slug;

      if (slug && tour) {
        show = tourMatchesCountry(tour, slug);
      } else if (slug && !tour) {
        const loc = card.textContent.toLowerCase();
        const keys = KEYWORDS[slug] || [slug];
        show = keys.some((k) => loc.includes(k));
      }

      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    let empty = grid.querySelector('.td-tours-empty');
    if (!visible) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'td-tours-empty';
        grid.appendChild(empty);
      }
      const country = tr(DESTINATIONS.find((d) => d.slug === slug)?.country || slug);
      const msg = tr('No tours found for this destination.') || `No expeditions found for ${country} yet. Contact us for a custom journey.`;
      empty.textContent = msg.includes(country) ? msg : `${msg} (${country})`;
      empty.style.display = '';
    } else if (empty) {
      empty.style.display = 'none';
    }
  }

  function setupHomepageFilter() {
    const section = document.getElementById('tours');
    if (!section || section.querySelector('.td-country-filter')) return;

    const header = section.querySelector('.mb-16');
    if (!header) return;

    injectStyles();

    let active = getCountryFromUrl();

    const bar = document.createElement('div');
    bar.className = 'td-country-filter';

    const render = async (slug) => {
      active = slug;
      setCountryInUrl(slug);
      bar.querySelectorAll('.td-country-chip').forEach((chip) => {
        chip.classList.toggle('td-country-chip--active', chip.dataset.country === (slug || 'all'));
      });
      await filterHomepageCards(slug);
    };

    bar.appendChild(makeChip(tr('All'), null, !active, () => render(null)));
    DESTINATIONS.forEach((d) => {
      bar.appendChild(makeChip(tr(d.country), d.slug, active === d.slug, () => render(d.slug)));
    });

    header.appendChild(bar);

    if (active) void filterHomepageCards(active);

    document.querySelectorAll('a[href^="/destinations/"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const slug = link.getAttribute('href')?.split('/').pop();
        if (!slug || !window.location.pathname.match(/^\/?$/)) return;
        e.preventDefault();
        render(slug);
        section.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  async function setupDestinationPage() {
    const match = window.location.pathname.match(/\/destinations\/([^/]+)/);
    if (!match) return;

    const slug = match[1];
    const dest = DESTINATIONS.find((d) => d.slug === slug);
    if (!dest) return;

    injectStyles();

    const tours = await fetchTours(slug);
    if (!tours.length) return;

    const headings = [...document.querySelectorAll('h2')];
    const expHeading = headings.find((h) => h.textContent.includes('Expeditions'));
    if (!expHeading) return;

    const container = expHeading.closest('div')?.parentElement;
    const oldList = container?.querySelector('.space-y-3');
    if (!container || !oldList || container.querySelector('.td-dest-tours')) return;

    const wrap = document.createElement('div');
    wrap.className = 'td-dest-tours';

    tours.forEach((tour) => {
      const card = document.createElement('div');
      card.className = 'td-dest-tour-card';
      card.innerHTML = `
        <div>
          <h3>${tour.name}</h3>
          <div class="td-dest-tour-meta">${tour.location || ''} · ${tour.duration || ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          <div class="td-dest-tour-price">$${Number(tour.price).toLocaleString()}</div>
          <a class="td-dest-tour-link" href="/tours/${tour.id}">${tr('View Tour')}</a>
        </div>
      `;
      wrap.appendChild(card);
    });

    oldList.replaceWith(wrap);
  }

  function patchDestinationNavLinks() {
    document.querySelectorAll('a[href^="/destinations/"]').forEach((link) => {
      const slug = link.getAttribute('href')?.split('/').pop();
      if (!slug) return;
      if (window.location.pathname === '/' || window.location.pathname === '') {
        link.setAttribute('href', `/?country=${slug}#tours`);
      }
    });
  }

  function init() {
    patchDestinationNavLinks();
    setupHomepageFilter();
    setupDestinationPage();
  }

  const observer = new MutationObserver(() => {
    init();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('td-lang-change', () => {
    cachedTours = null;
    document.querySelectorAll('.td-country-filter').forEach((el) => el.remove());
    document.querySelectorAll('.td-dest-tours').forEach((el) => el.remove());
    init();
    if (window.TD_I18N?.apply) window.TD_I18N.apply();
  });

  window.addEventListener('popstate', () => {
    const slug = getCountryFromUrl();
    filterHomepageCards(slug);
    const bar = document.querySelector('.td-country-filter');
    if (bar) {
      bar.querySelectorAll('.td-country-chip').forEach((chip) => {
        chip.classList.toggle('td-country-chip--active', chip.dataset.country === (slug || 'all'));
      });
    }
  });
})();