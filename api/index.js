require('dotenv').config();
const { initSchema, usePostgres } = require('../server/pg');
const { seedPostgresIfEmpty } = require('../server/db');
const app = require('../server/app');

let ready = usePostgres()
  ? initSchema().then(() => seedPostgresIfEmpty())
  : Promise.resolve();

module.exports = async (req, res) => {
  await ready;
  return app(req, res);
};