// server.js
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      process.env.FRONTEND_URL === '*' ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.up.railway.app') ||
      origin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, true); // Allow origin or customize if strict isolation needed
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json());
app.use(express.text()); // Parses text/plain payloads from navigator.sendBeacon

// Configure Multer storage for uploaded documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads')); // Ensure 'uploads' folder exists in your project root
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Make the uploads folder publicly accessible to view or download files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check and root endpoint
app.get(['/', '/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Revenue & Treasury Backend API',
    timestamp: new Date().toISOString()
  });
});

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: String(process.env.DB_PASSWORD || ''),
      }
);

pool.connect(async (err, client, release) => {
  if (err) {
    console.error('❌ Error acquiring database client:', err.stack);
    return;
  }
  console.log('✅ Successfully connected to the PostgreSQL database.');
  release();

  // Auto-initialize tables if they don't exist yet
  try {
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

    // Ensure documents column exists if rpt_applications already existed without it
    await pool.query(`
      ALTER TABLE rpt_applications 
      ADD COLUMN IF NOT EXISTS documents TEXT[];
    `);

    // Seed default administrator account if users table is empty
    await pool.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ('System Administrator', 'admin@treasury.gov.ph', 'admin123', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `);

    console.log('✅ Database tables checked/initialized successfully.');
  } catch (tableErr) {
    console.error('❌ Error initializing database tables:', tableErr);
  }
});

const loginAttemptsTracker = new Map();
const LOCKOUT_LIMIT = 5; 
const LOCKOUT_DURATION_SECONDS = 60; 

async function recordAudit(req, auditId, userEmail, userRole, moduleName, actionName, severity = 'INFO', prevData = null, newData = null) {
  try {
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'Unknown IP';
    const userAgent = req?.headers['user-agent'] || 'Unknown Agent';

    const query = `
      INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    await pool.query(query, [auditId, userEmail, userRole, moduleName, actionName, severity, ipAddress, userAgent, prevData, newData]);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// ==========================================
// AUDIT LOG ENDPOINTS
// ==========================================

app.get('/audit-logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    const formattedRecords = result.rows.map(row => ({
      id: row.id.toString(),
      auditId: row.audit_id,
      user: row.user_email,
      role: row.user_role,
      module: row.module,
      action: row.action,
      severity: row.severity || 'INFO',
      ipAddress: row.ip_address || 'N/A',
      userAgent: row.user_agent || 'N/A',
      previousData: row.previous_data || '',
      newData: row.new_data || '',
      timestamp: new Date(row.timestamp).toLocaleString()
    }));
    res.json(formattedRecords);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ message: 'Error loading audit logs' });
  }
});

app.post('/audit-logs', async (req, res) => {
  try {
    let logData = req.body;

    if (typeof logData === 'string') {
      try {
        logData = JSON.parse(logData);
      } catch (e) {
        // Fallback
      }
    }

    const {
      auditId = 'AUD-' + Math.floor(100000 + Math.random() * 900000),
      user = 'Anonymous',
      role = 'User',
      module = 'Authentication',
      action = 'LOGOUT',
      severity = 'INFO',
      previousData = null,
      newData = null
    } = logData || {};

    await recordAudit(req, auditId, user, role, module, action, severity, previousData, newData);
    res.status(200).json({ success: true, message: 'Audit log recorded via beacon.' });
  } catch (err) {
    console.error('Error saving beacon audit log:', err);
    res.status(500).json({ message: 'Failed to record audit log.' });
  }
});

app.delete('/audit-logs', async (req, res) => {
  try {
    const clientIP = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'Unknown';
    const clientAgent = req?.headers['user-agent'] || 'Unknown';

    await pool.query(`
      INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
      VALUES ('AUD-SYS-WIPE', 'system-admin@lgu.gov.ph', 'admin', 'System Security', 'AUDIT_LOGS_PURGED', 'CRITICAL', $1, $2, 'Table contained historical database records', 'Table records deleted via UI')
    `, [clientIP, clientAgent]);

    await pool.query('DELETE FROM audit_logs WHERE audit_id != \'AUD-SYS-WIPE\';');
    
    res.status(200).json({ message: 'Audit logs successfully cleared and archived.' });
  } catch (err) {
    console.error('Error clearing audit logs:', err);
    res.status(500).json({ message: 'Failed to clear audit logs.' });
  }
});

// ==========================================
// USER ENDPOINTS
// ==========================================

app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    const formattedUsers = result.rows.map(row => ({
      id: row.id.toString(),
      fullname: row.name || 'System User',
      username: row.email,
      role: row.role || 'admin',
      status: 'Active'
    }));
    res.json(formattedUsers);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Error loading user records' });
  }
});

app.post('/users', async (req, res) => {
  const { fullname, username, password, role } = req.body;

  if (!fullname || !username || !password) {
    return res.status(400).json({ message: 'Full name, username/email, and password are required.' });
  }

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [username.trim()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'A user with this email/username already exists.' });
    }

    const query = `
      INSERT INTO users (name, email, password, role, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, name, email, role;
    `;
    const result = await pool.query(query, [fullname.trim(), username.trim(), password.trim(), role || 'treasury-staff']);
    const newUser = result.rows[0];

    const clientIP = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'Unknown';
    const clientAgent = req?.headers['user-agent'] || 'Unknown';
    await pool.query(`
      INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
      VALUES ('AUD-USER-ADD', 'system-admin@lgu.gov.ph', 'admin', 'User Management', 'USER_CREATED', 'WARNING', $1, $2, NULL, $3)
    `, [clientIP, clientAgent, `Created user account for ${newUser.email} with role ${newUser.role}`]);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id.toString(),
        fullname: newUser.name,
        username: newUser.email,
        role: newUser.role,
        status: 'Active'
      }
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'Failed to create user in database.' });
  }
});

// ==========================================
// CITIZEN PROFILE ENDPOINTS
// ==========================================

app.get('/citizens/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM citizens WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Citizen profile not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching citizen profile:', err);
    res.status(500).json({ message: 'Error loading citizen profile.' });
  }
});

app.post('/citizens', async (req, res) => {
  const { 
    userId, firstName, middleName, lastName, suffix, 
    birthDate, houseNoStreet, barangay, city, 
    occupation, sex, mobileNumber 
  } = req.body;

  if (!userId || !firstName || !lastName || !mobileNumber || !birthDate || !houseNoStreet || !barangay || !city) {
    return res.status(400).json({ message: 'Please fill out all required citizen profile fields.' });
  }

  try {
    const existing = await pool.query('SELECT * FROM citizens WHERE user_id = $1', [userId]);
    let result;

    if (existing.rows.length > 0) {
      result = await pool.query(`
        UPDATE citizens 
        SET first_name = $1, middle_name = $2, last_name = $3, suffix = $4, 
            birth_date = $5, house_no_street = $6, barangay = $7, city = $8, 
            occupation = $9, sex = $10, mobile_number = $11
        WHERE user_id = $12
        RETURNING *;
      `, [firstName, middleName, lastName, suffix, birthDate, houseNoStreet, barangay, city, occupation, sex, mobileNumber, userId]);
    } else {
      result = await pool.query(`
        INSERT INTO citizens (
          user_id, first_name, middle_name, last_name, suffix, 
          birth_date, house_no_street, barangay, city, 
          occupation, sex, mobile_number
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `, [userId, firstName, middleName, lastName, suffix, birthDate, houseNoStreet, barangay, city, occupation, sex, mobileNumber]);
    }

    res.status(200).json({
      message: 'Citizen profile saved successfully',
      profile: result.rows[0]
    });
  } catch (err) {
    console.error('Error saving citizen profile:', err);
    res.status(500).json({ message: 'Failed to save citizen profile.' });
  }
});

// ==========================================
// REAL PROPERTY TAX (RPT) ENDPOINTS
// ==========================================

app.get('/citizen-rpt-applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rpt_applications ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching RPT applications:', err);
    res.status(500).json({ message: 'Error loading RPT applications' });
  }
});

// Uses upload.any() to process multipart file attachments alongside form data
app.post('/citizen-rpt-applications', upload.any(), async (req, res) => {
  const appData = req.body;

  // Extract file paths saved by multer
  const filePaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

  // Safely resolve applicant name from multiple possible frontend payload formats
  let resolvedApplicantName = 
    appData.applicantName || 
    appData.name || 
    appData.ownerName || 
    appData.fullName;

  if (!resolvedApplicantName && (appData.firstName || appData.lastName)) {
    resolvedApplicantName = `${appData.firstName || ''} ${appData.lastName || ''}`.trim();
  }

  if (!resolvedApplicantName) {
    resolvedApplicantName = appData.email ? appData.email.split('@')[0] : 'Unknown Applicant';
  }

  try {
    const query = `
      INSERT INTO rpt_applications 
      (id, control_number, reference_number, email, mobile_number, service, filed_date, status, penalty, applicant_name, pin, tax_declaration_number, property_location, assigned_officer, payment_status, documents)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;
    
    const values = [
      appData.id || crypto.randomUUID(),
      appData.controlNumber || null,
      appData.referenceNumber || null,
      appData.email || null,
      appData.mobileNumber || null,
      appData.service || null,
      appData.filedDate || new Date().toISOString().split('T')[0],
      appData.status || 'Pending',
      appData.penalty || 0,
      resolvedApplicantName, 
      appData.pin || appData.propertyDetails?.pin || null,
      appData.taxDeclarationNumber || null,
      appData.propertyLocation || appData.propertyDetails?.address || null,
      appData.assignedOfficer || null,
      appData.paymentStatus || 'Pending',
      filePaths // Stored as text[] array in PostgreSQL
    ];

    const result = await pool.query(query, values);
    
    await recordAudit(
      req,
      'AUD-RPT-SUBMIT',
      appData.email || 'citizen@gov.ph',
      'Citizen',
      'RPT Module',
      'RPT_APPLICATION_SUBMITTED',
      'INFO',
      null,
      `Submitted RPT application for applicant: ${resolvedApplicantName}`
    );

    res.status(201).json({
      message: 'RPT application saved successfully',
      record: result.rows[0]
    });
  } catch (err) {
    console.error('Error saving RPT application:', err);
    res.status(500).json({ message: 'Failed to save RPT application to database.' });
  }
});

app.get('/lgu-rpt-records', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lgu_rpt_records ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching LGU RPT records:', err);
    res.status(500).json({ message: 'Error loading LGU RPT records' });
  }
});

app.post('/citizen-rpt-payments', async (req, res) => {
  const {
    rptRecordId, taxDeclarationNumber, ownerName,
    amount, paymentMethod, paymentReference, officialReceiptNumber
  } = req.body;

  try {
    const paymentQuery = `
      INSERT INTO citizen_rpt_payments 
      (rpt_record_id, tax_declaration_number, owner_name, amount, payment_method, payment_reference, official_receipt_number, payment_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
      RETURNING *;
    `;
    await pool.query(paymentQuery, [
      rptRecordId, taxDeclarationNumber, ownerName,
      amount, paymentMethod, paymentReference, officialReceiptNumber
    ]);

    res.status(201).json({ success: true, message: 'Payment recorded successfully' });
  } catch (err) {
    console.error('Error processing RPT payment:', err);
    res.status(500).json({ message: 'Payment processing failed' });
  }
});

// ==========================================
// MARKET LEASES & TRANSACTIONS ENDPOINTS
// ==========================================

app.get('/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM market_leases ORDER BY created_at DESC');
    const formattedTransactions = result.rows.map(row => {
      let formattedDate = '2026-06-15';
      if (row.created_at) {
        const d = new Date(row.created_at);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      }

      return {
        id: row.id ? row.id.toString() : '1',
        transactionId: `TX-${row.lease_id || row.id}`,
        referenceNumber: row.lease_id || `REF-${row.id}`,
        taxpayer: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown Taxpayer',
        paymentType: 'Market Rental',
        amount: parseFloat(row.amount_due) || 0,
        paymentMethod: row.payment_method || 'Cash / Direct',
        collector: 'Municipal Treasury',
        date: formattedDate,
        status: (row.payment_status && row.payment_status.toLowerCase().includes('paid')) ? 'Posted' : 'Pending',
        remarks: `Stall ${row.stall_number || 'N/A'} (${row.market_name || 'Public Market'})`
      };
    });
    res.json(formattedTransactions);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ message: 'Error loading transactions' });
  }
});

app.post('/transactions', async (req, res) => {
  res.status(201).json({ message: 'Transaction recorded successfully (mocked)' });
});

app.get('/market-leases', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM market_leases ORDER BY created_at DESC');
    const formattedLeases = result.rows.map(row => ({
      id: row.id.toString(),
      leaseId: row.lease_id,
      firstName: row.first_name,
      lastName: row.last_name,
      marketName: row.market_name,
      section: row.section,
      stallNumber: row.stall_number,
      leaseStatus: row.lease_status,
      amountDue: parseFloat(row.amount_due) || 0,
      helperApprovalStatus: row.helper_approval_status,
      advancePaymentStatus: row.advance_payment_status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method || 'Cash / Direct',
      createdAt: row.created_at
    }));
    res.json(formattedLeases);
  } catch (err) {
    console.error('Error fetching market leases:', err);
    res.status(500).json({ message: 'Error loading market leases' });
  }
});

app.post('/market-leases', async (req, res) => {
  const {
    leaseId, firstName, lastName, marketName,
    section, stallNumber, leaseStatus, amountDue,
    helperApprovalStatus, advancePaymentStatus, paymentStatus, 
    paymentMethod, payment_method
  } = req.body;

  const rawPaymentMethod = paymentMethod || payment_method;
  const resolvedPaymentMethod = (rawPaymentMethod && String(rawPaymentMethod).trim() !== '') 
    ? String(rawPaymentMethod).trim() 
    : 'Cash / Direct';

  try {
    const query = `
      INSERT INTO market_leases 
      (lease_id, first_name, last_name, market_name, section, stall_number, lease_status, amount_due, helper_approval_status, advance_payment_status, payment_status, payment_method, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *;
    `;
    
    const values = [
      leaseId || `LEASE-${Date.now()}`,
      firstName,
      lastName,
      marketName,
      section,
      stallNumber,
      leaseStatus || 'Active',
      amountDue || 0,
      helperApprovalStatus || 'Pending',
      advancePaymentStatus || 'Requested',
      paymentStatus || 'Pending Payment',
      resolvedPaymentMethod
    ];

    const result = await pool.query(query, values);
    const newLease = result.rows[0];

    await recordAudit(
      req, 
      'AUD-MARKET-SUBMIT', 
      `${firstName}.${lastName}@citizen.gov.ph`, 
      'Citizen', 
      'Market Module', 
      'STALL_APPLICATION_SUBMITTED', 
      'INFO', 
      null, 
      `Applied for Stall ${stallNumber} at ${marketName} via ${resolvedPaymentMethod}`
    );

    res.status(201).json({
      message: 'Lease application saved successfully',
      lease: newLease
    });
  } catch (err) {
    console.error('Error saving market lease:', err);
    res.status(500).json({ message: 'Failed to save market lease application to database.' });
  }
});

app.put('/market-leases/:id', async (req, res) => {
  const { id } = req.params;
  const {
    firstName, lastName, marketName,
    section, stallNumber, leaseStatus, amountDue,
    helperApprovalStatus, advancePaymentStatus, paymentStatus, 
    paymentMethod, payment_method
  } = req.body;

  const rawPaymentMethod = paymentMethod || payment_method;
  const resolvedPaymentMethod = (rawPaymentMethod && String(rawPaymentMethod).trim() !== '') 
    ? String(rawPaymentMethod).trim() 
    : 'Cash / Direct';

  try {
    const query = `
      UPDATE market_leases 
      SET first_name = $1, last_name = $2, market_name = $3, section = $4, 
          stall_number = $5, lease_status = $6, amount_due = $7, 
          helper_approval_status = $8, advance_payment_status = $9, payment_status = $10, payment_method = $11
      WHERE lease_id = $12 OR id::text = $12
      RETURNING *;
    `;
    
    const values = [
      firstName, lastName, marketName, section, stallNumber,
      leaseStatus, amountDue || 0, helperApprovalStatus,
      advancePaymentStatus, paymentStatus, resolvedPaymentMethod, id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lease record not found' });
    }

    await recordAudit(
      req, 
      'AUD-MARKET-UPDATE', 
      'system-admin@lgu.gov.ph', 
      'admin', 
      'Market Module', 
      'STALL_APPLICATION_UPDATED', 
      'INFO', 
      null, 
      `Updated lease record for Stall ${stallNumber} (${id}) with payment method: ${resolvedPaymentMethod}`
    );

    res.status(200).json({
      message: 'Lease updated successfully',
      lease: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating market lease:', err);
    res.status(500).json({ message: 'Failed to update market lease in database.' });
  }
});

app.delete('/market-leases/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      DELETE FROM market_leases 
      WHERE lease_id = $1 OR id::text = $1
      RETURNING *;
    `;
    
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lease record not found in database' });
    }

    await recordAudit(
      req, 
      'AUD-MARKET-DELETE', 
      'system-admin@lgu.gov.ph', 
      'admin', 
      'Market Module', 
      'STALL_LEASE_DELETED', 
      'WARNING', 
      `Deleted lease record ${id}`, 
      null
    );

    res.status(200).json({
      message: 'Lease deleted successfully from database',
      deletedLease: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting market lease:', err);
    res.status(500).json({ message: 'Failed to delete market lease from database.' });
  }
});

// ==========================================
// HAWKER ASSOCIATION ENDPOINTS
// ==========================================

app.get('/api/hawkers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hawker_associations ORDER BY created_at DESC');
    const formattedHawkers = result.rows.map(row => ({
      id: row.id,
      associationNumber: row.association_number,
      associationName: row.association_name,
      secRegistrationNo: row.sec_registration_no,
      dateIssued: row.date_issued,
      contactNumber: row.contact_number,
      chairperson: {
        firstName: row.first_name,
        middleName: row.middle_name,
        lastName: row.last_name,
        email: row.email
      },
      submittedBy: row.submitted_by,
      submitterEmail: row.submitter_email,
      submissionDate: row.submission_date,
      status: row.status,
      remarks: row.remarks || '',
      memberCount: row.member_count || 0
    }));
    res.json(formattedHawkers);
  } catch (err) {
    console.error('Error fetching hawker associations:', err);
    res.status(500).json({ message: 'Error loading hawker associations' });
  }
});

app.post('/api/hawkers', async (req, res) => {
  const data = req.body;

  try {
    const query = `
      INSERT INTO hawker_associations 
      (id, association_number, association_name, sec_registration_no, date_issued, contact_number, first_name, middle_name, last_name, email, submitted_by, submitter_email, submission_date, status, remarks, member_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;
    
    const values = [
      data.id || crypto.randomUUID(),
      data.associationNumber,
      data.associationName,
      data.secRegistrationNo || '',
      data.dateIssued || '',
      data.contactNumber,
      data.chairperson?.firstName || '',
      data.chairperson?.middleName || '',
      data.chairperson?.lastName || '',
      data.chairperson?.email || '',
      data.submittedBy || 'System Citizen',
      data.submitterEmail || data.chairperson?.email || '',
      data.submissionDate || new Date().toISOString().split('T')[0],
      data.status || 'New',
      data.remarks || '',
      data.memberCount || 0
    ];

    const result = await pool.query(query, values);
    
    await recordAudit(
      req,
      'AUD-HAWKER-SUBMIT',
      data.submitterEmail || 'citizen@gov.ph',
      'Citizen',
      'Hawker Module',
      'HAWKER_APPLICATION_SUBMITTED',
      'INFO',
      null,
      `Submitted application for association: ${data.associationName}`
    );

    res.status(201).json({
      message: 'Hawker association application saved successfully',
      record: result.rows[0]
    });
  } catch (err) {
    console.error('Error saving hawker application:', err);
    res.status(500).json({ message: 'Failed to save hawker association to database.' });
  }
});

app.patch('/api/hawkers/:id', async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  try {
    const query = `
      UPDATE hawker_associations 
      SET status = $1, remarks = $2 
      WHERE id::text = $3 OR association_number = $3
      RETURNING *;
    `;
    
    const result = await pool.query(query, [status, remarks, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Hawker association record not found.' });
    }

    await recordAudit(
      req,
      'AUD-HAWKER-UPDATE',
      'system-admin@lgu.gov.ph',
      'admin',
      'Hawker Module',
      'HAWKER_STATUS_UPDATED',
      'INFO',
      null,
      `Updated association ${id} status to ${status}`
    );

    res.status(200).json({
      message: 'Hawker status updated successfully',
      record: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating hawker status:', err);
    res.status(500).json({ message: 'Failed to update hawker association.' });
  }
});

// ==========================================
// AI FRAUD SCAN ENDPOINT
// ==========================================

app.post('/api/ai/fraud-scan', async (req, res) => {
  const rawId = req.body.leaseId || req.body.id || req.body.lease_id;
  
  if (!rawId) {
    return res.status(400).json({ error: "Lease ID is required for fraud analysis." });
  }

  const searchId = String(rawId).trim();

  try {
    let leaseQuery = await pool.query(
      `SELECT * FROM market_leases WHERE lease_id = $1`, 
      [searchId]
    );

    if (leaseQuery.rows.length === 0 && !isNaN(Number(searchId))) {
      leaseQuery = await pool.query(
        `SELECT * FROM market_leases WHERE id = $1`,
        [parseInt(searchId, 10)]
      );
    }

    if (leaseQuery.rows.length === 0) {
      return res.status(404).json({ error: "Lease record not found in database." });
    }

    const lease = leaseQuery.rows[0];
    let riskScore = 10; 
    const flags = [];

    const amountDue = parseFloat(lease.amount_due) || 0;
    if (amountDue > 50000) {
      riskScore += 30;
      flags.push(`High financial exposure detected: ₱${amountDue.toLocaleString()} exceeds standard median threshold.`);
    }

    try {
      const allLeasesQuery = await pool.query(`SELECT * FROM market_leases`);
      const allLeases = allLeasesQuery.rows;

      const matchingNameLeases = allLeases.filter(l => 
        l.id !== lease.id &&
        String(l.first_name || '').trim().toLowerCase() === String(lease.first_name || '').trim().toLowerCase() &&
        String(l.last_name || '').trim().toLowerCase() === String(lease.last_name || '').trim().toLowerCase()
      );

      if (matchingNameLeases.length > 0) {
        riskScore += 40;
        flags.push(`Database collision alert: ${matchingNameLeases.length} other active lease record(s) found under identical name (${lease.first_name} ${lease.last_name}).`);
      }
    } catch (e) {
      console.warn('Market leases batch scan warning:', e.message);
    }

    try {
      const auditQuery = await pool.query(`SELECT * FROM audit_logs`);
      const allAudits = auditQuery.rows;

      const applicantName = `${lease.first_name || ''} ${lease.last_name || ''}`.trim().toLowerCase();
      const suspiciousAudits = allAudits.filter(log => {
        const textToCheck = `${log.user_email || ''} ${log.previous_data || ''} ${log.new_data || ''}`.toLowerCase();
        const isTargetMatch = applicantName && textToCheck.includes(applicantName);
        const isWarningOrCrit = (log.severity === 'WARNING' || log.severity === 'CRITICAL');
        return isTargetMatch && isWarningOrCrit;
      });

      if (suspiciousAudits.length > 0) {
        riskScore += 20;
        flags.push(`Security audit trail flags ${suspiciousAudits.length} prior warning or critical event(s) linked to applicant profile.`);
      }
    } catch (e) {
      console.warn('Audit logs batch scan warning:', e.message);
    }

    if (riskScore > 99) riskScore = 99;
    const riskLevel = riskScore > 60 ? "High" : riskScore > 30 ? "Medium" : "Low";

    if (flags.length === 0) {
      flags.push("Database validation passed cleanly. No multi-stall name collisions or abnormal payment spikes found.");
    }

    res.status(200).json({
      success: true,
      riskScore,
      riskLevel,
      flags
    });

  } catch (err) {
    console.error('Error executing database fraud scan:', err);
    res.status(500).json({ error: 'Internal server error during AI fraud analysis.' });
  }
});

// ==========================================
// AUTHENTICATION & LOGIN ENDPOINTS
// ==========================================

app.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const auditId = 'AUD-' + Math.floor(100000 + Math.random() * 900000);

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const currentTime = Date.now();
  const trackingData = loginAttemptsTracker.get(email) || { count: 0, lockUntil: 0 };

  if (trackingData.lockUntil > currentTime) {
    const remainingSeconds = Math.ceil((trackingData.lockUntil - currentTime) / 1000);
    await recordAudit(req, auditId, email, 'Unknown', 'Authentication', 'LOGIN_LOCKED_OUT', 'CRITICAL', null, `Locked for ${remainingSeconds}s`);
    return res.status(429).json({
      message: 'Too many failed login attempts.',
      retryAfterSeconds: remainingSeconds
    });
  }

  try {
    const queryText = 'SELECT * FROM users WHERE email ILIKE $1';
    const result = await pool.query(queryText, [email.trim()]);

    if (result.rows.length === 0) {
      await recordAudit(req, auditId, email, 'Unknown', 'Authentication', 'LOGIN_FAILED', 'WARNING', null, 'User not found');
      handleFailedAttempt(req, email, trackingData, currentTime, res);
      return;
    }

    const user = result.rows[0];

    if (String(user.password).trim() !== String(password).trim()) {
      await recordAudit(req, auditId, email, user.role || 'admin', 'Authentication', 'LOGIN_FAILED', 'WARNING', null, 'Incorrect password');
      handleFailedAttempt(req, email, trackingData, currentTime, res);
      return;
    }

    loginAttemptsTracker.delete(email);
    await recordAudit(req, auditId, user.email, user.role || 'admin', 'Authentication', 'LOGIN_SUCCESS', 'INFO', null, `Successful session init (RememberMe: ${rememberMe})`);

    return res.status(200).json({
      message: 'Login successful!',
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        fullname: user.name 
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

function handleFailedAttempt(req, email, trackingData, currentTime, res) {
  trackingData.count += 1;
  if (trackingData.count >= LOCKOUT_LIMIT) {
    trackingData.lockUntil = currentTime + (LOCKOUT_DURATION_SECONDS * 1000);
    loginAttemptsTracker.set(email, trackingData);
    return res.status(429).json({ message: 'Too many failed attempts.', retryAfterSeconds: LOCKOUT_DURATION_SECONDS });
  } else {
    loginAttemptsTracker.set(email, trackingData);
    return res.status(400).json({ message: 'Invalid credentials.' });
  }
}

app.listen(PORT, () => {
  console.log(`Municipal Treasury Backend Service running on port ${PORT}`);
});