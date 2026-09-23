import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

type BusinessStatus =
  | 'SUBMITTED'
  | 'FOR_INITIAL_ASSESSMENT'
  | 'FOR_FINAL_REVIEW'
  | 'RETURNED_FOR_COMPLIANCE'
  | 'RESUBMITTED'
  | 'FOR_FINAL_APPROVAL'
  | 'TAX_BILL_ISSUED'
  | 'FOR_OWNER_PAYMENT'
  | 'FOR_PAYMENT_VALIDATION'
  | 'OR_ISSUED'
  | 'REJECTED'
  | 'ARCHIVED'
  // Legacy / back-compat
  | 'FOR_COMPLIANCE'
  | 'APPROVED';

type DocumentRequirementKey =
  | 'sales_declaration'
  | 'mayors_permit'
  | 'latest_tax_bill'
  | 'latest_official_receipt'
  | 'bir_tax_return'
  | 'previous_itr'
  | 'audited_financial_statements'
  | 'notarized_gross_sales'
  | 'branch_permits_and_ors'
  | 'branch_sales_breakdown'
  | 'line_of_business_sales_breakdown'
  | 'cedula'
  | 'summary_list_of_sales'
  | 'incentive_exemption';

const BASE_REQUIREMENTS: Array<{ key: DocumentRequirementKey; label: string }> = [
  { key: 'sales_declaration', label: 'Gross Receipts / Sales Declaration Form' },
  { key: 'mayors_permit', label: 'Latest Mayor’s / Business Permit' },
  { key: 'latest_tax_bill', label: 'Latest Business Tax Bill' },
  { key: 'latest_official_receipt', label: 'Latest Business Tax Official Receipt' },
];

const DOCUMENT_LABELS: Record<DocumentRequirementKey, string> = {
  sales_declaration: 'Gross Receipts / Sales Declaration Form',
  mayors_permit: 'Latest Mayor’s / Business Permit',
  latest_tax_bill: 'Latest Business Tax Bill',
  latest_official_receipt: 'Latest Business Tax Official Receipt',
  bir_tax_return: 'Preceding Year VAT Return / Percentage Tax Return / ITR',
  previous_itr: 'Previous-Preceding Year Income Tax Return',
  audited_financial_statements: 'Previous-Preceding Year Audited Financial Statements',
  notarized_gross_sales: 'Notarized Certification of Gross Sales',
  branch_permits_and_ors: 'Other Branch Mayor’s Permits and Official Receipts',
  branch_sales_breakdown: 'Certified Breakdown of Sales for Other Branches',
  line_of_business_sales_breakdown: 'Certified Breakdown of Sales by Line of Business',
  cedula: 'Current-Year Community Tax Certificate / Cedula',
  summary_list_of_sales: 'Previous-Year Summary List of Sales Received by BIR',
  incentive_exemption: 'Certificate of Incentives / Exemption',
};

const STAFF_ROLES = new Set(['admin', 'treasury-staff', 'treasury_admin', 'staff', 'treasurer']);

function isStaff(req: Request): boolean {
  const role = String((req as AuthenticatedRequest).user?.role || '').toLowerCase();
  return STAFF_ROLES.has(role);
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function parseJsonArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildRequiredDocumentKeys(record: any): DocumentRequirementKey[] {
  const required = BASE_REQUIREMENTS.map((item) => item.key);
  const birRegistered = normalizeBoolean(record.bir_registered, true);
  const hasOtherBranches = normalizeBoolean(record.has_other_branches, false);
  const hasMultipleLines = normalizeBoolean(record.has_multiple_lines, false);

  if (birRegistered) {
    required.push('bir_tax_return', 'previous_itr', 'audited_financial_statements');
  } else {
    required.push('notarized_gross_sales');
  }

  if (hasOtherBranches) {
    required.push('branch_permits_and_ors', 'branch_sales_breakdown');
  }

  if (hasMultipleLines) {
    required.push('line_of_business_sales_breakdown');
  }

  return required;
}

function getUploadedDocumentKeys(attachments: unknown): Set<string> {
  const set = new Set<string>();
  for (const item of parseJsonArray(attachments)) {
    const key = String(item?.type || '').trim();
    if (key) set.add(key);
  }
  return set;
}

function getMissingDocuments(record: any): Array<{ key: string; label: string }> {
  const uploaded = getUploadedDocumentKeys(record.attachments);
  return buildRequiredDocumentKeys(record)
    .filter((key) => !uploaded.has(key))
    .map((key) => ({ key, label: DOCUMENT_LABELS[key] || key }));
}

function getDocumentChecklist(record: any): Record<string, boolean> {
  const stored = parseJsonObject(record.document_checklist);
  const uploaded = getUploadedDocumentKeys(record.attachments);
  const checklist: Record<string, boolean> = {};

  for (const key of buildRequiredDocumentKeys(record)) {
    checklist[key] = Boolean(stored[key]) || uploaded.has(key) ? Boolean(stored[key]) : false;
  }

  return checklist;
}

function hasVerifiedRequiredDocuments(record: any): boolean {
  const stored = parseJsonObject(record.document_checklist);
  return buildRequiredDocumentKeys(record).every((key) => stored[key] === true);
}

function generateReference(prefix: string, value: string | number): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${year}-${String(value).replace(/[^A-Za-z0-9]/g, '').slice(-12)}-${random}`;
}

async function generateUniqueTaxBillNumber(year: string | number): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const taxBillNumber = `TB-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await pool.query(
      'SELECT id FROM business_assessments WHERE tax_bill_number = $1 LIMIT 1',
      [taxBillNumber]
    );
    if (existing.rows.length === 0) return taxBillNumber;
  }
  throw new Error('Unable to generate a unique Tax Bill Number. Please try again.');
}

function normalizeAttachments(files: any[], documentTypes: string[]): any[] {
  return files.map((file, index) => ({
    type: String(documentTypes[index] || 'supporting_document').trim(),
    name: String(file.originalname || `document-${index + 1}`),
    mimeType: String(file.mimetype || 'application/octet-stream'),
    size: Number(file.size || 0),
    uploadedAt: new Date().toISOString(),
    url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
  }));
}

function formatAssessment(row: any) {
  const computedFees = parseJsonObject(row.computed_fees);
  const attachments = parseJsonArray(row.attachments);
  const documentChecklist = parseJsonObject(row.document_checklist);

  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    taxBillNumber: row.tax_bill_number || null,
    orderOfPaymentNumber: row.order_of_payment_number || null,
    businessName: row.business_name,
    businessOwner: row.business_owner,
    businessAddress: row.business_address || '',
    barangay: row.barangay || '',
    businessType: row.business_type || '',
    lineOfBusiness: row.line_of_business || '',
    businessAreaSqm: Number(row.business_area_sqm || 0),
    registrationType: row.registration_type || '',
    registrationNumber: row.registration_number || '',
    mayorPermitNumber: row.mayors_permit_number || '',
    birRegistered: normalizeBoolean(row.bir_registered, true),
    hasOtherBranches: normalizeBoolean(row.has_other_branches, false),
    hasMultipleLines: normalizeBoolean(row.has_multiple_lines, false),
    taxYear: Number(row.tax_year || new Date().getFullYear()),
    assessmentPeriod: row.assessment_period || 'ANNUAL_RENEWAL',
    quarter: row.quarter || 'ANNUAL',
    dueDate: row.due_date || null,
    status: row.status,
    recordStatus: row.record_status || 'ACTIVE',
    applicationDate: row.application_date,
    psicCode: row.psic_code || '',
    grossSales: Number(row.gross_sales || 0),
    tin: row.tin || '',
    email: row.email || '',
    attachments,
    documentChecklist,
    missingDocuments: getMissingDocuments(row),
    remarks: row.remarks || '',
    complianceRemarks: row.compliance_remarks || '',
    initialAssessedBy: row.initial_assessed_by || '',
    initialAssessedAt: row.initial_assessed_at || null,
    reviewedBy: row.reviewed_by || '',
    reviewedAt: row.reviewed_at || null,
    finalReviewedBy: row.final_reviewed_by || '',
    finalReviewedAt: row.final_reviewed_at || null,
    approvedBy: row.approved_by || '',
    approvedAt: row.approved_at || null,
    paymentStatus: String(row.payment_status || 'UNPAID').toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID',
    paymentAmount: Number(row.payment_amount || computedFees.total || 0),
    paidAmount: Number(row.paid_amount || 0),
    paymentMethod: row.payment_method || '',
    paymentReference: row.payment_reference || '',
    paymentDate: row.payment_date || null,
    officialReceiptNumber: row.official_receipt_number || '',
    paymongoPaymentId: row.paymongo_payment_id || '',
    computedFees,
  };
}

export async function getBusinessAssessments(req: Request, res: Response): Promise<void> {
  const { status, recordStatus, email, search, searchType, page = '1', limit = '10' } = req.query;
  const staff = isStaff(req);
  const authEmail = String((req as AuthenticatedRequest).user?.email || '').trim().toLowerCase();

  try {
    let query = 'SELECT * FROM business_assessments WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (!staff) {
      if (!authEmail) {
        res.status(401).json({ message: 'Authenticated citizen email is required.' });
        return;
      }
      query += ` AND LOWER(email) = $${paramIndex++} AND COALESCE(is_linked, TRUE) = TRUE`;
      params.push(authEmail);
    } else if (email) {
      query += ` AND LOWER(email) = $${paramIndex++}`;
      params.push(String(email).trim().toLowerCase());
    }

    if (status && status !== 'ALL') {
      query += ` AND status = $${paramIndex++}`;
      params.push(String(status));
    }

    if (recordStatus && recordStatus !== 'ALL') {
      query += ` AND record_status = $${paramIndex++}`;
      params.push(String(recordStatus));
    } else if (!recordStatus) {
      query += ` AND record_status = $${paramIndex++}`;
      params.push('ACTIVE');
    }

    if (search) {
      const normalizedSearchType = String(searchType || 'Tracking/MP No.').trim();
      if (normalizedSearchType === 'Business Name') {
        query += ` AND business_name ILIKE $${paramIndex++}`;
      } else if (normalizedSearchType === 'Business Owner') {
        query += ` AND business_owner ILIKE $${paramIndex++}`;
      } else if (normalizedSearchType === 'Mayor\'s Permit No.') {
        query += ` AND mayors_permit_number ILIKE $${paramIndex++}`;
      } else if (normalizedSearchType === 'Tax Bill Number') {
        query += ` AND tax_bill_number ILIKE $${paramIndex++}`;
      } else {
        query += ` AND tracking_number ILIKE $${paramIndex++}`;
      }
      params.push(`%${String(search)}%`);
    }

    const pageNum = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, Number.parseInt(String(limit), 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limitNum, offset);

    const result = await pool.query(query, params);

    const countParams: any[] = [];
    let countIndex = 1;
    const countClauses: string[] = ['1=1'];

    if (!staff) {
      countClauses.push(`LOWER(email) = $${countIndex++}`);
      countParams.push(authEmail);
    } else if (email) {
      countClauses.push(`LOWER(email) = $${countIndex++}`);
      countParams.push(String(email).trim().toLowerCase());
    }

    if (status && status !== 'ALL') {
      countClauses.push(`status = $${countIndex++}`);
      countParams.push(String(status));
    }

    if (recordStatus && recordStatus !== 'ALL') {
      countClauses.push(`record_status = $${countIndex++}`);
      countParams.push(String(recordStatus));
    } else if (!recordStatus) {
      countClauses.push(`record_status = $${countIndex++}`);
      countParams.push('ACTIVE');
    }

    if (search) {
      const normalizedSearchType = String(searchType || 'Tracking/MP No.').trim();
      if (normalizedSearchType === 'Business Name') countClauses.push(`business_name ILIKE $${countIndex++}`);
      else if (normalizedSearchType === 'Business Owner') countClauses.push(`business_owner ILIKE $${countIndex++}`);
      else if (normalizedSearchType === 'Mayor\'s Permit No.') countClauses.push(`mayors_permit_number ILIKE $${countIndex++}`);
      else if (normalizedSearchType === 'Tax Bill Number') countClauses.push(`tax_bill_number ILIKE $${countIndex++}`);
      else countClauses.push(`tracking_number ILIKE $${countIndex++}`);
      countParams.push(`%${String(search)}%`);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM business_assessments WHERE ${countClauses.join(' AND ')}`,
      countParams
    );

    const totalRecords = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));

    res.json({
      assessments: result.rows.map(formatAssessment),
      totalPages,
      totalRecords,
      currentPage: pageNum,
      pageSize: limitNum,
    });
  } catch (err) {
    console.error('Error fetching business assessments:', err);
    res.status(500).json({ message: 'Error loading business tax assessments' });
  }
}

export async function createSalesDeclaration(req: Request, res: Response): Promise<void> {
  const body = req.body || {};
  const businessName = String(body.businessName || '').trim();
  const businessOwner = String(body.businessOwner || '').trim();
  const businessAddress = String(body.businessAddress || '').trim();
  const barangay = String(body.barangay || '').trim();
  const businessType = String(body.businessType || '').trim();
  const lineOfBusiness = String(body.lineOfBusiness || '').trim();
  const registrationType = String(body.registrationType || '').trim();
  const registrationNumber = String(body.registrationNumber || '').trim();
  const mayorsPermitNumber = String(body.mayorsPermitNumber || '').trim();
  const birRegistered = normalizeBoolean(body.birRegistered, true);
  const hasOtherBranches = normalizeBoolean(body.hasOtherBranches, false);
  const hasMultipleLines = normalizeBoolean(body.hasMultipleLines, false);
  const grossSales = Number(body.grossSales);
  const businessAreaSqm = Number(body.businessAreaSqm || 0);
  const taxYear = Number(body.year || new Date().getFullYear());
  const assessmentPeriod = String(body.assessmentPeriod || 'ANNUAL_RENEWAL').trim();
  const quarter = String(body.quarter || 'ANNUAL').trim();
  const psicCode = String(body.psicCode || '').trim();
  const tin = String(body.tin || '').trim();
  const email = String(body.email || '').trim().toLowerCase();

  if (!businessName || !businessOwner || !businessAddress || !barangay || !businessType || !lineOfBusiness || !mayorsPermitNumber || !tin || !email) {
    res.status(400).json({ message: 'Business name, owner, address, barangay, business type, line of business, Mayor’s Permit number, TIN, and email are required.' });
    return;
  }

  if (!Number.isFinite(grossSales) || grossSales < 0) {
    res.status(400).json({ message: 'Gross sales must be a valid non-negative number.' });
    return;
  }

  if (!Number.isFinite(businessAreaSqm) || businessAreaSqm < 0) {
    res.status(400).json({ message: 'Business area must be a valid non-negative number.' });
    return;
  }

  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    res.status(400).json({ message: 'A valid tax year is required.' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'Invalid email address format.' });
    return;
  }

  const files = Array.isArray((req as any).files) ? (req as any).files : [];
  let documentTypes: string[] = [];
  try {
    const parsed = JSON.parse(String(body.documentTypes || '[]'));
    documentTypes = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    documentTypes = [];
  }

  const attachments = normalizeAttachments(files, documentTypes);
  const id = randomUUID();
  const trackingNumber = `BT-${taxYear}-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    // 1. Server-Side Business Validation
    const businessMatch = await pool.query(
      `SELECT id FROM business_permits
       WHERE mayor_permit_no = $1
         AND LOWER(TRIM(business_name)) = LOWER(TRIM($2))
         AND permit_status = 'ACTIVE'
       LIMIT 1`,
      [mayorsPermitNumber, businessName]
    );

    if (businessMatch.rows.length === 0) {
      res.status(400).json({ 
        message: "Business record not found. Please verify your Mayor's Permit Number and Business / Corporate Name." 
      });
      return;
    }
    const businessId = businessMatch.rows[0].id;

    // 2. Duplicate 2026 Application Check
    const existingCheck = await pool.query(
      `SELECT tracking_number FROM business_assessments 
       WHERE business_id = $1
         AND tax_year = $2
         AND status NOT IN ('REJECTED')
         AND record_status = 'ACTIVE'
       LIMIT 1`,
      [businessId, taxYear]
    );

    if (existingCheck.rows.length > 0) {
      res.status(400).json({ 
        message: 'An active application for this business already exists for the selected tax year.',
        trackingNumber: existingCheck.rows[0].tracking_number 
      });
      return;
    }

    // Submission creates a tracking reference only. The official tax bill and OP
    // are generated only after Treasurer approval, matching the assessment flow.
    const result = await pool.query(
      `INSERT INTO business_assessments (
        id, tracking_number, tax_bill_number, order_of_payment_number,
        business_id, business_name, business_owner, business_address, barangay,
        business_type, line_of_business, business_area_sqm,
        registration_type, registration_number, mayors_permit_number,
        bir_registered, has_other_branches, has_multiple_lines,
        status, psic_code, gross_sales, tin, email, tax_year,
        assessment_period, quarter, attachments, document_checklist,
        payment_status, payment_amount, paid_amount,
        application_source, is_linked
      ) VALUES (
        $1, $2, NULL, NULL,
        $24, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        'SUBMITTED', $16, $17, $18, $19, $20,
        $21, $22, $23, '{}'::jsonb,
        'UNPAID', 0, 0,
        'ONLINE_RENEWAL', TRUE
      )
      RETURNING *`,
      [
        id,
        trackingNumber,
        businessName,
        businessOwner,
        businessAddress,
        barangay,
        businessType,
        lineOfBusiness,
        businessAreaSqm,
        registrationType,
        registrationNumber,
        mayorsPermitNumber,
        birRegistered,
        hasOtherBranches,
        hasMultipleLines,
        psicCode || null,
        grossSales,
        tin,
        email,
        taxYear,
        assessmentPeriod,
        quarter,
        JSON.stringify(attachments),
        businessId,
      ]
    );

    const missingDocuments = getMissingDocuments(result.rows[0]);

    await recordAudit(
      req,
      'AUD-BIZ-SUBMIT',
      email,
      'Citizen',
      'Business Tax Module',
      'BUSINESS_TAX_ASSESSMENT_SUBMITTED',
      'INFO',
      null,
      `Submitted Business Tax assessment for ${businessName}. Tracking ${trackingNumber}. Missing documents at submission: ${missingDocuments.length}.`
    );

    res.status(201).json({
      message: 'Business Tax assessment submitted successfully.',
      trackingNumber,
      missingDocuments,
      record: formatAssessment(result.rows[0]),
    });
  } catch (err: any) {
    console.error('Error saving Business Tax assessment:', err);
    if (String(err?.code) === '23505') {
      res.status(409).json({ message: 'A duplicate tracking/reference number was generated. Please submit again.' });
      return;
    }
    res.status(500).json({ message: 'Failed to submit Business Tax assessment.' });
  }
}

export async function uploadBusinessComplianceDocuments(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const authEmail = String((req as AuthenticatedRequest).user?.email || '').trim().toLowerCase();
  const files = Array.isArray((req as any).files) ? (req as any).files : [];

  if (!authEmail) {
    res.status(401).json({ message: 'Authenticated citizen email is required.' });
    return;
  }

  if (files.length === 0) {
    res.status(400).json({ message: 'Please upload at least one additional document.' });
    return;
  }

  let documentTypes: string[] = [];
  try {
    const parsed = JSON.parse(String(req.body?.documentTypes || '[]'));
    documentTypes = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    documentTypes = [];
  }

  try {
    const recordResult = await pool.query(
      `SELECT * FROM business_assessments WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (recordResult.rows.length === 0) {
      res.status(404).json({ message: 'Business Tax assessment not found.' });
      return;
    }

    const record = recordResult.rows[0];
    if (!isStaff(req) && String(record.email || '').trim().toLowerCase() !== authEmail) {
      res.status(403).json({ message: 'You are not authorized to update this assessment.' });
      return;
    }

    const currentStatus = String(record.status || '').toUpperCase();
    if (currentStatus !== 'RETURNED_FOR_COMPLIANCE' && currentStatus !== 'FOR_COMPLIANCE') {
      res.status(409).json({ message: 'Additional compliance documents can only be submitted for assessments returned for compliance.' });
      return;
    }

    const existing = parseJsonArray(record.attachments);
    const additions = normalizeAttachments(files, documentTypes);
    const merged = [...existing, ...additions];

    const result = await pool.query(
      `UPDATE business_assessments
       SET attachments = $1::jsonb,
           status = 'RESUBMITTED',
           compliance_remarks = NULL,
           remarks = NULL,
           reviewed_at = NULL,
           reviewed_by = NULL,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(merged), id]
    );

    await recordAudit(
      req,
      'AUD-BIZ-COMPLIANCE',
      authEmail,
      'Citizen',
      'Business Tax Module',
      'BUSINESS_TAX_COMPLIANCE_DOCUMENTS_SUBMITTED',
      'INFO',
      record.attachments,
      JSON.stringify(merged)
    );

    res.status(200).json({
      message: 'Additional Business Tax documents submitted successfully.',
      record: formatAssessment(result.rows[0]),
      missingDocuments: getMissingDocuments(result.rows[0]),
    });
  } catch (err: any) {
    console.error('Error uploading compliance documents:', err);
    res.status(500).json({ message: 'Failed to upload additional documents.' });
  }
}

export async function updateAssessmentStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const status = req.body?.status ? String(req.body.status).toUpperCase() as BusinessStatus : undefined;
  const recordStatus = req.body?.recordStatus ? String(req.body.recordStatus).toUpperCase() : undefined;
  const remarks = String(req.body?.remarks || '').trim();
  const suppliedFees = parseJsonObject(req.body?.computedFees);
  const suppliedChecklist = parseJsonObject(req.body?.documentChecklist);

  // Canonical Business Tax assessment statuses.
  // ARCHIVED is NOT an application status — use recordStatus to archive records.
  // FOR_COMPLIANCE and APPROVED are legacy aliases kept for reading old data only.
  const allowedStatuses = new Set<BusinessStatus>([
    'SUBMITTED',
    'FOR_INITIAL_ASSESSMENT',
    'FOR_FINAL_REVIEW',
    'RETURNED_FOR_COMPLIANCE',
    'RESUBMITTED',
    'FOR_FINAL_APPROVAL',
    'TAX_BILL_ISSUED',
    'FOR_OWNER_PAYMENT',
    'FOR_PAYMENT_VALIDATION',
    'OR_ISSUED',
    'REJECTED',
  ]);

  if (status && !allowedStatuses.has(status)) {
    res.status(400).json({ message: 'Invalid Business Tax assessment status.' });
    return;
  }

  if (recordStatus && recordStatus !== 'ACTIVE' && recordStatus !== 'ARCHIVED') {
    res.status(400).json({ message: 'Invalid record status.' });
    return;
  }

  if (!status && !recordStatus) {
    res.status(400).json({ message: 'No status or recordStatus provided.' });
    return;
  }

  try {
    const currentResult = await pool.query(
      `SELECT * FROM business_assessments WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      res.status(404).json({ message: 'Business Tax assessment record not found.' });
      return;
    }

    const current = currentResult.rows[0];
    const nextStatus = status || current.status;
    const nextRecordStatus = recordStatus || current.record_status || 'ACTIVE';

    if (status && status !== current.status) {
      const validTransitions: Record<BusinessStatus, BusinessStatus[]> = {
        SUBMITTED: ['FOR_INITIAL_ASSESSMENT', 'REJECTED'],
        FOR_INITIAL_ASSESSMENT: ['FOR_FINAL_REVIEW', 'REJECTED'],
        FOR_FINAL_REVIEW: ['RETURNED_FOR_COMPLIANCE', 'FOR_FINAL_APPROVAL', 'REJECTED'],
        RETURNED_FOR_COMPLIANCE: ['RESUBMITTED'], 
        RESUBMITTED: ['FOR_INITIAL_ASSESSMENT', 'REJECTED'],
        FOR_FINAL_APPROVAL: ['TAX_BILL_ISSUED', 'REJECTED'],
        TAX_BILL_ISSUED: ['FOR_OWNER_PAYMENT'],
        FOR_OWNER_PAYMENT: ['FOR_PAYMENT_VALIDATION'],
        FOR_PAYMENT_VALIDATION: ['OR_ISSUED'],
        OR_ISSUED: [],
        REJECTED: [],
        ARCHIVED: [],
        FOR_COMPLIANCE: [],
        APPROVED: []
      };

      const allowedNext = validTransitions[current.status as BusinessStatus] || [];
      if (!allowedNext.includes(status)) {
        res.status(409).json({ message: `Invalid workflow transition: Cannot move from ${current.status} to ${status}.` });
        return;
      }
    }

    const currentFees = parseJsonObject(current.computed_fees);
    const currentChecklist = parseJsonObject(current.document_checklist);
    const nextFees = Object.keys(suppliedFees).length > 0 ? suppliedFees : currentFees;
    const nextChecklist = Object.keys(suppliedChecklist).length > 0 ? suppliedChecklist : currentChecklist;
    const total = Number(nextFees.total || 0);

    if (nextStatus === 'APPROVED' || nextStatus === 'TAX_BILL_ISSUED') {
      const missingKeys = buildRequiredDocumentKeys(current).filter((key) => nextChecklist[key] !== true);
      if (missingKeys.length > 0) {
        res.status(409).json({
          message: 'Approval is blocked until every applicable required document has been verified.',
          missingDocuments: missingKeys.map((key) => ({ key, label: DOCUMENT_LABELS[key] || key })),
          documentChecklist: nextChecklist,
        });
        return;
      }

      if (!Number.isFinite(total) || total <= 0) {
        res.status(409).json({ message: 'Enter the final assessed amount before approving the Business Tax assessment.' });
        return;
      }
    }

    let taxBillNumber = current.tax_bill_number || null;
    let orderOfPaymentNumber = current.order_of_payment_number || null;
    const applicationYear = Number(current.tax_year || new Date().getFullYear());

    // Tax Bill and Order of Payment are generated only when the Treasurer
    // issues the Tax Bill (TAX_BILL_ISSUED). Legacy APPROVED records are also
    // handled here so existing data is not broken.
    if (nextStatus === 'TAX_BILL_ISSUED' || nextStatus === 'APPROVED') {
      if (!taxBillNumber) taxBillNumber = await generateUniqueTaxBillNumber(applicationYear);
      if (!orderOfPaymentNumber) orderOfPaymentNumber = generateReference('OP', taxBillNumber);
    }

    const authEmail = String((req as AuthenticatedRequest).user?.email || 'treasury-staff');

    // Initial assessment officer: recorded when staff completes the assessment and moves to FOR_FINAL_REVIEW.
    const initialAssessedAt = nextStatus === 'FOR_FINAL_REVIEW' && current.status === 'FOR_INITIAL_ASSESSMENT' ? new Date() : current.initial_assessed_at;
    const initialAssessedBy = nextStatus === 'FOR_FINAL_REVIEW' && current.status === 'FOR_INITIAL_ASSESSMENT' ? authEmail : current.initial_assessed_by;

    // Final review officer: recorded when staff moves to FOR_FINAL_REVIEW.
    const reviewedAt = nextStatus === 'FOR_FINAL_REVIEW' && current.status !== nextStatus ? new Date() : current.reviewed_at;
    const reviewedBy = nextStatus === 'FOR_FINAL_REVIEW' && current.status !== nextStatus ? authEmail : current.reviewed_by;

    // Final review approval (operations officer → treasurer): recorded on FOR_FINAL_APPROVAL.
    const finalReviewedAt = nextStatus === 'FOR_FINAL_APPROVAL' && current.status !== nextStatus ? new Date() : current.final_reviewed_at;
    const finalReviewedBy = nextStatus === 'FOR_FINAL_APPROVAL' && current.status !== nextStatus ? authEmail : current.final_reviewed_by;

    // Compliance remarks are set ONLY when returning for compliance.
    const complianceRemarks = nextStatus === 'RETURNED_FOR_COMPLIANCE' ? remarks || 'Additional documents or clarification are required.' : null;

    // Treasurer approval: recorded on TAX_BILL_ISSUED (canonical) or legacy APPROVED.
    const approvedAt = (nextStatus === 'TAX_BILL_ISSUED' || nextStatus === 'APPROVED') && current.status !== nextStatus ? new Date() : current.approved_at;
    const approvedBy = (nextStatus === 'TAX_BILL_ISSUED' || nextStatus === 'APPROVED') && current.status !== nextStatus ? authEmail : current.approved_by;

    // Payment amount and due date are set when the Tax Bill is issued.
    let paymentAmount = (nextStatus === 'TAX_BILL_ISSUED' || nextStatus === 'APPROVED') ? total : Number(current.payment_amount || currentFees.total || 0);
    const dueDate = (nextStatus === 'TAX_BILL_ISSUED' || nextStatus === 'APPROVED') && String(current.assessment_period || 'ANNUAL_RENEWAL') === 'ANNUAL_RENEWAL'
      ? `${applicationYear}-01-20`
      : current.due_date;

    let paymentStatus = current.payment_status;
    let officialReceiptNumber = current.official_receipt_number;
    let paidAmount = current.paid_amount;
    let paymentDate = current.payment_date;

    if (nextStatus === 'OR_ISSUED' && current.status !== 'OR_ISSUED') {
      paymentStatus = 'PAID';
      paidAmount = paymentAmount;
      paymentDate = new Date();
      if (!officialReceiptNumber) {
        officialReceiptNumber = `OR-PM-${applicationYear}-${Math.floor(100000 + Math.random() * 900000)}`;
      }
    }

    const result = await pool.query(
      `UPDATE business_assessments
       SET status = $1,
           record_status = $2,
           remarks = $3,
           compliance_remarks = $4,
           computed_fees = $5::jsonb,
           document_checklist = $6::jsonb,
           payment_amount = $7,
           tax_bill_number = $8,
           order_of_payment_number = $9,
           due_date = $10,
           initial_assessed_by = $11,
           initial_assessed_at = $12,
           reviewed_by = $13,
           reviewed_at = $14,
           final_reviewed_by = $15,
           final_reviewed_at = $16,
           approved_by = $17,
           approved_at = $18,
           payment_status = $19,
           official_receipt_number = $20,
           paid_amount = $21,
           payment_date = COALESCE($22, payment_date),
           updated_at = NOW()
       WHERE id = $23
       RETURNING *`,
      [
        nextStatus,
        nextRecordStatus,
        nextStatus === 'RETURNED_FOR_COMPLIANCE' ? null : remarks || current.remarks || null,
        complianceRemarks,
        JSON.stringify(nextFees),
        JSON.stringify(nextChecklist),
        paymentAmount,
        taxBillNumber,
        orderOfPaymentNumber,
        dueDate,
        initialAssessedBy,
        initialAssessedAt,
        reviewedBy,
        reviewedAt,
        finalReviewedBy,
        finalReviewedAt,
        approvedBy,
        approvedAt,
        paymentStatus,
        officialReceiptNumber,
        paidAmount,
        paymentDate,
        id,
      ]
    );

    await recordAudit(
      req,
      'AUD-BIZ-STATUS',
      String((req as AuthenticatedRequest).user?.email || 'treasury-staff'),
      String((req as AuthenticatedRequest).user?.role || 'treasury-staff'),
      'Business Tax Module',
      'BUSINESS_TAX_ASSESSMENT_STATUS_UPDATED',
      (nextStatus === 'FOR_COMPLIANCE' || nextStatus === 'RETURNED_FOR_COMPLIANCE' || nextStatus === 'REJECTED') ? 'WARNING' : 'INFO',
      JSON.stringify({ status: current.status, record_status: current.record_status, computedFees: currentFees, documentChecklist: currentChecklist }),
      JSON.stringify({ status: nextStatus, record_status: nextRecordStatus, computedFees: nextFees, documentChecklist: nextChecklist, taxBillNumber, orderOfPaymentNumber, officialReceiptNumber })
    );

    res.status(200).json({
      message: `Business Tax assessment updated.`,
      record: formatAssessment(result.rows[0]),
    });
  } catch (err: any) {
    console.error('Error updating Business Tax assessment:', err);
    res.status(500).json({ message: err.message || 'Failed to update Business Tax assessment status.' });
  }
}

export async function deleteBusinessAssessment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM business_assessments WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Assessment record not found.' });
      return;
    }

    await recordAudit(
      req,
      'AUD-BIZ-DELETE',
      String((req as AuthenticatedRequest).user?.email || 'admin@lgu.gov.ph'),
      String((req as AuthenticatedRequest).user?.role || 'admin'),
      'Business Tax Module',
      'BUSINESS_TAX_ASSESSMENT_DELETED',
      'WARNING',
      JSON.stringify(result.rows[0]),
      null
    );

    res.status(200).json({ message: 'Assessment record deleted successfully.' });
  } catch (err) {
    console.error('Error deleting assessment record:', err);
    res.status(500).json({ message: 'Failed to delete record from server.' });
  }
}

export async function verifyTaxBill(req: Request, res: Response): Promise<void> {
  const taxBillNo = String(req.body?.taxBillNo || '').trim();
  const permitNo = String(req.body?.permitNo || '').trim();

  if (!taxBillNo || !permitNo) {
    res.status(400).json({ message: 'Tax Bill Number and Mayor\'s Permit Number are required.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT business_name, mayors_permit_number, tax_bill_number, tax_year, computed_fees, payment_amount, status, created_at, due_date
       FROM business_assessments 
       WHERE tax_bill_number = $1 AND mayors_permit_number = $2 
       LIMIT 1`,
      [taxBillNo, permitNo]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'The Mayor\'s Permit Number and Tax Bill Number could not be verified against the available Treasury records.' });
      return;
    }

    const record = result.rows[0];
    const computedFees = parseJsonObject(record.computed_fees);
    const amountDue = Number(record.payment_amount) > 0 ? record.payment_amount : (computedFees.total || 0);

    res.status(200).json({
      verified: true,
      record: {
        businessName: record.business_name,
        mayorsPermitNo: record.mayors_permit_number,
        taxBillNo: record.tax_bill_number,
        taxYear: record.tax_year || new Date().getFullYear(),
        amountDue: amountDue,
        status: record.status,
        assessmentDate: record.created_at,
        dueDate: record.due_date
      }
    });
  } catch (err: any) {
    console.error('Error verifying tax bill:', err);
    res.status(500).json({ message: 'Server error during tax bill verification.' });
  }
}

export async function verifyOrNumber(req: Request, res: Response): Promise<void> {
  const permitNo = String(req.body?.permitNo || '').trim();
  const orNo = String(req.body?.orNo || '').trim();

  if (!permitNo || !orNo) {
    res.status(400).json({ message: 'Mayor\'s Permit Number and OR Number are required.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT business_name, mayors_permit_number, official_receipt_number, paid_amount, payment_amount, computed_fees, payment_date, payment_method, payment_status
       FROM business_assessments
       WHERE mayors_permit_number = $1 AND official_receipt_number = $2 AND payment_status = 'PAID'
       LIMIT 1`,
      [permitNo, orNo]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'The Mayor\'s Permit Number and O.R. Number could not be verified against the available Treasury payment records.' });
      return;
    }

    const record = result.rows[0];
    const computedFees = parseJsonObject(record.computed_fees);
    const amountPaid = Number(record.paid_amount || record.payment_amount || computedFees.total || 0);

    res.status(200).json({
      verified: true,
      record: {
        businessName: record.business_name,
        mayorsPermitNo: record.mayors_permit_number,
        orNo: record.official_receipt_number,
        amountPaid: amountPaid,
        paymentDate: record.payment_date,
        paymentMethod: record.payment_method,
        paymentStatus: record.payment_status
      }
    });
  } catch (err: any) {
    console.error('Error verifying O.R. number:', err);
    res.status(500).json({ message: 'Server error during O.R. verification.' });
  }
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
  const {
    department,
    appointmentType,
    branch,
    mayorsPermitNo,
    businessName,
    businessAddress,
    tin,
    address,
    description,
    fullName,
    email,
    phone,
    date,
    timeSlot,
    remarks,
  } = req.body;

  if (!department || !appointmentType || !fullName || !email || !date || !timeSlot) {
    res.status(400).json({ message: 'Department, appointment type, full name, email, date, and time slot are required.' });
    return;
  }

  if (!/^\d{11}$/.test(String(phone || '').trim())) {
    res.status(400).json({ message: 'A valid 11-digit Philippine mobile number is required.' });
    return;
  }

  if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    res.status(400).json({ message: 'Invalid email address format.' });
    return;
  }

  const id = randomUUID();
  try {
    // Validate slot availability
    const slotCheck = await pool.query(
      `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = $1 AND time_slot = $2 AND status IN ('PENDING', 'APPROVED', 'SCHEDULED')`,
      [date, timeSlot]
    );
    const booked = parseInt(slotCheck.rows[0].count, 10);
    if (booked >= 10) {
      res.status(400).json({ message: 'The selected time slot is fully booked.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO appointments (
        id, department, appointment_type, branch, business_name, mayors_permit_no, tin, business_address, address,
        description, full_name, email, phone, appointment_date, time_slot,
        remarks, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'PENDING') RETURNING *`,
      [
        id,
        department,
        appointmentType,
        branch || null,
        businessName || '',
        mayorsPermitNo || null,
        tin || '',
        businessAddress || '',
        address || '',
        description || '',
        fullName,
        email,
        phone,
        date,
        timeSlot,
        remarks || null,
      ]
    );

    await pool.query(
      `INSERT INTO appointment_audit_logs (id, appointment_id, action, performed_by, previous_status, new_status) VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), id, 'CREATED', fullName, null, 'PENDING']
    );

    await recordAudit(req, 'AUD-APT-SUBMIT', email, 'Citizen', 'Appointments Module', 'APPOINTMENT_REQUESTED', 'INFO', null, `Scheduled appointment for ${fullName} under ${department} on ${date}`);
    res.status(201).json({ message: 'Appointment submitted successfully', record: result.rows[0] });
  } catch (err) {
    console.error('Error saving appointment:', err);
    res.status(500).json({ message: 'Failed to submit appointment.' });
  }
}

export async function getAppointmentConfig(req: Request, res: Response): Promise<void> {
  const config = {
    appointmentTypes: [
      {
        id: 'BUSINESS TAX ASSESSMENT (RENEWAL) - MAIN OFFICE',
        label: 'BUSINESS TAX ASSESSMENT (RENEWAL) - MAIN OFFICE',
        requiresBranch: false
      },
      {
        id: 'BUSINESS TAX ASSESSMENT (SOLE PROPRIETORSHIP) - BRANCHES',
        label: 'BUSINESS TAX ASSESSMENT (SOLE PROPRIETORSHIP) - BRANCHES',
        requiresBranch: true,
        branchType: 'branches'
      },
      {
        id: 'BUSINESS TAX ASSESSMENT (SOLE PROPRIETORSHIP) - SATELLITE OFFICES',
        label: 'BUSINESS TAX ASSESSMENT (SOLE PROPRIETORSHIP) - SATELLITE OFFICES',
        requiresBranch: true,
        branchType: 'satellite'
      }
    ],
    branches: [
      { id: 'Marilag Branch', label: 'Marilag Branch - 25 Calderon St., Brgy. Marilag, Project 4, Quezon City', address: '25 Calderon St., Brgy. Marilag, Project 4, Quezon City' },
      { id: 'Galas Branch', label: 'Galas Branch - Uncle Hangkok St., Brgy. San Isidro, Galas, Quezon City', address: 'Uncle Hangkok St., Brgy. San Isidro, Galas, Quezon City' },
      { id: 'La Loma Branch', label: 'La Loma Branch - Mayor St., near Police Station, Quezon City', address: 'Mayor St., near Police Station, Quezon City' },
      { id: 'Novaliches Branch', label: 'Novaliches Branch - Jordan Plains Subd., NDC, Novaliches, Quezon City', address: 'Jordan Plains Subd., NDC, Novaliches, Quezon City' },
      { id: 'Talipapa Branch', label: 'Talipapa Branch - Brgy. Hall Talipapa, Quirino Hi-way, Novaliches, Quezon City', address: 'Brgy. Hall Talipapa, Quirino Hi-way, Novaliches, Quezon City' }
    ],
    satelliteOffices: [
      { id: 'Eastwood City Satellite Office', label: 'Eastwood City Satellite Office', address: 'Eastwood City Satellite Office' },
      { id: 'Fairview Terraces Satellite Office', label: 'Fairview Terraces Satellite Office', address: 'Fairview Terraces Satellite Office' },
      { id: 'Robinsons Magnolia Satellite Office', label: 'Robinsons Magnolia Satellite Office', address: 'Robinsons Magnolia Satellite Office' },
      { id: 'SM North EDSA Satellite Office', label: 'SM North EDSA Satellite Office', address: 'SM North EDSA Satellite Office' }
    ],
    timeSlots: [
      '09:00 AM',
      '10:00 AM',
      '11:00 AM',
      '01:00 PM',
      '02:00 PM',
      '03:00 PM',
      '04:00 PM'
    ],
    maxCapacityPerSlot: 10
  };
  res.json(config);
}

export async function getAppointmentSlots(req: Request, res: Response): Promise<void> {
  const { date } = req.query;
  if (!date) {
    res.status(400).json({ message: 'Date is required.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT time_slot, COUNT(*) as booked_count 
       FROM appointments 
       WHERE appointment_date = $1 AND status IN ('PENDING', 'APPROVED', 'SCHEDULED')
       GROUP BY time_slot`,
      [date]
    );

    const bookedCounts: Record<string, number> = {};
    result.rows.forEach(row => {
      bookedCounts[row.time_slot] = parseInt(row.booked_count, 10);
    });

    const timeSlots = [
      '09:00 AM', '10:00 AM', '11:00 AM', 
      '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'
    ];
    const maxCapacityPerSlot = 10;

    const slots = timeSlots.map(slot => {
      const booked = bookedCounts[slot] || 0;
      return {
        time: slot,
        available: Math.max(0, maxCapacityPerSlot - booked),
        total: maxCapacityPerSlot
      };
    });

    res.json({ date, slots });
  } catch (error) {
    console.error('Error fetching appointment slots:', error);
    res.status(500).json({ message: 'Internal server error fetching slots.' });
  }
}

export async function getAppointments(req: Request, res: Response): Promise<void> {
  const email = String(req.query?.email || '').trim().toLowerCase();
  const staff = isStaff(req);
  const authEmail = String((req as AuthenticatedRequest).user?.email || '').trim().toLowerCase();

  try {
    let result;
    if (staff && email) {
      result = await pool.query('SELECT * FROM appointments WHERE LOWER(email) = $1 ORDER BY created_at DESC', [email]);
    } else if (!staff) {
      if (!authEmail) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
      }
      result = await pool.query('SELECT * FROM appointments WHERE LOWER(email) = $1 ORDER BY created_at DESC', [authEmail]);
    } else {
      result = await pool.query('SELECT * FROM appointments ORDER BY created_at DESC');
    }

    res.json({
      appointments: result.rows.map((row: any) => ({
        id: row.id,
        department: row.department,
        appointmentType: row.appointment_type,
        businessName: row.business_name,
        tin: row.tin,
        address: row.address,
        description: row.description,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        date: row.appointment_date,
        timeSlot: row.time_slot,
        remarks: row.remarks,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ message: 'Failed to load appointments.' });
  }
}

export async function updateAppointmentStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const status = String(req.body?.status || '').toUpperCase();
  const validStatuses = ['PENDING', 'APPROVED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ message: 'Invalid appointment status.' });
    return;
  }

  const authEmail = String((req as AuthenticatedRequest).user?.email || '').trim().toLowerCase();

  try {
    const currentResult = await pool.query(`SELECT status, appointment_date, time_slot FROM appointments WHERE id = $1`, [id]);
    if (currentResult.rows.length === 0) {
      res.status(404).json({ message: 'Appointment not found.' });
      return;
    }
    const currentStatus = currentResult.rows[0].status;

    // Strict status machine enforcement
    if (currentStatus === 'PENDING' && !['APPROVED', 'CANCELLED'].includes(status)) {
      res.status(400).json({ message: 'PENDING appointments can only transition to APPROVED or CANCELLED.' });
      return;
    }
    if (currentStatus === 'APPROVED' && !['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(status)) {
      res.status(400).json({ message: 'APPROVED appointments can only transition to COMPLETED, NO_SHOW, or CANCELLED.' });
      return;
    }
    if (['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(currentStatus)) {
      res.status(400).json({ message: `Cannot modify appointment in ${currentStatus} status.` });
      return;
    }

    // Check slot availability again if approving
    if (currentStatus === 'PENDING' && status === 'APPROVED') {
      const slotCheck = await pool.query(
        `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = $1 AND time_slot = $2 AND status IN ('APPROVED', 'SCHEDULED') AND id != $3`,
        [currentResult.rows[0].appointment_date, currentResult.rows[0].time_slot, id]
      );
      const booked = parseInt(slotCheck.rows[0].count, 10);
      if (booked >= 10) {
        res.status(400).json({ message: 'The selected time slot is now fully booked.' });
        return;
      }
    }

    const result = await pool.query(`UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *`, [status, id]);
    
    await pool.query(
      `INSERT INTO appointment_audit_logs (id, appointment_id, action, performed_by, previous_status, new_status) VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), id, 'UPDATED', authEmail || 'Admin', currentStatus, status]
    );

    res.status(200).json({ message: 'Appointment status updated.', record: result.rows[0] });
  } catch (err) {
    console.error('Error updating appointment status:', err);
    res.status(500).json({ message: 'Failed to update appointment status.' });
  }
}

export async function deleteAppointment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await pool.query(`DELETE FROM appointments WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Appointment record not found.' });
      return;
    }
    await recordAudit(req, 'AUD-APT-DELETE', 'admin@lgu.gov.ph', 'admin', 'Appointments Module', 'APPOINTMENT_DELETED', 'WARNING', JSON.stringify(result.rows[0]), null);
    res.status(200).json({ message: 'Appointment record successfully deleted.' });
  } catch (err) {
    console.error('Error deleting appointment record:', err);
    res.status(500).json({ message: 'Failed to delete appointment from server.' });
  }
}

export async function linkInPersonApplication(req: Request, res: Response): Promise<void> {
  const { tracking_number } = req.body;
  const authEmail = String((req as AuthenticatedRequest).user?.email || '').trim().toLowerCase();

  if (!authEmail) {
    res.status(401).json({ message: 'Authenticated citizen email is required.' });
    return;
  }

  if (!tracking_number) {
    res.status(400).json({ message: 'Tracking number is required.' });
    return;
  }

  try {
    const checkResult = await pool.query(
      `SELECT * FROM business_assessments WHERE tracking_number = $1`,
      [tracking_number]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ message: 'Application not found with the provided tracking number.' });
      return;
    }

    const application = checkResult.rows[0];

    if (application.application_source !== 'IN_PERSON') {
      res.status(400).json({ message: 'Only in-person applications can be linked via this method.' });
      return;
    }

    if (String(application.email || '').trim().toLowerCase() !== authEmail) {
      res.status(403).json({ message: 'This application is registered to a different email address.' });
      return;
    }

    if (application.is_linked) {
      res.status(400).json({ message: 'This application is already linked to an account.' });
      return;
    }

    await pool.query(
      `UPDATE business_assessments SET is_linked = TRUE, updated_at = NOW() WHERE tracking_number = $1`,
      [tracking_number]
    );

    await recordAudit(
      req,
      'AUD-BIZ-LINK',
      authEmail,
      'citizen',
      'Business Tax Module',
      'BUSINESS_TAX_APPLICATION_LINKED',
      'INFO',
      JSON.stringify({ is_linked: false }),
      JSON.stringify({ is_linked: true, trackingNumber: tracking_number })
    );

    res.status(200).json({ message: 'Application successfully linked to your account.' });
  } catch (err: any) {
    console.error('Error linking application:', err);
    res.status(500).json({ message: err.message || 'Failed to link application.' });
  }
}

export async function verifyTaxBillOR(req: Request, res: Response): Promise<void> {
  const taxBillNo = String(req.body?.taxBillNo || '').trim();
  const orNo = String(req.body?.orNo || '').trim();

  if (!taxBillNo || !orNo) {
    res.status(400).json({ message: 'Both Tax Bill Number and O.R. Number are required for verification.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT business_name, tax_bill_number, official_receipt_number, payment_amount, payment_date, payment_method, payment_status 
       FROM business_assessments 
       WHERE tax_bill_number = $1 AND official_receipt_number = $2 AND payment_status = 'PAID'
       LIMIT 1`,
      [taxBillNo, orNo]
    );

    if (result.rows.length > 0) {
      res.status(200).json({ verified: true, record: result.rows[0] });
    } else {
      res.status(200).json({ verified: false });
    }
  } catch (err) {
    console.error('Error verifying Tax Bill & OR:', err);
    res.status(500).json({ message: 'Internal server error during verification.' });
  }
}

export async function verifyMayorPermit(req: Request, res: Response): Promise<void> {
  const permitNo = String(req.body?.permitNo || '').trim();
  const businessName = String(req.body?.businessName || '').trim();

  if (!permitNo || !businessName) {
    res.status(400).json({ message: 'Mayor’s Permit Number and Business Name are required.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id FROM business_permits 
       WHERE mayor_permit_no = $1 
         AND LOWER(business_name) = LOWER($2) 
         AND permit_status = 'ACTIVE' 
       LIMIT 1`,
      [permitNo, businessName]
    );

    if (result.rows.length > 0) {
      res.status(200).json({ exists: true });
    } else {
      res.status(200).json({ exists: false });
    }
  } catch (err) {
    console.error('Error verifying Mayor’s Permit:', err);
    res.status(500).json({ message: 'Server error while verifying Mayor’s Permit.' });
  }
}
