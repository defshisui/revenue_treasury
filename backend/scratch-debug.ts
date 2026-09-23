import pool from './src/db.js';
import fs from 'fs';

async function debugDB() {
  const file = fs.readFileSync('./src/init-db.ts', 'utf8');
  const match1 = file.match(/await pool\.query\(`([\s\S]*?)`\);/);
  if(match1) {
    try {
      await pool.query(match1[1]);
      console.log('Query 1 success');
    } catch(e) {
      console.error('Query 1 failed:', e.message);
    }
  }
  process.exit(0);
}

debugDB();
