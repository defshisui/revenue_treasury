import type { Request, Response } from 'express';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import { AntiFraudService } from '../services/antiFraud.service.js';
import type { SaveLeaseBody, FraudScanBody } from '../types/index.js';

function autoDetectPaymentMethod(row: any): string {
  const raw = row.payment_method || row.paymentMethod;
  if (raw && String(raw).trim() !== '' && String(raw).trim() !== 'Not Specified') {
    return String(raw).trim();
  }
  const receipt = row.official_receipt_number || row.officialReceiptNumber || '';
  const ref = row.payment_reference || row.paymentReference || '';
  if (receipt.startsWith('OR-PM') || receipt.includes('PM') || ref.includes('TRX') || ref.toLowerCase().includes('paymongo')) {
    return 'PayMongo (QR Ph)';
  }
  if (receipt.startsWith('OR-GCASH') || receipt.includes('GCASH')) {
    return 'GCash';
  }
  if (receipt.startsWith('OR-MAYA') || receipt.includes('MAYA')) {
    return 'Maya';
  }
  if (receipt.startsWith('OR-LB') || receipt.includes('LINKBIZ')) {
    return 'Landbank Link.BizPortal';
  }
  return 'Cash / Direct';
}

function resolvePaymentMethod(body: Partial<SaveLeaseBody> & Record<string, any>): string {
  const raw = body.paymentMethod || body.payment_method;
  if (raw && String(raw).trim() !== '' && String(raw).trim() !== 'Not Specified') {
    return String(raw).trim();
  }
  return autoDetectPaymentMethod(body);
}

export async function getTransactions(_req: Request, res: Response): Promise<void> {
  try {
    const transactions: any[] = [];
    const seenRefs = new Set<string>();

    // 1. Market Leases
    try {
      const marketResult = await pool.query('SELECT * FROM market_leases ORDER BY created_at DESC');
      marketResult.rows.forEach((row) => {
        let formattedDate = '2026-06-15';
        if (row.payment_date || row.created_at) {
          const d = new Date(row.payment_date || row.created_at);
          if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
        }
        const ref = row.lease_id || `REF-${row.id}`;
        seenRefs.add(ref);
        transactions.push({
          id: row.id ? row.id.toString() : '1',
          transactionId: `TX-${row.lease_id || row.id}`,
          referenceNumber: ref,
          taxpayer: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown Taxpayer',
          paymentType: 'Market Rental',
          amount: parseFloat(row.amount_due) || 0,
          paymentMethod: autoDetectPaymentMethod(row),
          collector: 'Municipal Treasury',
          date: formattedDate,
          status: row.payment_status?.toLowerCase().includes('paid') ? 'Posted' : 'Pending',
          remarks: `Stall ${row.stall_number || 'N/A'} (${row.market_name || 'Public Market'})`,
        });
      });
    } catch (e) {
      console.error('Error fetching market transactions:', e);
    }

    // 2. Real Property Tax - Citizen RPT Payments
    try {
      const rptPayResult = await pool.query('SELECT * FROM citizen_rpt_payments ORDER BY payment_date DESC');
      rptPayResult.rows.forEach((row) => {
        let formattedDate = '2026-06-15';
        if (row.payment_date) {
          const d = new Date(row.payment_date);
          if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
        }
        const ref = row.payment_reference || row.official_receipt_number || `RPT-PAY-${row.id}`;
        seenRefs.add(ref);
        if (row.official_receipt_number) seenRefs.add(row.official_receipt_number);
        transactions.push({
          id: `rpt-pay-${row.id}`,
          transactionId: `TX-RPT-${row.official_receipt_number || row.id}`,
          referenceNumber: ref,
          taxpayer: row.owner_name || 'RPT Taxpayer',
          paymentType: 'Real Property Tax',
          amount: parseFloat(row.amount) || 0,
          paymentMethod: row.payment_method || 'PayMongo (Online)',
          collector: 'Office of the City Assessor & Treasury',
          date: formattedDate,
          status: 'Posted',
          remarks: `TDN: ${row.tax_declaration_number || 'N/A'} (${row.payment_option || 'Full'})`,
        });
      });
    } catch (e) {
      console.error('Error fetching RPT citizen payments:', e);
    }

    // 3. Real Property Tax - Settled LGU records
    try {
      const lguRptResult = await pool.query(
        "SELECT * FROM lgu_rpt_records WHERE LOWER(COALESCE(paymentstatus, payment_status, '')) IN ('paid', 'settled', 'payment completed') OR officialreceiptnumber IS NOT NULL OR official_receipt_number IS NOT NULL"
      );
      lguRptResult.rows.forEach((row) => {
        const orNum = row.officialreceiptnumber || row.official_receipt_number;
        const ref = row.paymentreference || row.payment_reference || row.taxdeclarationnumber || row.tax_declaration_number || `LGU-RPT-${row.id}`;
        if (orNum && seenRefs.has(orNum)) return;
        if (seenRefs.has(ref)) return;
        seenRefs.add(ref);

        let formattedDate = '2026-06-15';
        const dStr = row.paymentdate || row.payment_date;
        if (dStr) {
          const d = new Date(dStr);
          if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
        }

        const amt = parseFloat(row.amountpaid || row.amount_paid || row.totalassessment || row.total_assessment || 0) || 0;
        transactions.push({
          id: `rpt-lgu-${row.id}`,
          transactionId: `TX-RPT-${orNum || row.id}`,
          referenceNumber: orNum || ref,
          taxpayer: row.ownername || row.owner_name || 'RPT Taxpayer',
          paymentType: 'Real Property Tax',
          amount: amt,
          paymentMethod: row.paymentmethod || row.payment_method || 'PayMongo',
          collector: 'Office of the City Assessor & Treasury',
          date: formattedDate,
          status: 'Posted',
          remarks: `TDN: ${row.taxdeclarationnumber || row.tax_declaration_number || 'N/A'}`,
        });
      });
    } catch (e) {
      console.error('Error fetching LGU RPT records:', e);
    }

    // 4. Real Property Tax - RPT Applications
    try {
      const rptAppsResult = await pool.query(
        "SELECT * FROM rpt_applications WHERE LOWER(COALESCE(payment_status, '')) IN ('paid', 'payment completed') ORDER BY created_at DESC"
      );
      rptAppsResult.rows.forEach((row) => {
        const ref = row.official_receipt_number || row.payment_reference || row.reference_number || row.control_number || `RPT-APP-${row.id}`;
        if (seenRefs.has(ref)) return;
        seenRefs.add(ref);

        let formattedDate = '2026-06-15';
        if (row.payment_date || row.created_at) {
          const d = new Date(row.payment_date || row.created_at);
          if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
        }

        transactions.push({
          id: `rpt-app-${row.id}`,
          transactionId: `TX-RPT-APP-${row.control_number || row.id}`,
          referenceNumber: ref,
          taxpayer: row.applicant_name || row.owner_name || 'RPT Applicant',
          paymentType: 'Real Property Tax',
          amount: parseFloat(row.payment_amount || row.transfer_tax_amount || 0) || 0,
          paymentMethod: row.payment_method || 'PayMongo',
          collector: 'Office of the City Assessor & Treasury',
          date: formattedDate,
          status: 'Posted',
          remarks: `Application: ${row.service || 'RPT Service'} (${row.control_number || 'N/A'})`,
        });
      });
    } catch (e) {
      console.error('Error fetching RPT applications:', e);
    }

    // 5. Business Tax - Business Assessments
    try {
      const bizResult = await pool.query(
        "SELECT * FROM business_assessments WHERE UPPER(COALESCE(status, '')) = 'APPROVED' OR LOWER(COALESCE(remarks, '')) LIKE 'paid via%' ORDER BY application_date DESC"
      );
      bizResult.rows.forEach((row) => {
        const ref = row.tax_bill_number || row.tracking_number || `BIZ-${row.id}`;
        if (seenRefs.has(ref)) return;
        seenRefs.add(ref);

        let formattedDate = '2026-06-15';
        if (row.application_date || row.created_at) {
          const d = new Date(row.application_date || row.created_at);
          if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
        }

        const rawSales = parseFloat(row.gross_sales) || 0;
        const estTax = rawSales > 0 ? Number((rawSales * 0.02).toFixed(2)) : 2500;

        transactions.push({
          id: `biz-${row.id}`,
          transactionId: `TX-BIZ-${row.tax_bill_number || row.tracking_number || row.id}`,
          referenceNumber: ref,
          taxpayer: row.business_name ? `${row.business_name} (${row.business_owner || 'Owner'})` : 'Business Taxpayer',
          paymentType: 'Business Tax',
          amount: estTax,
          paymentMethod: row.remarks && row.remarks.includes('PayMongo') ? 'PayMongo' : 'Treasury Cashier',
          collector: 'BPLO / Treasury',
          date: formattedDate,
          status: 'Posted',
          remarks: `Tracking: ${row.tracking_number || 'N/A'} (Tax Bill: ${row.tax_bill_number || 'N/A'})`,
        });
      });
    } catch (e) {
      console.error('Error fetching business tax records:', e);
    }

    res.json(transactions);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ message: 'Error loading transactions' });
  }
}

export async function createTransaction(_req: Request, res: Response): Promise<void> {
  res.status(201).json({ message: 'Transaction recorded successfully' });
}

export async function getMarketLeases(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM market_leases ORDER BY created_at DESC');
    const formatted = result.rows.map((row) => ({
      id: row.id.toString(),
      leaseId: row.lease_id,
      firstName: row.first_name,
      lastName: row.last_name,
      marketName: row.market_name,
      section: row.section,
      stallNumber: row.stall_number,
      leaseStatus: row.lease_status,
      amountDue: parseFloat(row.amount_due) || 0,
      email: row.email || null,
      helperApprovalStatus: row.helper_approval_status,
      advancePaymentStatus: row.advance_payment_status,
      paymentStatus: row.payment_status,
      paymentMethod: autoDetectPaymentMethod(row),
      officialReceiptNumber: row.official_receipt_number || null,
      paymentReference: row.payment_reference || null,
      paymentDate: row.payment_date || null,
      paymentProof: row.payment_proof || null,
      mismatchNotes: row.mismatch_notes || null,
      createdAt: row.created_at,
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching market leases:', err);
    res.status(500).json({ message: 'Error loading market leases' });
  }
}

export async function createMarketLease(req: Request, res: Response): Promise<void> {
  const body = req.body as SaveLeaseBody;
  const { firstName, lastName, marketName, section, stallNumber,
    leaseStatus, amountDue, helperApprovalStatus, advancePaymentStatus, paymentStatus } = body;

  if (!firstName || !lastName || !marketName || !section || !stallNumber) {
    res.status(400).json({ message: 'First name, last name, market name, section, and stall number are required.' });
    return;
  }

  const resolvedPaymentMethod = resolvePaymentMethod(body);
  const applicantEmail = `${firstName.trim()}.${lastName.trim()}@citizen.gov.ph`.toLowerCase().replace(/\s+/g, '');

  try {
    if (body.leaseId) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM market_leases WHERE lease_id = $1',
        [body.leaseId]
      );
      if (duplicateCheck.rows.length > 0) {
        res.status(400).json({ message: `Lease ID ${body.leaseId} is already registered.` });
        return;
      }
    }
    const rawForwarded = req?.headers['x-forwarded-for'];
    const clientIP = typeof rawForwarded === 'string'
      ? rawForwarded.split(',')[0].trim()
      : (Array.isArray(rawForwarded) ? rawForwarded[0].trim() : (req?.ip || req?.socket?.remoteAddress || 'Unknown'));

    const fraudCheck = await AntiFraudService.evaluateRisk({
      ip: clientIP !== 'Unknown' ? clientIP : undefined,
      email: applicantEmail,
      username: `${firstName || ''} ${lastName || ''}`.trim(),
      amount: parseFloat(String(amountDue || 0)),
      currency: 'PHP',
    });

    if (fraudCheck.isFraud) {
      console.warn(`[Anti-Fraud] Blocked market stall application for ${applicantEmail}. Score: ${fraudCheck.score}`);
      await recordAudit(
        req,
        'AUD-FRAUD-MARKET-BLOCK',
        applicantEmail,
        'Citizen',
        'Market Stall',
        'STALL_APPLICATION_BLOCKED',
        'CRITICAL',
        `Stall ${stallNumber} at ${marketName}`,
        `Blocked by Anti-Fraud AI. Score: ${fraudCheck.score}`
      );
      res.status(403).json({ message: 'Application blocked by security policy. Please verify your details or visit the treasury office in person.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO market_leases
       (lease_id, first_name, last_name, email, market_name, section, stall_number, lease_status,
        amount_due, helper_approval_status, advance_payment_status, payment_status, payment_method, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       RETURNING *`,
      [
        body.leaseId || `LEASE-${Date.now()}`,
        firstName, lastName, body.email || applicantEmail,
        marketName, section, stallNumber,
        leaseStatus || 'Active', amountDue || 0,
        helperApprovalStatus || 'Pending',
        advancePaymentStatus || 'Requested',
        paymentStatus || 'Pending Payment',
        resolvedPaymentMethod,
      ]
    );

    try {
      await recordAudit(
        req,
        'AUD-MARKET-SUBMIT',
        applicantEmail,
        'Citizen',
        'Market Module',
        'STALL_APPLICATION_SUBMITTED',
        'INFO',
        null,
        `Applied for Stall ${stallNumber} at ${marketName} via ${resolvedPaymentMethod} (Anti-Fraud Score: ${fraudCheck.score})`
      );
    } catch (auditError) {
      console.error('Market lease saved, but audit logging failed:', auditError);
    }

    res.status(201).json({
      message: 'Lease application saved successfully',
      lease: result.rows[0],
    });
  } catch (err: any) {
    console.error('Error saving market lease:', err);

    res.status(500).json({
      message: 'Failed to save market lease application to database.',
      error: err?.message || 'Unknown database error',
    });
  }
}

export async function updateMarketLease(req: Request, res: Response): Promise<void> {
  const rawParamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = String(rawParamId || '').trim();
  const body = req.body as any;

  const targetId = id || String(body.leaseId || body.lease_id || body.id || '').trim();

  if (!targetId) {
    res.status(400).json({ message: 'Lease ID is required to update this record.' });
    return;
  }

  const firstName = String(body.firstName ?? body.first_name ?? '').trim();
  const lastName = String(body.lastName ?? body.last_name ?? '').trim();
  const marketName = String(body.marketName ?? body.market_name ?? '').trim();
  const section = String(body.section ?? '').trim();
  const stallNumber = String(body.stallNumber ?? body.stall_number ?? '').trim();

  if (!firstName || !lastName || !marketName || !section || !stallNumber) {
    res.status(400).json({
      message: 'First name, last name, market name, section, and stall number are required.',
    });
    return;
  }

  const leaseStatus = String(
    body.leaseStatus ?? body.lease_status ?? 'Active'
  ).trim();

  const rawAmount =
    body.amountDue !== undefined
      ? body.amountDue
      : body.amount_due !== undefined
        ? body.amount_due
        : 0;

  const amountDue = Number(rawAmount);
  if (!Number.isFinite(amountDue)) {
    res.status(400).json({ message: 'Amount Due must be a valid number.' });
    return;
  }

  const helperApprovalStatus = String(
    body.helperApprovalStatus ??
      body.helper_approval_status ??
      'Pending'
  ).trim();

  const advancePaymentStatus = String(
    body.advancePaymentStatus ??
      body.advance_payment_status ??
      'Requested'
  ).trim();

  const paymentStatus = String(
    body.paymentStatus ??
      body.payment_status ??
      'Pending Payment'
  ).trim();

  const resolvedPaymentMethod = resolvePaymentMethod(body);

  const officialReceiptNumber =
    body.officialReceiptNumber !== undefined
      ? body.officialReceiptNumber || null
      : body.official_receipt_number !== undefined
        ? body.official_receipt_number || null
        : null;

  const paymentReference =
    body.paymentReference !== undefined
      ? body.paymentReference || null
      : body.payment_reference !== undefined
        ? body.payment_reference || null
        : null;

  const email =
    body.email !== undefined && body.email !== ''
      ? String(body.email).trim()
      : null;

  const paymentProof =
    body.paymentProof !== undefined
      ? body.paymentProof
      : body.payment_proof !== undefined
        ? body.payment_proof
        : null;

  const mismatchNotes =
    body.mismatchNotes !== undefined
      ? body.mismatchNotes
      : body.mismatch_notes !== undefined
        ? body.mismatch_notes
        : null;

  let safePaymentDate: string | null = null;
  const rawDate = body.paymentDate ?? body.payment_date;

  if (
    rawDate !== undefined &&
    rawDate !== null &&
    String(rawDate).trim() !== '' &&
    String(rawDate) !== 'null' &&
    String(rawDate) !== 'undefined'
  ) {
    const parsedDate = new Date(String(rawDate));

    if (!Number.isNaN(parsedDate.getTime())) {
      safePaymentDate = parsedDate.toISOString();
    }
  }

  try {
    /*
     * Build the UPDATE from columns that actually exist in the Railway
     * database. This makes Save Changes tolerant of older market_leases
     * schemas while still saving every supported field.
     */
    const columnResult = await pool.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'market_leases'`
    );

    const availableColumns = new Set(
      columnResult.rows.map((row: any) => String(row.column_name))
    );

    const fields: Array<{ column: string; value: any }> = [
      { column: 'first_name', value: firstName },
      { column: 'last_name', value: lastName },
      { column: 'market_name', value: marketName },
      { column: 'section', value: section },
      { column: 'stall_number', value: stallNumber },
      { column: 'lease_status', value: leaseStatus },
      { column: 'amount_due', value: amountDue },
      { column: 'helper_approval_status', value: helperApprovalStatus },
      { column: 'advance_payment_status', value: advancePaymentStatus },
      { column: 'payment_status', value: paymentStatus },
      { column: 'payment_method', value: resolvedPaymentMethod },
      { column: 'official_receipt_number', value: officialReceiptNumber },
      { column: 'payment_reference', value: paymentReference },
      { column: 'payment_date', value: safePaymentDate },
      { column: 'payment_proof', value: paymentProof },
      { column: 'mismatch_notes', value: mismatchNotes },
      { column: 'email', value: email },
    ];

    const updateFields = fields.filter((field) =>
      availableColumns.has(field.column)
    );

    if (updateFields.length === 0) {
      res.status(500).json({
        message: 'The market_leases table has no editable columns available.',
      });
      return;
    }

    const setParts = updateFields.map(
      (field, index) => `"${field.column}" = $${index + 1}`
    );

    const values = updateFields.map((field) => field.value);
    const targetParam = values.length + 1;
    values.push(targetId);

    /*
     * Match either the public lease_id or PostgreSQL numeric id.
     * Casting id to text avoids changing the parameter type.
     */
    const result = await pool.query(
      `UPDATE market_leases
          SET ${setParts.join(', ')}
        WHERE lease_id = $${targetParam}
           OR id::text = $${targetParam}
        RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        message: `Lease record '${targetId}' was not found in the database.`,
      });
      return;
    }

    const row = result.rows[0];

    const formatted = {
      id: row.id !== undefined && row.id !== null ? String(row.id) : targetId,
      leaseId: row.lease_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email ?? null,
      marketName: row.market_name,
      section: row.section,
      stallNumber: row.stall_number,
      leaseStatus: row.lease_status,
      amountDue: Number(row.amount_due) || 0,
      helperApprovalStatus: row.helper_approval_status,
      advancePaymentStatus: row.advance_payment_status,
      paymentStatus: row.payment_status,
      paymentMethod: autoDetectPaymentMethod(row),
      officialReceiptNumber: row.official_receipt_number ?? null,
      paymentReference: row.payment_reference ?? null,
      paymentDate: row.payment_date ?? null,
      paymentProof: row.payment_proof ?? null,
      mismatchNotes: row.mismatch_notes ?? null,
      createdAt: row.created_at,
    };

    // Audit failure must never turn a successful database update into a 500.
    try {
      await recordAudit(
        req,
        'AUD-MARKET-UPDATE',
        email || 'system-admin@lgu.gov.ph',
        'admin',
        'Market Module',
        'STALL_APPLICATION_UPDATED',
        'INFO',
        null,
        `Updated lease record ${row.lease_id || targetId} for Stall ${row.stall_number || stallNumber}`
      );
    } catch (auditError) {
      console.warn(
        'Market lease updated successfully, but audit logging failed:',
        auditError
      );
    }

    res.status(200).json({
      success: true,
      message: 'Lease updated successfully',
      lease: formatted,
    });
  } catch (err: any) {
    console.error('Error updating market lease:', err);

    /*
     * Send the actual PostgreSQL error as message so marketService.ts
     * and the Admin UI can display the real reason if something unusual
     * still exists in the Railway database.
     */
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to update market lease in database.',
      error: err?.message || 'Unknown database error',
      code: err?.code,
      detail: err?.detail,
      hint: err?.hint,
    });
  }
}

export async function deleteMarketLease(req: Request, res: Response): Promise<void> {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const trimmedId = String(rawId || '').trim();
  let decodedId = trimmedId;
  try {
    decodedId = decodeURIComponent(trimmedId).trim();
  } catch {}

  try {
    const result = await pool.query(
      `DELETE FROM market_leases 
       WHERE lease_id = $1 
          OR LOWER(TRIM(lease_id)) = LOWER(TRIM($1)) 
          OR id::text = $1
          OR lease_id = $2
          OR LOWER(TRIM(lease_id)) = LOWER(TRIM($2))
          OR id::text = $2
          OR lease_id ILIKE $1
          OR lease_id ILIKE $2
       RETURNING *`,
      [trimmedId, decodedId]
    );

    if (result.rows.length === 0) {
      // Nothing matched — either already gone or ID mismatch. Return 200 (idempotent)
      console.warn(`[deleteMarketLease] No rows matched id='${trimmedId}'. Already deleted or ID not found.`);
      res.status(200).json({
        message: 'Lease record not found or already deleted',
        deletedCount: 0,
        deletedLease: null,
      });
      return;
    }

    try {
      await recordAudit(req, 'AUD-MARKET-DELETE', 'system-admin@lgu.gov.ph', 'admin',
        'Market Module', 'STALL_LEASE_DELETED', 'WARNING', `Deleted lease record ${trimmedId}`, null);
    } catch (auditErr) {
      console.warn('Audit log error on delete lease:', auditErr);
    }

    res.status(200).json({
      message: 'Lease deleted successfully from database',
      deletedCount: result.rows.length,
      deletedLease: result.rows[0] || null,
    });
  } catch (err: any) {
    console.error('Error deleting market lease:', err);
    res.status(500).json({ message: 'Failed to delete market lease from database.', error: err?.message });
  }
}

export async function fraudScan(req: Request, res: Response): Promise<void> {
  const body = req.body as FraudScanBody;
  const rawId = body.leaseId || body.id || body.lease_id;

  if (!rawId) {
    res.status(400).json({ error: 'Lease ID is required for fraud analysis.' });
    return;
  }

  const searchId = String(rawId).trim();

  try {
    let leaseQuery = await pool.query('SELECT * FROM market_leases WHERE lease_id=$1', [searchId]);

    if (leaseQuery.rows.length === 0 && !isNaN(Number(searchId))) {
      leaseQuery = await pool.query('SELECT * FROM market_leases WHERE id=$1', [parseInt(searchId, 10)]);
    }

    if (leaseQuery.rows.length === 0) {
      res.status(404).json({ error: 'Lease record not found in database.' });
      return;
    }

    const lease = leaseQuery.rows[0];
    const flags: string[] = [];
    const amountDue = parseFloat(lease.amount_due) || 0;
    const applicantName = `${lease.first_name || ''} ${lease.last_name || ''}`.trim();
    const applicantEmail = `${lease.first_name || 'applicant'}.${lease.last_name || 'taxpayer'}@citizen.gov.ph`.toLowerCase().replace(/\s+/g, '');


    const rawForwarded = req?.headers['x-forwarded-for'];
    const clientIP = typeof rawForwarded === 'string'
      ? rawForwarded.split(',')[0].trim()
      : (Array.isArray(rawForwarded) ? rawForwarded[0].trim() : (req?.ip || req?.socket?.remoteAddress || 'Unknown'));

    const aiCheck = await AntiFraudService.evaluateRisk({
      ip: clientIP !== 'Unknown' ? clientIP : undefined,
      email: applicantEmail,
      username: applicantName,
      amount: amountDue,
      currency: 'PHP',
    });

    let riskScore = aiCheck.score > 0 ? Math.round(aiCheck.score * 0.6) : 10;

    if (aiCheck.score > 0) {
      flags.push(`FraudLabs Pro AI Risk Score: ${aiCheck.score}/100.`);
    }


    if (amountDue > 50000) {
      riskScore += 25;
      flags.push(`High financial exposure detected: ₱${amountDue.toLocaleString()} exceeds standard median threshold.`);
    }


    try {
      const allLeases = (await pool.query('SELECT * FROM market_leases')).rows;
      const nameCollisions = allLeases.filter((l) =>
        l.id !== lease.id &&
        String(l.first_name || '').trim().toLowerCase() === String(lease.first_name || '').trim().toLowerCase() &&
        String(l.last_name || '').trim().toLowerCase() === String(lease.last_name || '').trim().toLowerCase()
      );
      if (nameCollisions.length > 0) {
        riskScore += 30;
        flags.push(`Database collision alert: ${nameCollisions.length} other active lease record(s) found under identical name (${lease.first_name} ${lease.last_name}).`);
      }
    } catch (e) {
      console.warn('Market leases batch scan warning:', (e as Error).message);
    }


    try {
      const allAudits = (await pool.query('SELECT * FROM audit_logs')).rows;
      const cleanName = applicantName.toLowerCase();
      const suspiciousAudits = allAudits.filter((log) => {
        const text = `${log.user_email || ''} ${log.previous_data || ''} ${log.new_data || ''}`.toLowerCase();
        return cleanName && text.includes(cleanName) && ['WARNING', 'CRITICAL'].includes(log.severity);
      });
      if (suspiciousAudits.length > 0) {
        riskScore += 20;
        flags.push(`Security audit trail flags ${suspiciousAudits.length} prior warning or critical event(s) linked to applicant profile.`);
      }
    } catch (e) {
      console.warn('Audit logs batch scan warning:', (e as Error).message);
    }

    if (riskScore > 99) riskScore = 99;
    const riskLevel: 'Low' | 'Medium' | 'High' = riskScore >= 70 ? 'High' : riskScore >= 35 ? 'Medium' : 'Low';
    if (flags.length === 0) flags.push('Database & AI validation passed cleanly. No multi-stall name collisions or abnormal payment spikes found.');


    if (riskScore >= 50 || aiCheck.isFraud) {
      await recordAudit(
        req,
        'AUD-FRAUD-MARKET-INSPECT',
        applicantEmail,
        'Admin',
        'Market Stall',
        riskScore >= 70 ? 'STALL_HIGH_RISK_DETECTED' : 'STALL_RISK_FLAGGED',
        riskScore >= 70 ? 'CRITICAL' : 'WARNING',
        `Stall ${lease.stall_number} (${lease.market_name})`,
        `AI Risk Assessment Score: ${riskScore}. Signals: ${flags.join(' | ')}`
      );
    }

    res.status(200).json({ success: true, riskScore, riskLevel, flags });
  } catch (err) {
    console.error('Error executing database fraud scan:', err);
    res.status(500).json({ error: 'Internal server error during AI fraud analysis.' });
  }
}
