const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.arhmduutyuoiqfgduuve:revenuesystem12@*@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' });
client.connect().then(() => {
  return client.query(`
    INSERT INTO business_assessments (
        id, tracking_number, tax_bill_number, business_name, business_owner,
        business_address, barangay, business_type, line_of_business,
        mayors_permit_number, status, payment_status, application_source, is_linked, email
      ) VALUES
      (
        'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e', 'QC-BT-2025-00111', 'TB-2025-1011', 'Shishui Tech Solutions', 'Def Shishui',
        'Block 12 Lot 4, Commonwealth Avenue', 'Commonwealth', 'Corporation', 'IT Services',
        'MP-2025-0123456', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'defshishui@gmail.com'
      ),
      (
        'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f', 'QC-BT-2025-00112', 'TB-2025-1012', 'Def Trading Corp', 'Def Shishui',
        'Lot 8, Katipunan Avenue', 'Loyola Heights', 'Corporation', 'Retail',
        'MP-2025-0987654', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'defshishui@gmail.com'
      ),
      (
        'd3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a', 'QC-BT-2025-00113', 'TB-2025-1013', 'Shishui Eatery', 'Def Shishui',
        'Unit 4B, North Fairview', 'Greater Fairview', 'Sole Proprietorship', 'Restaurant',
        'MP-2025-0456789', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'defshishui@gmail.com'
      ),
      (
        'e4f5a6b7-c8d9-4e0f-1a2b-3c4d5e6f7a8b', 'QC-BT-2025-00114', 'TB-2025-1014', 'Def Manila Enterprises', 'Def Shishui',
        'Quezon Avenue', 'South Triangle', 'Partnership', 'Wholesale',
        'MP-2025-0741852', 'TAX_BILL_ISSUED', 'UNPAID', 'ONLINE', TRUE, 'defshishui@gmail.com'
      ),
      (
        '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'QC-BT-2025-00115', 'TB-2025-1015', 'Shishui Tech Innovations', 'Def Shishui',
        'East Avenue', 'Central', 'Corporation', 'Software Development',
        'MP-2025-1112223', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'defshishui@gmail.com'
      );
  `);
}).then(res => {
  console.log('Inserted:', res.rowCount);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
