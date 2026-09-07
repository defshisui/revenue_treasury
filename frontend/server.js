import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import hawkerRoutes from './routes/hawker.routes.js';
import marketRoutes from './routes/market.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 5173;

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(hawkerRoutes);
app.use(marketRoutes);

app.use(express.static(DIST_DIR));

app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fullstack Production Server running on http://0.0.0.0:${PORT}`);
});