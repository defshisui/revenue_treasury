import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. IMPORT YOUR ACTUAL MODULAR ROUTES
// Adjust the paths if your compiled JS files are in a different folder (e.g., './dist/routes/...')
import hawkerRoutes from './routes/hawker.routes.js';
import marketRoutes from './routes/market.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 5173;

const app = express();

// 2. INCREASE PAYLOAD LIMIT FOR BASE64 IMAGES
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ATTACH YOUR REAL BACKEND CONTROLLERS
app.use(hawkerRoutes);
app.use(marketRoutes);

// 4. FRONTEND STATIC SERVING (React SPA)
app.use(express.static(DIST_DIR));

// SPA Fallback: Any request that doesn't match an API route above gets sent to React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fullstack Production Server running on http://0.0.0.0:${PORT}`);
});