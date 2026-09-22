const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/revenue_treasury'
});

async function run() {
  try {
    await pool.query(`
      INSERT INTO business_assessments (
        id, tracking_number, tax_bill_number, business_name, business_owner,
        business_address, barangay, business_type, line_of_business,
        mayors_permit_number, status, payment_status, application_source, is_linked, email
      ) VALUES
      (
        'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e', 'QC-BT-2025-00101', 'TB-2025-1001', 'Jomell Tech Solutions', 'Jomell Cruz',
        'Block 12 Lot 4, Commonwealth Avenue', 'Commonwealth', 'Corporation', 'IT Services',
        'MP-2025-0123456', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'jomell@gmail.com'
      ),
      (
        'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f', 'QC-BT-2025-00102', 'TB-2025-1002', 'Hero Trading Corp', 'Hero Odiaman',
        'Lot 8, Katipunan Avenue', 'Loyola Heights', 'Corporation', 'Retail',
        'MP-2025-0987654', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'dizon.hero.odiaman@gmail.com'
      ),
      (
        'd3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a', 'QC-BT-2025-00103', 'TB-2025-1003', 'Citizen Eatery', 'Citizen User',
        'Unit 4B, North Fairview', 'Greater Fairview', 'Sole Proprietorship', 'Restaurant',
        'MP-2025-0456789', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'citizen@govserve.gov.ph'
      ),
      (
        'e4f5a6b7-c8d9-4e0f-1a2b-3c4d5e6f7a8b', 'QC-BT-2025-00104', 'TB-2025-1004', 'Metro Manila Enterprises', 'Maria Santos',
        'Quezon Avenue', 'South Triangle', 'Partnership', 'Wholesale',
        'MP-2025-0741852', 'TAX_BILL_ISSUED', 'UNPAID', 'ONLINE', TRUE, 'maria@example.com'
      ),
      (
        'f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c', 'QC-BT-2025-00105', 'TB-2025-1005', 'QC General Merchandise', 'Juan Dela Cruz',
        'Kamuning Road', 'Kamuning', 'Sole Proprietorship', 'Retail',
        'MP-2025-0852963', 'TAX_BILL_ISSUED', 'PAID', 'IN_PERSON', FALSE, 'juan@example.com'
      ),
      (
        '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'QC-BT-2025-00106', 'TB-2025-1006', 'Manila Tech Innovations', 'Rizalino Perez',
        'East Avenue', 'Central', 'Corporation', 'Software Development',
        'MP-2025-1112223', 'TAX_BILL_ISSUED', 'PAID', 'ONLINE', TRUE, 'rizalino@tech.ph'
      ),
      (
        '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', 'QC-BT-2025-00107', 'TB-2025-1007', 'Mabuhay Bakery', 'Lourdes Reyes',
        'Visayas Avenue', 'Vasra', 'Sole Proprietorship', 'Bakery',
        'MP-2025-2223334', 'TAX_BILL_ISSUED', 'PAID', 'IN_PERSON', FALSE, 'lourdes@bakery.com'
      ),
      (
        '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'QC-BT-2025-00108', 'TB-2025-1008', 'Tomas Morato Hardware', 'Miguel Lim',
        'Tomas Morato Ave', 'Obrero', 'Partnership', 'Hardware',
        'MP-2025-3334445', 'TAX_BILL_ISSUED', 'UNPAID', 'IN_PERSON', FALSE, 'miguel@hardware.com'
      ),
      (
        '4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'QC-BT-2025-00109', 'TB-2025-1009', 'GovServ Trading Co.', 'Ana Garcia',
        'EDSA Cubao', 'San Martin de Porres', 'Corporation', 'Wholesale',
        'MP-2025-4445556', 'TAX_BILL_ISSUED', 'PAID', 'IN_PERSON', FALSE, 'ana@govserv.com'
      ),
      (
        '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', 'QC-BT-2025-00110', 'TB-2025-1010', 'Diliman Cafe', 'Jose Villanueva',
        'Maginhawa Street', 'Teachers Village East', 'Sole Proprietorship', 'Restaurant',
        'MP-2025-5556667', 'TAX_BILL_ISSUED', 'UNPAID', 'IN_PERSON', FALSE, 'jose@dilimancafe.ph'
      )
      ON CONFLICT DO NOTHING;
    `);
    console.log('Seeded Business Tax successfully.');
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
