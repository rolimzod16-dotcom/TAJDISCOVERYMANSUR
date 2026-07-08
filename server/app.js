const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb, nextId, computeStats } = require('./db');
const { UPLOADS_DIR, saveUpload, getUpload } = require('./storage');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tajdiscovery2026';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

app.use(cors());

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname || '')),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function sendJson(res, data, status = 200) {
  res.status(status).json(data);
}

function findById(list, id) {
  return list.find((item) => String(item.id) === String(id));
}

function filterByTour(list, tourId) {
  return list.filter((item) => String(item.tourId) === String(tourId));
}

const SUPPORTED_LANGS = ['en', 'ru', 'tg'];

function getRequestLang(req) {
  const lang = String(req.query.lang || '').toLowerCase();
  return SUPPORTED_LANGS.includes(lang) ? lang : 'en';
}

function localizeEntity(entity, lang, fields) {
  if (!lang || lang === 'en' || !entity) return entity;
  const tr = entity.translations?.[lang];
  if (!tr) return entity;
  const out = { ...entity };
  for (const f of fields) {
    if (tr[f] != null && tr[f] !== '') out[f] = tr[f];
  }
  return out;
}

function localizeTour(tour, lang) {
  return localizeEntity(tour, lang, ['name', 'description', 'location', 'duration', 'highlights', 'difficulty']);
}

/** Public tours always show "price upon request" — never expose numeric prices. */
function publicTour(tour, lang) {
  if (!tour) return tour;
  return { ...localizeTour(tour, lang), price: 0 };
}

function normalizeTourPrice(tour) {
  return { ...tour, price: 0 };
}

function localizeSettings(settings, lang) {
  if (!lang || lang === 'en') return settings;
  const tr = settings.i18n?.[lang];
  if (!tr) return settings;
  const result = { ...settings };
  if (tr.hero) result.hero = { ...result.hero, ...tr.hero };
  if (tr.about) result.about = { ...result.about, ...tr.about };
  if (tr.stats) result.stats = tr.stats;
  if (tr.footer) result.footer = { ...result.footer, ...tr.footer };
  return result;
}

function sortByOrder(list) {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function extFromContentType(contentType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return map[String(contentType || '').toLowerCase()] || '';
}

function extFromName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '';
}

function safeUploadFilename(filename) {
  return path.basename(String(filename || '')).replace(/[^a-zA-Z0-9._-]/g, '');
}

async function handleNamedUpload(req, res) {
  const filename = safeUploadFilename(req.params.filename);
  if (!filename) return sendJson(res, { error: 'Invalid filename' }, 400);

  const buffer = req.file?.buffer || req.body;
  if (!buffer?.length) return sendJson(res, { error: 'No file uploaded' }, 400);

  try {
    const contentType =
      req.file?.mimetype || req.headers['content-type'] || 'application/octet-stream';
    await saveUpload(filename, buffer, contentType);
    res.status(200).end();
  } catch (err) {
    console.error('Upload failed:', err);
    const message =
      process.env.VERCEL && !process.env.DATABASE_URL && !process.env.BLOB_READ_WRITE_TOKEN
        ? 'Storage not configured. Add DATABASE_URL in Vercel environment variables.'
        : 'Upload failed';
    sendJson(res, { error: message }, 500);
  }
}

app.post('/api/storage/uploads/request-url', express.json(), (req, res) => {
  const { name, size, contentType } = req.body || {};
  if (!name) return sendJson(res, { error: 'name is required' }, 400);
  if (size && size > 10 * 1024 * 1024) return sendJson(res, { error: 'File too large (max 10 MB)' }, 400);

  const ext = extFromName(name) || extFromContentType(contentType) || '.jpg';
  const filename = uuidv4() + ext;
  const objectPath = `/objects/uploads/${filename}`;
  const uploadURL = `/api/storage/uploads/${filename}`;

  sendJson(res, { uploadURL, objectPath });
});

// PUT for local dev; POST used on Vercel (via admin-upload-patch.js)
app.put(
  '/api/storage/uploads/:filename',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'], limit: '10mb' }),
  handleNamedUpload
);
app.post('/api/storage/uploads/:filename', memoryUpload.single('file'), handleNamedUpload);

app.use(express.json({ limit: '25mb' }));

app.get('/api/storage/objects/uploads/:id', async (req, res) => {
  const id = safeUploadFilename(req.params.id);
  if (!id) return res.status(404).send('Not found');
  try {
    const file = await getUpload(id);
    if (!file) {
      // Legacy images shipped in public/uploads (static on Vercel)
      return res.redirect(`/uploads/${id}`);
    }
    if (file.type === 'blob') return res.redirect(file.url);
    if (file.type === 'pg') {
      res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(file.buffer);
    }
    return res.sendFile(file.filePath);
  } catch (err) {
    console.error('Serve upload failed:', err);
    res.status(404).send('Not found');
  }
});

app.post('/api/storage', upload.single('file'), (req, res) => {
  if (!req.file) return sendJson(res, { error: 'No file uploaded' }, 400);
  const objectPath = `/api/storage/objects/uploads/${req.file.filename}`;
  sendJson(res, { objectPath, url: objectPath });
});

app.post('/api/storage/upload', upload.single('file'), (req, res) => {
  if (!req.file) return sendJson(res, { error: 'No file uploaded' }, 400);
  const objectPath = `/api/storage/objects/uploads/${req.file.filename}`;
  sendJson(res, { objectPath, url: objectPath });
});

function tourMatchesCountrySlug(tour, slug) {
  if (!slug) return true;
  if (Array.isArray(tour.countries) && tour.countries.length) {
    return tour.countries.includes(slug);
  }
  const keywords = {
    tajikistan: ['tajikistan', 'dushanbe', 'pamir', 'wakhan', 'fann', 'panjakent', 'iskanderkul', 'bartang', 'hissor', 'sughd', 'khatlon', 'artuch', 'somoni', 'chilichorchama'],
    uzbekistan: ['uzbekistan', 'samarqand', 'samarkand', 'bukhara', 'khiva', 'fergana', 'uzbek'],
    kyrgyzstan: ['kyrgyzstan', 'osh', 'karakul', 'bishkek', 'lenin peak'],
    kazakhstan: ['kazakhstan', 'almaty'],
    china: ['china'],
    pakistan: ['pakistan', 'karakoram'],
    afghanistan: ['afghanistan'],
  };
  const text = `${tour.location || ''} ${tour.name || ''}`.toLowerCase();
  const keys = keywords[slug] || [slug];
  return keys.some((k) => text.includes(k));
}

app.get('/api/tours', async (req, res) => {
  const lang = getRequestLang(req);
  const country = req.query.country;
  let tours = (await readDb()).tours;
  if (country) tours = tours.filter((t) => tourMatchesCountrySlug(t, String(country).toLowerCase()));
  sendJson(res, tours.map((t) => publicTour(t, lang)));
});

app.get('/api/tours/:id', async (req, res) => {
  const lang = getRequestLang(req);
  const tour = findById((await readDb()).tours, req.params.id);
  if (!tour) return sendJson(res, { error: 'Tour not found' }, 404);
  sendJson(res, publicTour(tour, lang));
});

function normalizeCountries(tour) {
  if (Array.isArray(tour.countries) && tour.countries.length) return tour.countries;
  const text = `${tour.location || ''} ${tour.name || ''}`.toLowerCase();
  const rules = {
    tajikistan: ['tajikistan', 'dushanbe', 'pamir', 'wakhan', 'fann', 'panjakent', 'iskanderkul', 'bartang', 'sughd', 'khatlon'],
    uzbekistan: ['uzbekistan', 'samarqand', 'samarkand', 'uzbek'],
    kyrgyzstan: ['kyrgyzstan', 'osh'],
    kazakhstan: ['kazakhstan', 'almaty'],
    china: ['china'],
    pakistan: ['pakistan'],
    afghanistan: ['afghanistan'],
  };
  const found = [];
  for (const [slug, keys] of Object.entries(rules)) {
    if (keys.some((k) => text.includes(k))) found.push(slug);
  }
  return found;
}

app.post('/api/tours', async (req, res) => {
  const db = await readDb();
  const tour = normalizeTourPrice({
    ...req.body,
    id: await nextId(db, 'tour'),
    countries: normalizeCountries(req.body),
    createdAt: new Date().toISOString(),
  });
  db.tours.push(tour);
  await writeDb(db);
  sendJson(res, tour, 201);
});

app.put('/api/tours/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.tours.findIndex((t) => String(t.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Tour not found' }, 404);
  db.tours[idx] = normalizeTourPrice({
    ...db.tours[idx],
    ...req.body,
    id: db.tours[idx].id,
    countries: req.body.countries !== undefined ? normalizeCountries(req.body) : db.tours[idx].countries,
  });
  await writeDb(db);
  sendJson(res, db.tours[idx]);
});

app.delete('/api/tours/:id', async (req, res) => {
  const db = await readDb();
  const before = db.tours.length;
  db.tours = db.tours.filter((t) => String(t.id) !== String(req.params.id));
  if (db.tours.length === before) return sendJson(res, { error: 'Tour not found' }, 404);
  const tid = req.params.id;
  db.highlights = db.highlights.filter((h) => String(h.tourId) !== tid);
  db.itineraryDays = db.itineraryDays.filter((d) => String(d.tourId) !== tid);
  db.inclusions = db.inclusions.filter((i) => String(i.tourId) !== tid);
  db.faqs = db.faqs.filter((f) => String(f.tourId) !== tid);
  db.tourImages = db.tourImages.filter((i) => String(i.tourId) !== tid);
  db.departures = db.departures.filter((d) => String(d.tourId) !== tid);
  await writeDb(db);
  sendJson(res, { success: true });
});

app.post('/api/tours/extract-doc', upload.single('file'), (_req, res) => {
  sendJson(res, { error: 'Document extraction is not configured in this restored build. Create tours manually in admin.' }, 501);
});

function tourSubResource(collection, alias) {
  const key = alias || collection;
  app.get(`/api/tours/:id/${key}`, async (req, res) => {
    sendJson(res, sortByOrder(filterByTour((await readDb())[collection], req.params.id)));
  });
}

tourSubResource('highlights');
tourSubResource('itineraryDays', 'itinerary');
tourSubResource('inclusions');
tourSubResource('faqs');
tourSubResource('tourImages', 'images');
tourSubResource('departures');

function crudRoutes(collection, opts = {}) {
  const { tourScoped = false } = opts;
  app.get(`/api/${collection}`, async (req, res) => {
    const db = await readDb();
    let items = db[collection] || [];
    if (tourScoped && req.query.tourId) items = filterByTour(items, req.query.tourId);
    sendJson(res, sortByOrder(items));
  });
  app.get(`/api/${collection}/:id`, async (req, res) => {
    const item = findById((await readDb())[collection] || [], req.params.id);
    if (!item) return sendJson(res, { error: 'Not found' }, 404);
    sendJson(res, item);
  });
  app.post(`/api/${collection}`, async (req, res) => {
    const db = await readDb();
    if (!db[collection]) db[collection] = [];
    const idKey = opts.idKey || collection.replace(/Days$/, 'Day').replace(/s$/, '');
    const item = { ...req.body, id: await nextId(db, idKey), createdAt: new Date().toISOString() };
    db[collection].push(item);
    await writeDb(db);
    sendJson(res, item, 201);
  });
  app.put(`/api/${collection}/:id`, async (req, res) => {
    const db = await readDb();
    const idx = (db[collection] || []).findIndex((x) => String(x.id) === String(req.params.id));
    if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
    db[collection][idx] = { ...db[collection][idx], ...req.body, id: db[collection][idx].id };
    await writeDb(db);
    sendJson(res, db[collection][idx]);
  });
  app.delete(`/api/${collection}/:id`, async (req, res) => {
    const db = await readDb();
    const before = (db[collection] || []).length;
    db[collection] = (db[collection] || []).filter((x) => String(x.id) !== String(req.params.id));
    if (db[collection].length === before) return sendJson(res, { error: 'Not found' }, 404);
    await writeDb(db);
    sendJson(res, { success: true });
  });
}

crudRoutes('highlights', { tourScoped: true, idKey: 'highlight' });
crudRoutes('inclusions', { tourScoped: true, idKey: 'inclusion' });
crudRoutes('faqs', { tourScoped: true, idKey: 'faq' });
crudRoutes('departures', { tourScoped: true, idKey: 'departure' });

app.get('/api/itinerary-days', async (req, res) => {
  let items = (await readDb()).itineraryDays || [];
  if (req.query.tourId) items = filterByTour(items, req.query.tourId);
  sendJson(res, sortByOrder(items));
});
app.get('/api/itinerary-days/:id', async (req, res) => {
  const item = findById((await readDb()).itineraryDays || [], req.params.id);
  if (!item) return sendJson(res, { error: 'Not found' }, 404);
  sendJson(res, item);
});
app.post('/api/itinerary-days', async (req, res) => {
  const db = await readDb();
  const item = { ...req.body, id: await nextId(db, 'itineraryDay'), createdAt: new Date().toISOString() };
  db.itineraryDays.push(item);
  await writeDb(db);
  sendJson(res, item, 201);
});
app.put('/api/itinerary-days/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.itineraryDays.findIndex((x) => String(x.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.itineraryDays[idx] = { ...db.itineraryDays[idx], ...req.body, id: db.itineraryDays[idx].id };
  await writeDb(db);
  sendJson(res, db.itineraryDays[idx]);
});
app.delete('/api/itinerary-days/:id', async (req, res) => {
  const db = await readDb();
  const before = db.itineraryDays.length;
  db.itineraryDays = db.itineraryDays.filter((x) => String(x.id) !== String(req.params.id));
  if (db.itineraryDays.length === before) return sendJson(res, { error: 'Not found' }, 404);
  await writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/tour-images', async (req, res) => {
  let items = (await readDb()).tourImages || [];
  if (req.query.tourId) items = filterByTour(items, req.query.tourId);
  sendJson(res, sortByOrder(items));
});
app.get('/api/tour-images/:id', async (req, res) => {
  const item = findById((await readDb()).tourImages || [], req.params.id);
  if (!item) return sendJson(res, { error: 'Not found' }, 404);
  sendJson(res, item);
});
app.post('/api/tour-images', async (req, res) => {
  const db = await readDb();
  const item = { ...req.body, id: await nextId(db, 'tourImage'), createdAt: new Date().toISOString() };
  db.tourImages.push(item);
  await writeDb(db);
  sendJson(res, item, 201);
});
app.put('/api/tour-images/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.tourImages.findIndex((x) => String(x.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.tourImages[idx] = { ...db.tourImages[idx], ...req.body, id: db.tourImages[idx].id };
  await writeDb(db);
  sendJson(res, db.tourImages[idx]);
});
app.delete('/api/tour-images/:id', async (req, res) => {
  const db = await readDb();
  const before = db.tourImages.length;
  db.tourImages = db.tourImages.filter((x) => String(x.id) !== String(req.params.id));
  if (db.tourImages.length === before) return sendJson(res, { error: 'Not found' }, 404);
  await writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/bookings', async (_req, res) => sendJson(res, (await readDb()).bookings || []));
app.get('/api/bookings/:id', async (req, res) => {
  const booking = findById((await readDb()).bookings || [], req.params.id);
  if (!booking) return sendJson(res, { error: 'Not found' }, 404);
  sendJson(res, booking);
});
app.post('/api/bookings', async (req, res) => {
  const { name, email, tourName } = req.body || {};
  if (!name || !email || !tourName) return sendJson(res, { error: 'name, email, and tourName are required' }, 400);
  const db = await readDb();
  const booking = { ...req.body, id: await nextId(db, 'booking'), status: req.body.status || 'pending', createdAt: new Date().toISOString() };
  db.bookings.push(booking);
  await writeDb(db);
  sendJson(res, booking, 201);
});
app.put('/api/bookings/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.bookings.findIndex((b) => String(b.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.bookings[idx] = { ...db.bookings[idx], ...req.body, id: db.bookings[idx].id };
  await writeDb(db);
  sendJson(res, db.bookings[idx]);
});
app.delete('/api/bookings/:id', async (req, res) => {
  const db = await readDb();
  const before = db.bookings.length;
  db.bookings = db.bookings.filter((b) => String(b.id) !== String(req.params.id));
  if (db.bookings.length === before) return sendJson(res, { error: 'Not found' }, 404);
  await writeDb(db);
  sendJson(res, { success: true });
});

app.post('/api/inquiries', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return sendJson(res, { error: 'name is required' }, 400);
  const db = await readDb();
  const inquiry = { ...req.body, id: await nextId(db, 'inquiry'), createdAt: new Date().toISOString() };
  if (!db.inquiries) db.inquiries = [];
  db.inquiries.push(inquiry);
  await writeDb(db);
  sendJson(res, inquiry, 201);
});

app.get('/api/settings', async (req, res) => {
  const lang = getRequestLang(req);
  sendJson(res, localizeSettings((await readDb()).settings, lang));
});
app.put('/api/settings/:section', async (req, res) => {
  const db = await readDb();
  const section = req.params.section;
  if (section === 'notifications') db.settings.notifications = req.body.value ?? req.body;
  else if (db.settings[section] !== undefined) db.settings[section] = req.body.value ?? req.body;
  else return sendJson(res, { error: 'Unknown settings section' }, 404);
  await writeDb(db);
  sendJson(res, db.settings);
});
app.get('/api/settings/notifications', async (_req, res) => sendJson(res, (await readDb()).settings.notifications || {}));
app.put('/api/settings/notifications', async (req, res) => {
  const db = await readDb();
  db.settings.notifications = { ...db.settings.notifications, ...req.body };
  await writeDb(db);
  sendJson(res, db.settings.notifications);
});

app.get('/api/testimonials/all', async (_req, res) => sendJson(res, (await readDb()).testimonials || []));
app.get('/api/testimonials', async (_req, res) => {
  sendJson(res, ((await readDb()).testimonials || []).filter((t) => t.active !== false));
});
app.post('/api/testimonials', async (req, res) => {
  const db = await readDb();
  const item = { ...req.body, id: await nextId(db, 'testimonial'), active: req.body.active !== false, createdAt: new Date().toISOString() };
  db.testimonials.push(item);
  await writeDb(db);
  sendJson(res, item, 201);
});
app.put('/api/testimonials/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.testimonials.findIndex((t) => String(t.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.testimonials[idx] = { ...db.testimonials[idx], ...req.body, id: db.testimonials[idx].id };
  await writeDb(db);
  sendJson(res, db.testimonials[idx]);
});
app.delete('/api/testimonials/:id', async (req, res) => {
  const db = await readDb();
  const before = db.testimonials.length;
  db.testimonials = db.testimonials.filter((t) => String(t.id) !== String(req.params.id));
  if (db.testimonials.length === before) return sendJson(res, { error: 'Not found' }, 404);
  await writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/page-seo', async (_req, res) => sendJson(res, (await readDb()).pageSeo || []));
app.post('/api/page-seo', async (req, res) => {
  const db = await readDb();
  const item = { ...req.body, id: req.body.id || Date.now() };
  if (!db.pageSeo) db.pageSeo = [];
  db.pageSeo.push(item);
  await writeDb(db);
  sendJson(res, item, 201);
});
app.delete('/api/page-seo/:id', async (req, res) => {
  const db = await readDb();
  const before = (db.pageSeo || []).length;
  db.pageSeo = (db.pageSeo || []).filter((p) => String(p.id) !== String(req.params.id));
  if (db.pageSeo.length === before) return sendJson(res, { error: 'Not found' }, 404);
  await writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/stats', async (_req, res) => sendJson(res, computeStats(await readDb())));
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return sendJson(res, { valid: true });
  sendJson(res, { valid: false }, 401);
});

module.exports = app;