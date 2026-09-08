import dns from 'dns';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { corsMiddleware } from './middleware/cors.js';
import { decryptRequest, encryptResponse } from './middleware/payloadCrypto.js';
import routes from './routes/index.js';
import { initializeDatabase } from './init-db.js';
import { EmailService } from './services/email.service.js';
import pool from './db.js';


try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {

}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);


app.set('trust proxy', true);

app.use(corsMiddleware);


app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.text({ limit: '200mb' }));


app.use((req, res, next) => {

  const skip = ['/', '/health', '/setup-admin', '/uploads'];
  if (skip.some(p => req.path === p || req.path.startsWith('/uploads'))) {
    return next();
  }
  decryptRequest(req, res, () => encryptResponse(req, res, next));
});

console.log(" REAL Express JSON limit successfully set to 200MB!");


[
  path.join(__dirname, '../uploads'),
  path.join(__dirname, '../../uploads'),
  path.join(process.cwd(), 'uploads'),
  path.join(process.cwd(), 'backend/uploads')
].forEach((dir) => {
  app.use('/uploads', express.static(dir));
});


app.get(['/', '/health'], (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Revenue & Treasury Backend API',
    timestamp: new Date().toISOString(),
  });
});


app.get('/setup-admin', async (req, res) => {
  if (req.query.secret !== 'treasury-setup-2026') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  try {
    const hashedPassword = await bcrypt.hash('Admin@1234', 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ('Hero Odiaman', 'dizon.hero.odiaman@gmail.com', $1, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin', name = EXCLUDED.name, password = EXCLUDED.password
       RETURNING id, name, email, role`,
      [hashedPassword]
    );
    res.status(200).json({ message: 'Admin account ready!', user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});


app.use(routes);


initializeDatabase().catch((err: Error) =>
  console.error('Database startup background error:', err.message || err)
);


EmailService.verifyConnection().catch((err: Error) =>
  console.warn('SMTP startup verify warning:', err.message || err)
);


app.listen(PORT, '0.0.0.0', () => {
  console.log(` Municipal Treasury Backend running on http://0.0.0.0:${PORT}`);
});

export default app;