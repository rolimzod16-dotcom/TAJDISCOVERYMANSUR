const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nextId(db, key) {
  const id = db.nextIds[key]++;
  writeDb(db);
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

module.exports = { readDb, writeDb, nextId, computeStats, DB_PATH };