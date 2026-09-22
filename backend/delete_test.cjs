const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/revenue_treasury'
});

async function run() {
  try {
    const trackingNumbers = [
      'BT-2026-831228',
      'BT-2026-889716',
      'BT-2026-397916',
      'BT-2026-180656',
      'BT-NEW-2026-730290',
      'BT-2026-131580'
    ];
    
    // Also delete any other obvious test ones
    await pool.query(`DELETE FROM business_assessments WHERE tracking_number = ANY($1) OR business_owner = 'kean jorban' OR business_name ILIKE '%test%' OR business_name ILIKE '%dawd%' OR business_name ILIKE '%joji%'`, [trackingNumbers]);
    
    console.log('Deleted test records.');
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
