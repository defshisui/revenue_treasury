import bcrypt from 'bcryptjs';
import pool from './db.js';

export async function initializeDatabase(): Promise<void> {
  try {
    const client = await pool.connect();

    console.log('✅ Successfully connected to the PostgreSQL database.');

    client.release();



    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'treasury-staff',
          created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          audit_id VARCHAR(50) NOT NULL,
          user_email VARCHAR(255) NOT NULL,
          user_role VARCHAR(50) NOT NULL,
          module VARCHAR(100) NOT NULL,
          action VARCHAR(100) NOT NULL,
          severity VARCHAR(50) DEFAULT 'INFO',
          ip_address VARCHAR(100),
          user_agent TEXT,
          previous_data TEXT,
          new_data TEXT,
          is_archived BOOLEAN DEFAULT FALSE,
          timestamp TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS citizens (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          first_name VARCHAR(100) NOT NULL,
          middle_name VARCHAR(100),
          last_name VARCHAR(100) NOT NULL,
          suffix VARCHAR(20),
          birth_date DATE NOT NULL,
          house_no_street TEXT NOT NULL,
          barangay VARCHAR(100) NOT NULL,
          city VARCHAR(100) NOT NULL,
          occupation VARCHAR(100),
          sex VARCHAR(20),
          mobile_number VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_citizens_user_id
      ON citizens(user_id);

      CREATE TABLE IF NOT EXISTS hawker_associations (
          id UUID PRIMARY KEY,
          association_number VARCHAR(50) UNIQUE NOT NULL,
          association_name VARCHAR(255) NOT NULL,
          sec_registration_no VARCHAR(100),
          date_issued VARCHAR(50),
          contact_number VARCHAR(20) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          middle_name VARCHAR(100),
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          submitted_by VARCHAR(255) NOT NULL,
          submitter_email VARCHAR(255) NOT NULL,
          submission_date VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'New',
          remarks TEXT,
          member_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS market_leases (
          id SERIAL PRIMARY KEY,
          lease_id VARCHAR(100) UNIQUE NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          market_name VARCHAR(255) NOT NULL,
          section VARCHAR(100) NOT NULL,
          stall_number VARCHAR(50) NOT NULL,
          lease_status VARCHAR(50) DEFAULT 'Active',
          amount_due NUMERIC DEFAULT 0,
          helper_approval_status VARCHAR(50) DEFAULT 'Pending',
          advance_payment_status VARCHAR(50) DEFAULT 'Requested',
          payment_status VARCHAR(50) DEFAULT 'Pending Payment',
          payment_method VARCHAR(100) DEFAULT 'Cash / Direct',
          created_at TIMESTAMP DEFAULT NOW()
      );

      -- ==========================================================
      -- REAL PROPERTY TAX APPLICATIONS
      -- ==========================================================

      CREATE TABLE IF NOT EXISTS rpt_applications (
          id UUID PRIMARY KEY,

          control_number VARCHAR(100),
          reference_number VARCHAR(100),

          email VARCHAR(255),
          mobile_number VARCHAR(50),

          service VARCHAR(100),
          filed_date VARCHAR(50),

          status VARCHAR(50) DEFAULT 'Pending',
          penalty NUMERIC DEFAULT 0,

          applicant_name VARCHAR(255) NOT NULL,
          owner_name VARCHAR(255),
          applicant_type VARCHAR(100),

          pin VARCHAR(100),
          tax_declaration_number VARCHAR(100),

          property_location TEXT,
          barangay VARCHAR(100),
          property_type VARCHAR(100),

          assigned_officer VARCHAR(255),

          payment_status VARCHAR(50) DEFAULT 'Pending',

          documents JSONB DEFAULT '[]'::jsonb,

          notes TEXT,

          created_at TIMESTAMP DEFAULT NOW()
      );

      -- ==========================================================
      -- LGU REAL PROPERTY TAX MASTER RECORDS
      -- ==========================================================

      CREATE TABLE IF NOT EXISTS lgu_rpt_records (
          id SERIAL PRIMARY KEY,

          taxDeclarationNumber VARCHAR(100) UNIQUE NOT NULL,
          pin VARCHAR(100),
          new_pspin VARCHAR(100),

          ownerName VARCHAR(255),
          propertyLocation TEXT,
          barangay VARCHAR(100),
          propertyType VARCHAR(50),

          billingYear INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
          quarter VARCHAR(20) DEFAULT 'Q1-Q4',

          bill_expiry_date VARCHAR(50),

          lot_area_sqm NUMERIC(12, 2) DEFAULT 0,
          market_value NUMERIC(12, 2) DEFAULT 0,
          assessed_value NUMERIC(12, 2) DEFAULT 0,

          basicTax NUMERIC(12, 2) DEFAULT 0,
          sefTax NUMERIC(12, 2) DEFAULT 0,
          shttc_applied NUMERIC(12, 2) DEFAULT 0,
          specialLevy NUMERIC(12, 2) DEFAULT 0,

          penalty NUMERIC(12, 2) DEFAULT 0,
          discount NUMERIC(12, 2) DEFAULT 0,

          totalAssessment NUMERIC(12, 2) DEFAULT 0,
          amountPaid NUMERIC(12, 2) DEFAULT 0,
          balance NUMERIC(12, 2) DEFAULT 0,

          status VARCHAR(50) DEFAULT 'Unpaid',
          paymentStatus VARCHAR(50) DEFAULT 'Unpaid',

          paymentMethod VARCHAR(50),
          officialReceiptNumber VARCHAR(100),
          paymentReference VARCHAR(100),
          paymentDate DATE,

          amountDue NUMERIC(12, 2) DEFAULT 0,

          quarterly_amounts JSONB
      );

      -- ==========================================================
      -- RPT PAYMENTS
      -- ==========================================================

      CREATE TABLE IF NOT EXISTS citizen_rpt_payments (
          id SERIAL PRIMARY KEY,

          rpt_record_id INT
              REFERENCES lgu_rpt_records(id),

          tax_declaration_number VARCHAR(100) NOT NULL,
          owner_name VARCHAR(255) NOT NULL,

          amount NUMERIC(12, 2) NOT NULL,

          payment_method VARCHAR(50) NOT NULL,

          payment_reference VARCHAR(100) UNIQUE NOT NULL,

          official_receipt_number VARCHAR(100) UNIQUE NOT NULL,

          payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          payment_option VARCHAR(50) DEFAULT 'Full',

          quarter_coverage VARCHAR(50)
              DEFAULT '2025(Q1) - 2025(Q4)',

          paymongo_session_id VARCHAR(255)
      );

      -- ==========================================================
      -- OTP VERIFICATIONS
      -- ==========================================================

      CREATE TABLE IF NOT EXISTS otp_verifications (
          id SERIAL PRIMARY KEY,

          user_id INT
              REFERENCES users(id)
              ON DELETE CASCADE,

          email VARCHAR(255) NOT NULL,

          otp_hash VARCHAR(255) NOT NULL,

          purpose VARCHAR(50) NOT NULL,

          expires_at TIMESTAMPTZ NOT NULL,

          attempts INT DEFAULT 0,

          used BOOLEAN DEFAULT FALSE,

          payload JSONB,

          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS
      idx_otp_verifications_email_purpose
      ON otp_verifications(email, purpose);

      CREATE INDEX IF NOT EXISTS
      idx_otp_verifications_created_at
      ON otp_verifications(created_at);

      -- ==========================================================
      -- BUSINESS ASSESSMENTS
      -- ==========================================================
      CREATE TABLE IF NOT EXISTS business_assessments (
          id VARCHAR(100) PRIMARY KEY,
          tracking_number VARCHAR(100) UNIQUE NOT NULL,
          tax_bill_number VARCHAR(100) UNIQUE,
          business_name VARCHAR(255) NOT NULL,
          business_owner VARCHAR(255),
          status VARCHAR(50) DEFAULT 'PENDING',
          psic_code VARCHAR(50),
          gross_sales NUMERIC(15, 2) DEFAULT 0,
          tin VARCHAR(50),
          email VARCHAR(255),
          attachments JSONB DEFAULT '[]'::jsonb,
          application_date TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);



    await pool.query(`
      -- USERS
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS department VARCHAR(255);
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar TEXT;
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT FALSE;
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS current_session_id TEXT;

      -- USER SESSIONS
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT UNIQUE NOT NULL,
        token TEXT,
        device_info TEXT,
        ip_address TEXT,
        city_location TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_heartbeat TIMESTAMPTZ DEFAULT NOW()
      );

      -- CONCURRENT LOGIN ALERTS
      CREATE TABLE IF NOT EXISTS concurrent_login_alerts (
        id VARCHAR(64) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        user_email TEXT NOT NULL,
        new_session_id TEXT NOT NULL,
        login_time TEXT NOT NULL,
        browser_info TEXT NOT NULL,
        city_location TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- AUDIT LOGS
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

      -- ==========================================================
      -- RPT APPLICATIONS
      -- ==========================================================

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS control_number VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(50);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS service VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS filed_date VARCHAR(50);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending';

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS penalty NUMERIC DEFAULT 0;

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS applicant_name VARCHAR(255);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS applicant_type VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS pin VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS tax_declaration_number VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS property_location TEXT;

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS barangay VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS property_type VARCHAR(100);

      ALTER TABLE market_leases
      ADD COLUMN IF NOT EXISTS official_receipt_number VARCHAR(100);

      ALTER TABLE market_leases
      ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(150);

      ALTER TABLE market_leases
      ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

      ALTER TABLE market_leases
      ADD COLUMN IF NOT EXISTS payment_proof TEXT;

      ALTER TABLE market_leases
      ADD COLUMN IF NOT EXISTS mismatch_notes TEXT;

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS assigned_officer VARCHAR(255);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50)
      DEFAULT 'Pending';

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS notes TEXT;

      -- Transfer Tax / application payment fields
      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2) DEFAULT 0;

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS official_receipt_number VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS payment_due_date DATE;

      ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(80);
      ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS compliance_remarks TEXT;
      ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS transfer_tax_amount NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS transfer_tax_status VARCHAR(50) DEFAULT 'Not Assessed';
      ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS tin VARCHAR(50);
      ALTER TABLE rpt_applications ADD COLUMN IF NOT EXISTS tax_declaration_issued BOOLEAN DEFAULT FALSE;


      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS paymongo_session_id VARCHAR(255);

      -- ==========================================================
      -- RPT DOCUMENTS
      -- ==========================================================

      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS documents JSONB
      DEFAULT '[]'::jsonb;

      -- ==========================================================
      -- LGU RPT RECORDS
      -- ==========================================================

      ALTER TABLE lgu_rpt_records
      ADD COLUMN IF NOT EXISTS new_pspin VARCHAR(100);

      ALTER TABLE lgu_rpt_records
      ADD COLUMN IF NOT EXISTS bill_expiry_date VARCHAR(50);

      ALTER TABLE lgu_rpt_records
      ADD COLUMN IF NOT EXISTS shttc_applied NUMERIC(12, 2)
      DEFAULT 0;

      ALTER TABLE lgu_rpt_records
      ADD COLUMN IF NOT EXISTS lot_area_sqm NUMERIC(12, 2)
      DEFAULT 0;

      ALTER TABLE lgu_rpt_records
      ADD COLUMN IF NOT EXISTS market_value NUMERIC(12, 2)
      DEFAULT 0;

      ALTER TABLE lgu_rpt_records
      ADD COLUMN IF NOT EXISTS assessed_value NUMERIC(12, 2)
      DEFAULT 0;

      ALTER TABLE lgu_rpt_records
      ADD COLUMN IF NOT EXISTS quarterly_amounts JSONB;

      -- ==========================================================
      -- RPT PAYMENTS
      -- ==========================================================

      ALTER TABLE citizen_rpt_payments
      ADD COLUMN IF NOT EXISTS paymongo_session_id VARCHAR(255);

      ALTER TABLE citizen_rpt_payments
      ADD COLUMN IF NOT EXISTS payment_option VARCHAR(50);

      ALTER TABLE citizen_rpt_payments
      ADD COLUMN IF NOT EXISTS quarter_coverage VARCHAR(50);
    `);

    await pool.query(`
      UPDATE rpt_applications
      SET workflow_stage = COALESCE(workflow_stage, status),
          transfer_tax_status = COALESCE(transfer_tax_status, CASE WHEN service = 'Transfer of Ownership' AND payment_status IN ('Paid','Payment Completed') THEN 'Paid' ELSE 'Not Assessed' END)
      WHERE workflow_stage IS NULL OR transfer_tax_status IS NULL;
    `);



    await pool.query(`
      DO $$
      DECLARE
          documents_type TEXT;
      BEGIN
          SELECT data_type
          INTO documents_type
          FROM information_schema.columns
          WHERE table_name = 'rpt_applications'
            AND column_name = 'documents';

          IF documents_type = 'ARRAY' THEN

              ALTER TABLE rpt_applications
              ALTER COLUMN documents DROP DEFAULT;

              ALTER TABLE rpt_applications
              ALTER COLUMN documents TYPE JSONB
              USING
                CASE
                  WHEN documents IS NULL THEN '[]'::jsonb
                  ELSE to_jsonb(documents)
                END;

              ALTER TABLE rpt_applications
              ALTER COLUMN documents
              SET DEFAULT '[]'::jsonb;

          END IF;
      END
      $$;

      -- ==========================================================
      -- PERFORMANCE INDEXES
      -- ==========================================================
      -- RPT Applications
      CREATE INDEX IF NOT EXISTS idx_rpt_apps_tdn ON rpt_applications(tax_declaration_number);
      CREATE INDEX IF NOT EXISTS idx_rpt_apps_email_lower ON rpt_applications(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_rpt_apps_control_no ON rpt_applications(control_number);
      CREATE INDEX IF NOT EXISTS idx_rpt_apps_pin ON rpt_applications(pin);
      CREATE INDEX IF NOT EXISTS idx_rpt_apps_status ON rpt_applications(status);
      CREATE INDEX IF NOT EXISTS idx_rpt_apps_created_at ON rpt_applications(created_at DESC);

      -- LGU RPT Records
      CREATE INDEX IF NOT EXISTS idx_lgu_rpt_pin ON lgu_rpt_records(pin);
      CREATE INDEX IF NOT EXISTS idx_lgu_rpt_status ON lgu_rpt_records(status);
      CREATE INDEX IF NOT EXISTS idx_lgu_rpt_payment_status ON lgu_rpt_records(paymentstatus);
      CREATE INDEX IF NOT EXISTS idx_lgu_rpt_owner ON lgu_rpt_records(ownername);

      -- Citizen RPT Payments
      CREATE INDEX IF NOT EXISTS idx_rpt_payments_record_id ON citizen_rpt_payments(rpt_record_id);
      CREATE INDEX IF NOT EXISTS idx_rpt_payments_tdn ON citizen_rpt_payments(tax_declaration_number);
      CREATE INDEX IF NOT EXISTS idx_rpt_payments_date ON citizen_rpt_payments(payment_date DESC);
      CREATE INDEX IF NOT EXISTS idx_rpt_payments_ref ON citizen_rpt_payments(payment_reference);

      -- Audit Logs
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_email ON audit_logs(user_email);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_archived ON audit_logs(is_archived);

      -- Business Assessments
      CREATE INDEX IF NOT EXISTS idx_business_assessments_tracking ON business_assessments(tracking_number);
      CREATE INDEX IF NOT EXISTS idx_business_assessments_tax_bill ON business_assessments(tax_bill_number);
      CREATE INDEX IF NOT EXISTS idx_business_assessments_email ON business_assessments(email);
      CREATE INDEX IF NOT EXISTS idx_business_assessments_status ON business_assessments(status);
      CREATE INDEX IF NOT EXISTS idx_business_assessments_app_date ON business_assessments(application_date DESC);

      -- Users & OTP
      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_email_lower ON otp_verifications(LOWER(email), purpose);
    `);

    const hashedRealAdminPassword = await bcrypt.hash('Admin@1234', 12);
    await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ('Hero Odiaman', 'dizon.hero.odiaman@gmail.com', $1, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [hashedRealAdminPassword]
    );

    console.log('Database tables and performance indexes initialized successfully.');
  } catch (err) {
    const error = err as Error;
    console.error('Error initializing database tables:', error.message || error);
  }
}
