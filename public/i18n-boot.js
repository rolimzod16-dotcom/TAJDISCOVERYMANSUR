(function () {
  var SUPPORTED = ['en', 'ru', 'tg'];
  var STORAGE_KEY = 'td-lang';

  function readLang() {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q && SUPPORTED.indexOf(q) !== -1) return q;
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    return 'en';
  }

  var lang = readLang();
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang === 'tg' ? 'tg' : lang;

  var url = new URL(window.location.href);
  if (url.searchParams.get('lang') !== lang) {
    url.searchParams.set('lang', lang);
    url.searchParams.delete('_lc');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  window.__TD_LANG__ = lang;

  function isTourApiPath(pathname) {
    return /^\/api\/tours(\/\d+)?$/.test(pathname);
  }

  function stripTourPrices(data) {
    if (Array.isArray(data)) return data.map(stripTourPrices);
    if (data && typeof data === 'object') {
      var out = {};
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) out[k] = data[k];
      }
      if (Object.prototype.hasOwnProperty.call(out, 'price')) out.price = 0;
      return out;
    }
    return data;
  }

  var originalFetch = window.fetch.bind(window);
  window.fetch = function (url, options) {
    var href = typeof url === 'string' ? url : url && url.url ? url.url : '';
    if (href.indexOf('/') === 0 && href.indexOf('/api/') !== -1 && href.indexOf('/api/storage/') === -1) {
      var u = new URL(href, window.location.origin);
      if (!u.searchParams.has('lang')) {
        u.searchParams.set('lang', lang);
        href = u.pathname + u.search;
        if (typeof url === 'string') url = href;
        else url = new Request(href, url);
      }
    }
    return originalFetch(url, options).then(function (res) {
      var pathname;
      try {
        pathname = new URL(href, window.location.origin).pathname;
      } catch (_e) {
        return res;
      }
      if (!isTourApiPath(pathname)) return res;
      return res.clone().json().then(function (data) {
        return new Response(JSON.stringify(stripTourPrices(data)), {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      }).catch(function () {
        return res;
      });
    });
  };
})();