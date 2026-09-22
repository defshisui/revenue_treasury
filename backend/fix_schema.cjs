const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/revenue_treasury'
});

async function run() {
  try {
    const q1 = "ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending';";
    const q2 = "ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2) DEFAULT 0;";
    await pool.query(q1);
    await pool.query(q2);
    
    // Also try to add payment_status to business_assessments if it still fails
    await pool.query("ALTER TABLE business_assessments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID';");
    console.log('Done altering.');
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
