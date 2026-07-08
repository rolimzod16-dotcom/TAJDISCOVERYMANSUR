const fs = require('fs');
const path = require('path');
const { getPool, usePostgres } = require('./pg');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function readJsonFile() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeJsonFile(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function seedPostgresIfEmpty() {
  const pg = getPool();
  const { rows } = await pg.query('SELECT data FROM cms_store WHERE id = 1');
  if (rows.length) return false;
  const seed = readJsonFile();
  await pg.query(
    'INSERT INTO cms_store (id, data) VALUES (1, $1::jsonb)',
    [JSON.stringify(seed)]
  );
  console.log(`Seeded PostgreSQL from db.json (${seed.tours?.length || 0} tours)`);
  return true;
}

async function readDb() {
  if (usePostgres()) {
    const pg = getPool();
    const { rows } = await pg.query('SELECT data FROM cms_store WHERE id = 1');
    if (rows.length) return rows[0].data;
    await seedPostgresIfEmpty();
    const seeded = await pg.query('SELECT data FROM cms_store WHERE id = 1');
    return seeded.rows[0].data;
  }
  return readJsonFile();
}

async function writeDb(db) {
  if (usePostgres()) {
    const pg = getPool();
    await pg.query(
      `INSERT INTO cms_store (id, data, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(db)]
    );
    return;
  }
  writeJsonFile(db);
}

async function nextId(db, key) {
  const id = db.nextIds[key]++;
  await writeDb(db);
  return id;
}

function computeStats(db) {
  const bookings = db.bookings || [];
  const popular = {};
  for (const b of bookings) {
    if (!b.tourName) continue;
    popular[b.tourName] = (popular[b.tourName] || 0) + 1;
  }
  const popularTours = Object.entries(popular)
    .map(([tourName, count]) => ({ tourName, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalBookings: bookings.length,
    totalTours: db.tours.length,
    popularTours,
    recentBookings: [...bookings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10),
  };
}

module.exports = { readDb, writeDb, nextId, computeStats, DB_PATH, usePostgres, seedPostgresIfEmpty };