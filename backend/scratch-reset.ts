import pool from './src/db.js';
import { initializeDatabase } from './src/init-db.js';

async function resetDB() {
  try {
    await pool.query('DROP TABLE IF EXISTS business_assessments CASCADE');
    await pool.query('DROP TABLE IF EXISTS business_permits CASCADE');
    console.log('Tables dropped');
    await initializeDatabase();
    console.log('Database initialized');
    process.exit(0);
  } catch(e) {
    console.error(e.stack);
    process.exit(1);
  }
}

resetDB();
