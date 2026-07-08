#!/usr/bin/env node
require('dotenv').config();
const { initSchema, closePool } = require('../server/pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  await initSchema();
  console.log('PostgreSQL schema ready (cms_store table)');
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});