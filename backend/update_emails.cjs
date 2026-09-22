const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/revenue_treasury'
});

async function run() {
  try {
    const trackingNumbers = [
      'QC-BT-2025-00101', 'QC-BT-2025-00102', 'QC-BT-2025-00103', 'QC-BT-2025-00104', 'QC-BT-2025-00105',
      'QC-BT-2025-00106', 'QC-BT-2025-00107', 'QC-BT-2025-00108', 'QC-BT-2025-00109', 'QC-BT-2025-00110'
    ];
    await pool.query(`UPDATE business_assessments SET email = 'defshishui@gmail.com' WHERE tracking_number = ANY($1)`, [trackingNumbers]);
    console.log('Updated emails successfully.');
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
