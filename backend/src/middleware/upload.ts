// src/middleware/upload.ts
// Using memory storage so uploaded files are available as Buffer objects
// in req.file.buffer / req.files[n].buffer — no filesystem writes needed.
// This is required for Railway (and other ephemeral-filesystem platforms)
// where writable directories are not guaranteed to persist across deploys.
import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 10,                  // max 10 files per request
  },
});
