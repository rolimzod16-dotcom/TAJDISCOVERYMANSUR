#!/usr/bin/env node
/**
 * Migrate data/db.json → PostgreSQL (cms_store table).
 * Usage: DATABASE_URL=postgres://... npm run db:migrate
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool, initSchema, closePool } = require('../server/pg');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Missing seed file: ${DB_PATH}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  await initSchema();

  const pg = getPool();
  await pg.query(
    `INSERT INTO cms_store (id, data, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(data)]
  );

  const { rows } = await pg.query('SELECT jsonb_array_length(data->\'tours\') AS tours FROM cms_store WHERE id = 1');
  console.log(`Migrated to PostgreSQL: ${rows[0].tours} tours`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});