// src/init-db.ts
// Initializes all database tables and seeds default admin account
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
      CREATE INDEX IF NOT EXISTS idx_citizens_user_id ON citizens(user_id);

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
          pin VARCHAR(100),
          tax_declaration_number VARCHAR(100),
          property_location TEXT,
          assigned_officer VARCHAR(255),
          payment_status VARCHAR(50) DEFAULT 'Pending',
          documents TEXT[],
          created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lgu_rpt_records (
          id SERIAL PRIMARY KEY,
          taxDeclarationNumber VARCHAR(100) UNIQUE NOT NULL,
          pin VARCHAR(100),
          ownerName VARCHAR(255),
          propertyLocation TEXT,
          barangay VARCHAR(100),
          propertyType VARCHAR(50),
          billingYear INT,
          quarter VARCHAR(20),
          basicTax NUMERIC(12, 2) DEFAULT 0,
          sefTax NUMERIC(12, 2) DEFAULT 0,
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
          amountDue NUMERIC(12, 2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS citizen_rpt_payments (
          id SERIAL PRIMARY KEY,
          rpt_record_id INT REFERENCES lgu_rpt_records(id),
          tax_declaration_number VARCHAR(100) NOT NULL,
          owner_name VARCHAR(255) NOT NULL,
          amount NUMERIC(12, 2) NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          payment_reference VARCHAR(100) UNIQUE NOT NULL,
          official_receipt_number VARCHAR(100) UNIQUE NOT NULL,
          payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure documents column exists on tables created before the column was added
    await pool.query(`
      ALTER TABLE rpt_applications
      ADD COLUMN IF NOT EXISTS documents TEXT[];

      ALTER TABLE citizen_rpt_payments
      ADD COLUMN IF NOT EXISTS paymongo_session_id VARCHAR(255);
    `);

    // Seed default admin account with hashed password
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);
    await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ('System Administrator', 'admin@treasury.gov.ph', $1, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [hashedAdminPassword]
    );

    console.log('✅ Database tables checked/initialized successfully.');
  } catch (err) {
    const error = err as Error;
    console.error('❌ Error initializing database tables:', error.message || error);
  }
}
