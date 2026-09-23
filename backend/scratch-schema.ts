import pool from './src/db.js';

async function check() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'lgu_rpt_records'");
  console.log('lgu_rpt_records:', res.rows.map(r => r.column_name));
  process.exit(0);
}
check();
