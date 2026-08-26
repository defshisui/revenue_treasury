import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 5173;

const app = express();

// Middleware to parse incoming JSON data from the frontend
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// 1. DATABASE CONNECTION (Railway)
// ==========================================
// This automatically connects to your Railway PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ==========================================
// 2. API ROUTES (Database Operations)
// ==========================================

// DELETE: Completely remove a record from the database
app.delete('/api/hawkers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Note: Verify that your table is actually named 'hawker_associations'
    await pool.query('DELETE FROM hawker_associations WHERE id = $1', [id]);

    console.log(`Successfully deleted record ${id}`);
    res.status(200).json({ message: 'Deleted successfully from database' });
  } catch (error) {
    console.error('Database deletion error:', error);
    res.status(500).json({ error: 'Failed to delete record from the database' });
  }
});

// GET: Fetch records from the database
app.get('/api/hawkers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hawker_associations ORDER BY id DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// PUT: Update a record's status in the database
app.put('/api/hawkers/:id', async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  try {
    await pool.query(
      'UPDATE hawker_associations SET status = $1, remarks = $2 WHERE id = $3',
      [status, remarks, id]
    );
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    console.error('Database update error:', error);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// POST: Create a new walk-in record
app.post('/api/hawkers', async (req, res) => {
  try {
    // Extract the properties from req.body and write your INSERT query here based on your table columns
    // Example: await pool.query('INSERT INTO hawker_associations (...) VALUES (...)', [...]);
    res.status(201).json({ message: 'Record created successfully' });
  } catch (error) {
    console.error('Database insertion error:', error);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// ==========================================
// 3. FRONTEND STATIC SERVING (React SPA)
// ==========================================

// Serve the compiled React application files from the 'dist' folder
app.use(express.static(DIST_DIR));

// SPA Fallback: Any request that doesn't match an API route above gets sent to React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fullstack Production Server running on http://0.0.0.0:${PORT}`);
});