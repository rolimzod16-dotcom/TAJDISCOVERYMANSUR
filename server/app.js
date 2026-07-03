const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb, nextId, computeStats } = require('./db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tajdiscovery2026';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname || '')),
  }),
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

function sortByOrder(list) {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

app.get('/api/storage/objects/uploads/:id', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.id);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
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

app.get('/api/tours', (req, res) => {
  const country = req.query.country;
  let tours = readDb().tours;
  if (country) tours = tours.filter((t) => tourMatchesCountrySlug(t, String(country).toLowerCase()));
  sendJson(res, tours);
});

app.get('/api/tours/:id', (req, res) => {
  const tour = findById(readDb().tours, req.params.id);
  if (!tour) return sendJson(res, { error: 'Tour not found' }, 404);
  sendJson(res, tour);
});

app.post('/api/tours', (req, res) => {
  const db = readDb();
  const tour = { ...req.body, id: nextId(db, 'tour'), createdAt: new Date().toISOString() };
  db.tours.push(tour);
  writeDb(db);
  sendJson(res, tour, 201);
});

app.put('/api/tours/:id', (req, res) => {
  const db = readDb();
  const idx = db.tours.findIndex((t) => String(t.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Tour not found' }, 404);
  db.tours[idx] = { ...db.tours[idx], ...req.body, id: db.tours[idx].id };
  writeDb(db);
  sendJson(res, db.tours[idx]);
});

app.delete('/api/tours/:id', (req, res) => {
  const db = readDb();
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
  writeDb(db);
  sendJson(res, { success: true });
});

app.post('/api/tours/extract-doc', upload.single('file'), (_req, res) => {
  sendJson(res, { error: 'Document extraction is not configured in this restored build. Create tours manually in admin.' }, 501);
});

function tourSubResource(collection, alias) {
  const key = alias || collection;
  app.get(`/api/tours/:id/${key}`, (req, res) => {
    sendJson(res, sortByOrder(filterByTour(readDb()[collection], req.params.id)));
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
  app.get(`/api/${collection}`, (req, res) => {
    const db = readDb();
    let items = db[collection] || [];
    if (tourScoped && req.query.tourId) items = filterByTour(items, req.query.tourId);
    sendJson(res, sortByOrder(items));
  });
  app.get(`/api/${collection}/:id`, (req, res) => {
    const item = findById(readDb()[collection] || [], req.params.id);
    if (!item) return sendJson(res, { error: 'Not found' }, 404);
    sendJson(res, item);
  });
  app.post(`/api/${collection}`, (req, res) => {
    const db = readDb();
    if (!db[collection]) db[collection] = [];
    const idKey = opts.idKey || collection.replace(/Days$/, 'Day').replace(/s$/, '');
    const item = { ...req.body, id: nextId(db, idKey), createdAt: new Date().toISOString() };
    db[collection].push(item);
    writeDb(db);
    sendJson(res, item, 201);
  });
  app.put(`/api/${collection}/:id`, (req, res) => {
    const db = readDb();
    const idx = (db[collection] || []).findIndex((x) => String(x.id) === String(req.params.id));
    if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
    db[collection][idx] = { ...db[collection][idx], ...req.body, id: db[collection][idx].id };
    writeDb(db);
    sendJson(res, db[collection][idx]);
  });
  app.delete(`/api/${collection}/:id`, (req, res) => {
    const db = readDb();
    const before = (db[collection] || []).length;
    db[collection] = (db[collection] || []).filter((x) => String(x.id) !== String(req.params.id));
    if (db[collection].length === before) return sendJson(res, { error: 'Not found' }, 404);
    writeDb(db);
    sendJson(res, { success: true });
  });
}

crudRoutes('highlights', { tourScoped: true, idKey: 'highlight' });
crudRoutes('inclusions', { tourScoped: true, idKey: 'inclusion' });
crudRoutes('faqs', { tourScoped: true, idKey: 'faq' });
crudRoutes('departures', { tourScoped: true, idKey: 'departure' });

app.get('/api/itinerary-days', (req, res) => {
  let items = readDb().itineraryDays || [];
  if (req.query.tourId) items = filterByTour(items, req.query.tourId);
  sendJson(res, sortByOrder(items));
});
app.get('/api/itinerary-days/:id', (req, res) => {
  const item = findById(readDb().itineraryDays || [], req.params.id);
  if (!item) return sendJson(res, { error: 'Not found' }, 404);
  sendJson(res, item);
});
app.post('/api/itinerary-days', (req, res) => {
  const db = readDb();
  const item = { ...req.body, id: nextId(db, 'itineraryDay'), createdAt: new Date().toISOString() };
  db.itineraryDays.push(item);
  writeDb(db);
  sendJson(res, item, 201);
});
app.put('/api/itinerary-days/:id', (req, res) => {
  const db = readDb();
  const idx = db.itineraryDays.findIndex((x) => String(x.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.itineraryDays[idx] = { ...db.itineraryDays[idx], ...req.body, id: db.itineraryDays[idx].id };
  writeDb(db);
  sendJson(res, db.itineraryDays[idx]);
});
app.delete('/api/itinerary-days/:id', (req, res) => {
  const db = readDb();
  const before = db.itineraryDays.length;
  db.itineraryDays = db.itineraryDays.filter((x) => String(x.id) !== String(req.params.id));
  if (db.itineraryDays.length === before) return sendJson(res, { error: 'Not found' }, 404);
  writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/tour-images', (req, res) => {
  let items = readDb().tourImages || [];
  if (req.query.tourId) items = filterByTour(items, req.query.tourId);
  sendJson(res, sortByOrder(items));
});
app.get('/api/tour-images/:id', (req, res) => {
  const item = findById(readDb().tourImages || [], req.params.id);
  if (!item) return sendJson(res, { error: 'Not found' }, 404);
  sendJson(res, item);
});
app.post('/api/tour-images', (req, res) => {
  const db = readDb();
  const item = { ...req.body, id: nextId(db, 'tourImage'), createdAt: new Date().toISOString() };
  db.tourImages.push(item);
  writeDb(db);
  sendJson(res, item, 201);
});
app.put('/api/tour-images/:id', (req, res) => {
  const db = readDb();
  const idx = db.tourImages.findIndex((x) => String(x.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.tourImages[idx] = { ...db.tourImages[idx], ...req.body, id: db.tourImages[idx].id };
  writeDb(db);
  sendJson(res, db.tourImages[idx]);
});
app.delete('/api/tour-images/:id', (req, res) => {
  const db = readDb();
  const before = db.tourImages.length;
  db.tourImages = db.tourImages.filter((x) => String(x.id) !== String(req.params.id));
  if (db.tourImages.length === before) return sendJson(res, { error: 'Not found' }, 404);
  writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/bookings', (_req, res) => sendJson(res, readDb().bookings || []));
app.get('/api/bookings/:id', (req, res) => {
  const booking = findById(readDb().bookings || [], req.params.id);
  if (!booking) return sendJson(res, { error: 'Not found' }, 404);
  sendJson(res, booking);
});
app.post('/api/bookings', (req, res) => {
  const { name, email, tourName } = req.body || {};
  if (!name || !email || !tourName) return sendJson(res, { error: 'name, email, and tourName are required' }, 400);
  const db = readDb();
  const booking = { ...req.body, id: nextId(db, 'booking'), status: req.body.status || 'pending', createdAt: new Date().toISOString() };
  db.bookings.push(booking);
  writeDb(db);
  sendJson(res, booking, 201);
});
app.put('/api/bookings/:id', (req, res) => {
  const db = readDb();
  const idx = db.bookings.findIndex((b) => String(b.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.bookings[idx] = { ...db.bookings[idx], ...req.body, id: db.bookings[idx].id };
  writeDb(db);
  sendJson(res, db.bookings[idx]);
});
app.delete('/api/bookings/:id', (req, res) => {
  const db = readDb();
  const before = db.bookings.length;
  db.bookings = db.bookings.filter((b) => String(b.id) !== String(req.params.id));
  if (db.bookings.length === before) return sendJson(res, { error: 'Not found' }, 404);
  writeDb(db);
  sendJson(res, { success: true });
});

app.post('/api/inquiries', (req, res) => {
  const { name } = req.body || {};
  if (!name) return sendJson(res, { error: 'name is required' }, 400);
  const db = readDb();
  const inquiry = { ...req.body, id: nextId(db, 'inquiry'), createdAt: new Date().toISOString() };
  if (!db.inquiries) db.inquiries = [];
  db.inquiries.push(inquiry);
  writeDb(db);
  sendJson(res, inquiry, 201);
});

app.get('/api/settings', (_req, res) => sendJson(res, readDb().settings));
app.put('/api/settings/:section', (req, res) => {
  const db = readDb();
  const section = req.params.section;
  if (section === 'notifications') db.settings.notifications = req.body.value ?? req.body;
  else if (db.settings[section] !== undefined) db.settings[section] = req.body.value ?? req.body;
  else return sendJson(res, { error: 'Unknown settings section' }, 404);
  writeDb(db);
  sendJson(res, db.settings);
});
app.get('/api/settings/notifications', (_req, res) => sendJson(res, readDb().settings.notifications || {}));
app.put('/api/settings/notifications', (req, res) => {
  const db = readDb();
  db.settings.notifications = { ...db.settings.notifications, ...req.body };
  writeDb(db);
  sendJson(res, db.settings.notifications);
});

app.get('/api/testimonials/all', (_req, res) => sendJson(res, readDb().testimonials || []));
app.get('/api/testimonials', (_req, res) => {
  sendJson(res, (readDb().testimonials || []).filter((t) => t.active !== false));
});
app.post('/api/testimonials', (req, res) => {
  const db = readDb();
  const item = { ...req.body, id: nextId(db, 'testimonial'), active: req.body.active !== false, createdAt: new Date().toISOString() };
  db.testimonials.push(item);
  writeDb(db);
  sendJson(res, item, 201);
});
app.put('/api/testimonials/:id', (req, res) => {
  const db = readDb();
  const idx = db.testimonials.findIndex((t) => String(t.id) === String(req.params.id));
  if (idx === -1) return sendJson(res, { error: 'Not found' }, 404);
  db.testimonials[idx] = { ...db.testimonials[idx], ...req.body, id: db.testimonials[idx].id };
  writeDb(db);
  sendJson(res, db.testimonials[idx]);
});
app.delete('/api/testimonials/:id', (req, res) => {
  const db = readDb();
  const before = db.testimonials.length;
  db.testimonials = db.testimonials.filter((t) => String(t.id) !== String(req.params.id));
  if (db.testimonials.length === before) return sendJson(res, { error: 'Not found' }, 404);
  writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/page-seo', (_req, res) => sendJson(res, readDb().pageSeo || []));
app.post('/api/page-seo', (req, res) => {
  const db = readDb();
  const item = { ...req.body, id: req.body.id || Date.now() };
  if (!db.pageSeo) db.pageSeo = [];
  db.pageSeo.push(item);
  writeDb(db);
  sendJson(res, item, 201);
});
app.delete('/api/page-seo/:id', (req, res) => {
  const db = readDb();
  const before = (db.pageSeo || []).length;
  db.pageSeo = (db.pageSeo || []).filter((p) => String(p.id) !== String(req.params.id));
  if (db.pageSeo.length === before) return sendJson(res, { error: 'Not found' }, 404);
  writeDb(db);
  sendJson(res, { success: true });
});

app.get('/api/stats', (_req, res) => sendJson(res, computeStats(readDb())));
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return sendJson(res, { valid: true });
  sendJson(res, { valid: false }, 401);
});

module.exports = app;