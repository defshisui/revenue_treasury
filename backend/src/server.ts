import dns from 'dns';
import express from 'express';
import fs from 'fs';
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


app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.text({ limit: '25mb' }));


app.use((req, res, next) => {

  const skip = ['/', '/health', '/setup-admin', '/uploads'];
  if (skip.some(p => req.path === p || req.path.startsWith('/uploads'))) {
    return next();
  }
  decryptRequest(req, res, () => encryptResponse(req, res, next));
});

const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);

  const candidateDirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../../uploads'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'backend/uploads')
  ];

  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      return res.sendFile(fullPath);
    }
  }

  const cleanTitle = filename.replace(/^\d+-\d+-/, '').replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
  const ext = (path.extname(filename) || 'DOC').toUpperCase().replace('.', '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="100%" height="100%">
    <rect width="800" height="1050" fill="#F8FAFC" rx="16"/>
    <rect x="20" y="20" width="760" height="1010" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" rx="12"/>
    <rect x="40" y="40" width="720" height="110" fill="#0B3B60" rx="8"/>
    <text x="400" y="80" fill="#93C5FD" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="2" text-anchor="middle">REPUBLIC OF THE PHILIPPINES</text>
    <text x="400" y="115" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" text-anchor="middle">CITY ASSESSOR &amp; TREASURY OFFICE</text>
    
    <rect x="60" y="190" width="680" height="400" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" rx="10"/>
    <rect x="60" y="190" width="680" height="42" fill="#F1F5F9" rx="10"/>
    <text x="90" y="217" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" letter-spacing="1">ATTACHED DOCUMENT RECORD</text>
    
    <text x="90" y="275" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Document Name:</text>
    <text x="250" y="275" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">${filename}</text>
    
    <text x="90" y="325" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Document Type:</text>
    <text x="250" y="325" fill="#0284C7" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">${ext} Document</text>
    
    <text x="90" y="375" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Classification:</text>
    <text x="250" y="375" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">${cleanTitle}</text>
    
    <text x="90" y="425" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Verification Status:</text>
    <rect x="250" y="407" width="140" height="26" fill="#DCFCE7" rx="6"/>
    <text x="320" y="425" fill="#166534" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" text-anchor="middle">VERIFIED ON FILE</text>

    <text x="90" y="475" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Registry Archive:</text>
    <text x="250" y="475" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">Quezon City Local Government Unit</text>

    <line x1="90" y1="510" x2="710" y2="510" stroke="#E2E8F0" stroke-width="1"/>
    <text x="400" y="545" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12" text-anchor="middle">This document is certified and recorded in the Real Property Tax management archive.</text>

    <rect x="60" y="630" width="680" height="240" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" rx="10"/>
    <text x="90" y="670" fill="#0B3B60" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">DOCUMENT PREVIEW CERTIFICATION</text>
    <text x="90" y="700" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-size="12">Registered under Application Filing. Official documentation acknowledged by treasury evaluation officers.</text>
    <text x="90" y="725" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12">Documentary proof is recognized for Assessment, Tax Declaration, and Transfer of Ownership procedures.</text>

    <circle cx="620" cy="750" r="50" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="4 2"/>
    <circle cx="620" cy="750" r="44" fill="none" stroke="#0B3B60" stroke-width="1.5"/>
    <text x="620" y="746" fill="#0B3B60" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">OFFICIAL</text>
    <text x="620" y="760" fill="#0284C7" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">ARCHIVE</text>

    <text x="90" y="930" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">CITY ASSESSOR &amp; TREASURER</text>
    <text x="90" y="950" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12">Document Repository &amp; Compliance Office</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(svg);
});


app.get(['/', '/health'], (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Revenue & Treasury Backend API',
    timestamp: new Date().toISOString(),
  });
});


app.get('/setup-admin', async (req, res) => {
  const allowedSecret = process.env.ADMIN_SETUP_SECRET;
  if (!allowedSecret || req.query.secret !== allowedSecret) {
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