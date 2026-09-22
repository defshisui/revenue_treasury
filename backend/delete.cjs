const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.arhmduutyuoiqfgduuve:revenuesystem12@*@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });
client.connect().then(() => {
  return client.query(`DELETE FROM business_assessments WHERE tracking_number IN ('QC-BT-2025-00101', 'QC-BT-2025-00102', 'QC-BT-2025-00103', 'QC-BT-2025-00104', 'QC-BT-2025-00106');`);
}).then(res => {
  console.log('Deleted:', res.rowCount);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
