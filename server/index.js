const path = require('path');
const express = require('express');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

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