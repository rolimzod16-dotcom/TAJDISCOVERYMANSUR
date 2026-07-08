const path = require('path');
const fs = require('fs');
const { getPool, usePostgres } = require('./pg');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(PUBLIC_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function usePgStorage() {
  return usePostgres();
}

function blobPath(filename) {
  return `uploads/${filename}`;
}

async function saveToPostgres(filename, buffer, contentType) {
  const pg = getPool();
  await pg.query(
    `INSERT INTO file_uploads (filename, content_type, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (filename) DO UPDATE
     SET content_type = EXCLUDED.content_type, data = EXCLUDED.data`,
    [filename, contentType || 'application/octet-stream', buffer]
  );
}

async function getFromPostgres(filename) {
  const pg = getPool();
  const { rows } = await pg.query(
    'SELECT content_type, data FROM file_uploads WHERE filename = $1',
    [filename]
  );
  if (!rows.length) return null;
  return { type: 'pg', contentType: rows[0].content_type, buffer: rows[0].data };
}

async function saveUpload(filename, buffer, contentType) {
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    const result = await put(blobPath(filename), buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: result.url, local: false };
  }

  if (usePgStorage()) {
    await saveToPostgres(filename, buffer, contentType);
    return { url: null, local: false, pg: true };
  }

  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return { url: null, local: true };
}

async function getUpload(filename) {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    return { type: 'local', filePath };
  }

  if (usePgStorage()) {
    const pgFile = await getFromPostgres(filename);
    if (pgFile) return pgFile;
  }

  if (useBlob()) {
    const { head } = await import('@vercel/blob');
    try {
      const meta = await head(blobPath(filename), { token: process.env.BLOB_READ_WRITE_TOKEN });
      return { type: 'blob', url: meta.url, contentType: meta.contentType };
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = { UPLOADS_DIR, useBlob, usePgStorage, saveUpload, getUpload };