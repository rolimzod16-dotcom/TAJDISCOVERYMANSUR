(function () {
  if (!window.location.pathname.startsWith('/admin')) return;

  const origFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = (init?.method || 'GET').toUpperCase();

    if (method === 'PUT' && url.includes('/api/storage/uploads/')) {
      const file = init?.body;
      if (!file) return origFetch(input, init);

      const filename = url.split('/').pop() || 'upload.jpg';
      const form = new FormData();
      form.append('file', file, filename);

      return origFetch(url, { method: 'POST', body: form });
    }

    return origFetch(input, init);
  };
})();