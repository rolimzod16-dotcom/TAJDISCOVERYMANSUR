require('dotenv').config();
const path = require('path');
const express = require('express');
const { initSchema, usePostgres } = require('./pg');
const { seedPostgresIfEmpty } = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function start() {
  if (usePostgres()) {
    await initSchema();
    await seedPostgresIfEmpty();
    console.log('Database: PostgreSQL');
  } else {
    console.log('Database: local JSON (data/db.json)');
  }

  app.use(express.static(PUBLIC_DIR));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`TajDiscovery running at http://localhost:${PORT}`);
    console.log(`Admin password: ${process.env.ADMIN_PASSWORD || 'tajdiscovery2026'}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});