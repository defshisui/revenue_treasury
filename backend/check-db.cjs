const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.arhmduutyuoiqfgduuve:revenuesystem12@*@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });
client.connect()
  .then(() => client.query("SELECT tracking_number, business_name FROM business_assessments WHERE tracking_number LIKE 'OLD-BT%'"))
  .then((res) => { console.log('Found:', res.rows); return client.end(); })
  .catch(err => { console.error('Error:', err); process.exit(1); });
