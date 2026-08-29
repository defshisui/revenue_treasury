// src/server.ts
import dns from 'dns';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { corsMiddleware } from './middleware/cors.js';
import routes from './routes/index.js';
import { initializeDatabase } from './init-db.js';
import { EmailService } from './services/email.service.js';

// Prefer IPv4 globally to avoid connection timeouts on platforms with unroutable IPv6
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore in older node versions
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from process cwd, backend dir, and root dir
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust proxy (needed for correct IP behind Railway / reverse proxy)
app.set('trust proxy', true);

// Middleware
app.use(corsMiddleware);

// ==========================================
// 🚨 FIX: INCREASE PAYLOAD LIMITS FOR BASE64 IMAGES 🚨
// ==========================================
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.text({ limit: '200mb' })); // For navigator.sendBeacon (text/plain payloads)

console.log("✅ REAL Express JSON limit successfully set to 200MB!");

// Static file serving for uploaded documents
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Health check endpoint (Railway healthcheck)
app.get(['/', '/health'], (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Revenue & Treasury Backend API',
    timestamp: new Date().toISOString(),
  });
});

// Mount all feature routes
app.use(routes);

// Initialize DB tables (non-blocking)
initializeDatabase().catch((err: Error) =>
  console.error('Database startup background error:', err.message || err)
);

// Verify SMTP connection (non-blocking)
EmailService.verifyConnection().catch((err: Error) =>
  console.warn('SMTP startup verify warning:', err.message || err)
);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Municipal Treasury Backend running on http://0.0.0.0:${PORT}`);
});

export default app;