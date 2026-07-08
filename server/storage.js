const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(PUBLIC_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobPath(filename) {
  return `uploads/${filename}`;
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

  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return { url: null, local: true };
}

async function getUpload(filename) {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    return { type: 'local', filePath };
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

module.exports = { UPLOADS_DIR, useBlob, saveUpload, getUpload };