// src/controllers/rpt.controller.ts
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import type { RptPaymentBody } from '../types/index.js';

const RPT_SERVICES = [
  'Transfer of Ownership',
  'Consolidation / Segregation',
  'New Assessment / Reassessment / Reclassification',
  'Correction / Updating / Revision',
  'Declaration of New / Undeclared Land',
  'Cancellation of Assessment Records',
] as const;

const RPT_STATUS_FLOW: Record<string, string[]> = {
  'Transfer of Ownership': ['Submitted', 'For Review', 'Under Evaluation', 'For Compliance', 'For Payment', 'Processing', 'Approved', 'Ready for Release', 'Completed'],
  'Consolidation / Segregation': ['Submitted', 'For Review', 'Under Evaluation', 'For Compliance', 'Processing', 'Approved', 'Ready for Release', 'Completed'],
  'New Assessment / Reassessment / Reclassification': ['Submitted', 'For Review', 'Under Evaluation', 'For Compliance', 'Processing', 'Approved', 'Ready for Release', 'Completed'],
  'Correction / Updating / Revision': ['Submitted', 'For Review', 'Under Evaluation', 'For Compliance', 'Processing', 'Approved', 'Ready for Release', 'Completed'],
  'Declaration of New / Undeclared Land': ['Submitted', 'For Review', 'Under Evaluation', 'For Compliance', 'Processing', 'Approved', 'Ready for Release', 'Completed'],
  'Cancellation of Assessment Records': ['Submitted', 'For Review', 'Under Evaluation', 'For Compliance', 'Processing', 'Approved', 'Ready for Release', 'Completed'],
};

function normaliseService(service: unknown): string {
  const value = String(service || '').trim();
  return (RPT_SERVICES as readonly string[]).includes(value) ? value : '';
}

export async function getRptApplications(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM rpt_applications ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching RPT applications:', err);
    res.status(500).json({ message: 'Error loading RPT applications' });
  }
}

export async function createRptApplication(req: Request, res: Response): Promise<void> {
  const appData = req.body as Record<string, any>;
  const files = (req as Request & { files?: Express.Multer.File[] }).files;

  // 1. Map uploaded files directly into Base64 strings or storage paths to match business tax structure[cite: 4]
  let fileObjects: Array<{ name: string; url: string }> = [];
  if (files && files.length > 0) {
    fileObjects = files.map((f: any) => ({
      name: f.originalname || f.filename,
      url: f.buffer ? `data:${f.mimetype};base64,${f.buffer.toString('base64')}` : `/uploads/${f.filename}`
    }));
  }

  // 2. Fallback if physical files were not processed by multer but document names/paths were passed in body[cite: 4]
  if (fileObjects.length === 0 && appData.documents) {
    try {
      const parsed = typeof appData.documents === 'string' ? JSON.parse(appData.documents) : appData.documents;
      if (Array.isArray(parsed)) {
        fileObjects = parsed.map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            return {
              name: item.name || 'Document',
              url: item.url || ''
            };
          }
          const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
          const cleanPath = itemStr.replace(/["'{}]/g, "").trim();
          const parts = cleanPath.split(': ');
          const fileName = parts.length > 1 ? parts[1].trim() : cleanPath;
          const pathOnly = fileName.startsWith('data:') || fileName.startsWith('http') || fileName.startsWith('/uploads/') ? fileName : `/uploads/${fileName}`;
          return {
            name: fileName.split('/').pop() || fileName,
            url: pathOnly
          };
        });
      }
    } catch {
      const cleanStr = String(appData.documents).replace(/["'{}]/g, "").trim();
      const parts = cleanStr.split(': ');
      const fileName = parts.length > 1 ? parts[1].trim() : cleanStr;
      const pathOnly = fileName.startsWith('data:') || fileName.startsWith('http') || fileName.startsWith('/uploads/') ? fileName : `/uploads/${fileName}`;
      fileObjects = [{
        name: fileName.split('/').pop() || fileName,
        url: pathOnly
      }];
    }
  }

  const ownerName = appData.owner_name || appData.ownerName || '';
  let resolvedApplicantName = appData.applicant_name || appData.applicantName || ownerName || 'Unknown Applicant';
  const service = normaliseService(appData.service);
  if (!service) {
    res.status(400).json({ message: 'Please select a valid Quezon City Real Property Assessor service.' });
    return;
  }
  if (!ownerName || !resolvedApplicantName || !appData.email || !appData.mobile_number && !appData.mobileNumber) {
    res.status(400).json({ message: 'Applicant name, owner name, email, and mobile number are required.' });
    return;
  }
  if (appData.applicant_type === 'Authorized Representative') {
    const hasAuthorization = fileObjects.some((doc) => /authorization|special power|spa/i.test(doc.name || ''));
    if (!hasAuthorization) {
      res.status(400).json({ message: 'Authorized representatives must submit an authorization document or Special Power of Attorney.' });
      return;
    }
  }

  try {
    // Explicitly cast $16 as jsonb to match your PostgreSQL table schema column type perfectly
    const result = await pool.query(
      `INSERT INTO rpt_applications
       (id, control_number, tax_declaration_number, owner_name, applicant_name, applicant_type, email, mobile_number, service, property_location, barangay, property_type, status, filed_date, notes, documents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
       RETURNING *`,
      [
        appData.id || randomUUID(),
        appData.control_number || null,
        appData.tax_declaration_number || null,
        ownerName,
        resolvedApplicantName,
        appData.applicant_type || null,
        appData.email || null,
        appData.mobile_number || null,
        service,
        appData.property_location || null,
        appData.barangay || null,
        appData.property_type || null,
        appData.status || 'Submitted',
        appData.filed_date || new Date().toISOString().split('T')[0],
        appData.notes || null,
        JSON.stringify(fileObjects),
      ]
    );

    await recordAudit(req, 'AUD-RPT-SUBMIT', appData.email || 'citizen@gov.ph', 'Citizen',
      'RPT Module', 'RPT_APPLICATION_SUBMITTED', 'INFO', null,
      `Submitted RPT application for applicant: ${resolvedApplicantName}`);

    res.status(201).json({ message: 'RPT application saved successfully', record: result.rows[0] });
  } catch (err) {
    console.error('Error saving RPT application:', err);
    res.status(500).json({ message: 'Failed to save RPT application to database.' });
  }
}

export async function deleteRptApplication(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM rpt_applications WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'RPT application not found' });
      return;
    }

    await recordAudit(req, 'AUD-RPT-DELETE', 'admin@gov.ph', 'Admin',
      'RPT Module', 'RPT_APPLICATION_DELETED', 'WARNING', null,
      `Deleted RPT application ID: ${id}`);

    res.json({ success: true, message: 'RPT application deleted successfully' });
  } catch (err) {
    console.error('Error deleting RPT application:', err);
    res.status(500).json({ message: 'Failed to delete RPT application from database.' });
  }
}

export async function updateRptApplicationStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, notes, assignedOfficer, paymentAmount, paymentStatus, paymentDueDate, workflowStage, complianceRemarks, transferTaxStatus, transferTaxAmount, officialReceiptNumber, paymentReference, paymentMethod, paymentDate } = req.body;

  const numericPaymentAmount = paymentAmount === undefined || paymentAmount === null || paymentAmount === '' ? null : Number(paymentAmount);
  const numericTransferTaxAmount = transferTaxAmount === undefined || transferTaxAmount === null || transferTaxAmount === '' ? null : Number(transferTaxAmount);
  if (numericPaymentAmount !== null && (!Number.isFinite(numericPaymentAmount) || numericPaymentAmount < 0)) {
    res.status(400).json({ message: 'Payment amount must be a valid non-negative number.' }); return;
  }
  if (numericTransferTaxAmount !== null && (!Number.isFinite(numericTransferTaxAmount) || numericTransferTaxAmount <= 0)) {
    res.status(400).json({ message: 'Transfer Tax amount must be greater than zero.' }); return;
  }

  try {
    const current = await pool.query('SELECT * FROM rpt_applications WHERE id = $1 LIMIT 1', [id]);
    if (current.rowCount === 0) { res.status(404).json({ message: 'RPT application not found' }); return; }
    const currentRow = current.rows[0];
    const service = normaliseService(currentRow.service);
    const allowed = RPT_STATUS_FLOW[service] || RPT_STATUS_FLOW['Transfer of Ownership'];
    if (status && status !== 'Rejected' && status !== 'Archived' && status !== 'Digital Certificate Issued' && !allowed.includes(status)) {
      res.status(400).json({ message: `Invalid workflow status for ${service}.` }); return;
    }
    if (status === 'For Payment' && service !== 'Transfer of Ownership') {
      res.status(400).json({ message: 'For Payment is only used for the Transfer of Ownership Transfer Tax assessment.' }); return;
    }
    if (status === 'For Payment' && (numericPaymentAmount === null || numericPaymentAmount <= 0) && Number(currentRow.payment_amount || 0) <= 0) {
      res.status(400).json({ message: 'Assess the Transfer Tax amount before moving the application to For Payment.' }); return;
    }

    const result = await pool.query(
      `UPDATE rpt_applications
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           assigned_officer = COALESCE($3, assigned_officer),
           payment_amount = COALESCE($4, payment_amount),
           payment_status = COALESCE($5, payment_status),
           payment_due_date = COALESCE($6, payment_due_date),
           workflow_stage = COALESCE($7, workflow_stage),
           compliance_remarks = COALESCE($8, compliance_remarks),
           transfer_tax_status = COALESCE($9, transfer_tax_status),
           transfer_tax_amount = COALESCE($10, transfer_tax_amount),
           official_receipt_number = COALESCE($11, official_receipt_number),
           payment_reference = COALESCE($12, payment_reference),
           payment_method = COALESCE($13, payment_method),
           payment_date = COALESCE($14, payment_date)
       WHERE id = $15
       RETURNING *`,
      [status, notes, assignedOfficer, numericPaymentAmount, paymentStatus, paymentDueDate || null, workflowStage || status || null, complianceRemarks || null, transferTaxStatus || (status === 'For Payment' ? 'For Payment' : null), numericTransferTaxAmount, officialReceiptNumber || null, paymentReference || null, paymentMethod || null, paymentDate || null, id]
    );

    await recordAudit(req, 'AUD-RPT-STATUS', 'admin@gov.ph', 'Admin', 'RPT Module', 'RPT_STATUS_UPDATED', 'INFO', null, `Updated RPT application ${id} status to ${status || result.rows[0].status}`);
    res.json({ success: true, message: 'Status updated successfully', record: result.rows[0] });
  } catch (err) {
    console.error('Error updating RPT application status:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
}

export async function searchRptByTdn(req: Request, res: Response): Promise<void> {
  const rawTdn = String(req.query.tdn || req.params.tdn || '').trim();

  if (!rawTdn) {
    res.status(400).json({ message: 'Please provide a Tax Declaration Number.' });
    return;
  }

  try {
    // 1. Search for direct match on TDN (case-insensitive)
    const directResult = await pool.query(
      `SELECT * FROM lgu_rpt_records
       WHERE LOWER(REPLACE(taxDeclarationNumber, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
       LIMIT 1`,
      [rawTdn]
    );

    if (directResult.rowCount === 0) {
      res.status(404).json({
        found: false,
        message: `Tax Declaration Number "${rawTdn}" was not found in the city assessment records.`
      });
      return;
    }

    const matchedRecord = directResult.rows[0];
    const ownerName = matchedRecord.ownername || matchedRecord.ownerName;

    // 2. Fetch all other associated TDNs for this owner/PIN cluster (Possible properties you might own / Group Bill Set)
    const associatedResult = await pool.query(
      `SELECT * FROM lgu_rpt_records
       WHERE (
         LOWER(TRIM(ownerName)) = LOWER(TRIM($1))
         OR (pin IS NOT NULL AND SUBSTRING(pin FROM 1 FOR 10) = SUBSTRING($2 FROM 1 FOR 10))
       )
       ORDER BY taxDeclarationNumber ASC`,
      [ownerName, matchedRecord.pin || '']
    );

    const associatedProperties = associatedResult.rows.map((row: any) => ({
      id: row.id,
      taxDeclarationNumber: row.taxdeclarationnumber || row.taxDeclarationNumber,
      pin: row.pin,
      newPspin: row.new_pspin || row.newPspin || `${row.pin || '09-021-000'}- - -`,
      ownerName: row.ownername || row.ownerName,
      propertyLocation: row.propertylocation || row.propertyLocation,
      barangay: row.barangay,
      propertyType: row.propertytype || row.propertyType,
      billingYear: row.billingyear || row.billingYear || 2025,
      billExpiryDate: row.bill_expiry_date || row.billExpiryDate || '2025-10-31',
      lotAreaSqM: parseFloat(row.lot_area_sqm || row.lotAreaSqM || 0),
      assessedValue: parseFloat(row.assessed_value || row.assessedValue || 0),
      marketValue: parseFloat(row.market_value || row.marketValue || 0),
      basicTax: parseFloat(row.basictax || row.basicTax || 0),
      sefTax: parseFloat(row.seftax || row.sefTax || 0),
      shttcApplied: parseFloat(row.shttc_applied || row.shttcApplied || 0),
      specialLevy: parseFloat(row.speciallevy || row.specialLevy || 0),
      penalty: parseFloat(row.penalty || 0),
      discount: parseFloat(row.discount || 0),
      totalAssessment: parseFloat(row.totalassessment || row.totalAssessment || 0),
      amountPaid: parseFloat(row.amountpaid || row.amountPaid || 0),
      balance: parseFloat(row.balance || row.amountDue || row.totalassessment || 0),
      status: row.status || 'Unpaid',
      paymentStatus: row.paymentstatus || row.paymentStatus || 'Unpaid',
      quarterlyAmounts: row.quarterly_amounts || row.quarterlyAmounts || {
        q1: (parseFloat(row.totalassessment || 1000) / 4),
        q2: (parseFloat(row.totalassessment || 1000) / 4),
        q3: (parseFloat(row.totalassessment || 1000) / 4),
        q4: (parseFloat(row.totalassessment || 1000) / 4)
      }
    }));

    res.json({
      found: true,
      matchedTdn: matchedRecord.taxdeclarationnumber || matchedRecord.taxDeclarationNumber,
      ownerName: ownerName,
      totalPropertiesCount: associatedProperties.length,
      properties: associatedProperties
    });
  } catch (err) {
    console.error('Error searching RPT by TDN:', err);
    res.status(500).json({ message: 'Database error occurred while searching Tax Declaration.' });
  }
}

export async function getLguRptRecords(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM lgu_rpt_records ORDER BY id ASC');
    res.json(result.rows.map((row: any) => ({
      id: row.id,
      taxDeclarationNumber: row.taxdeclarationnumber || row.taxDeclarationNumber,
      pin: row.pin,
      newPspin: row.new_pspin || row.newPspin,
      ownerName: row.ownername || row.ownerName,
      propertyLocation: row.propertylocation || row.propertyLocation,
      barangay: row.barangay,
      propertyType: row.propertytype || row.propertyType,
      billingYear: row.billingyear || row.billingYear,
      quarter: row.quarter,
      billExpiryDate: row.bill_expiry_date || row.billExpiryDate,
      lotAreaSqM: parseFloat(row.lot_area_sqm || 0),
      marketValue: parseFloat(row.market_value || 0),
      assessedValue: parseFloat(row.assessed_value || 0),
      basicTax: parseFloat(row.basictax || 0),
      sefTax: parseFloat(row.seftax || 0),
      shttcApplied: parseFloat(row.shttc_applied || 0),
      specialLevy: parseFloat(row.speciallevy || 0),
      penalty: parseFloat(row.penalty || 0),
      discount: parseFloat(row.discount || 0),
      totalAssessment: parseFloat(row.totalassessment || 0),
      amountPaid: parseFloat(row.amountpaid || 0),
      balance: parseFloat(row.balance || 0),
      status: row.status || 'Unpaid',
      paymentStatus: row.paymentstatus || row.paymentStatus || 'Unpaid',
      paymentMethod: row.paymentmethod || row.paymentMethod,
      officialReceiptNumber: row.officialreceiptnumber || row.officialReceiptNumber,
      paymentReference: row.paymentreference || row.paymentReference,
      paymentDate: row.paymentdate || row.paymentDate,
      amountDue: parseFloat(row.amountdue || 0),
      quarterlyAmounts: row.quarterly_amounts
    })));
  } catch (err) {
    console.error('Error fetching LGU RPT records:', err);
    res.status(500).json({ message: 'Error loading LGU RPT records' });
  }
}

export async function createLguRptRecord(req: Request, res: Response): Promise<void> {
  const data = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO lgu_rpt_records (
        taxDeclarationNumber, pin, new_pspin, ownerName, propertyLocation, barangay, propertyType,
        billingYear, quarter, bill_expiry_date, lot_area_sqm, market_value, assessed_value,
        basicTax, sefTax, shttc_applied, penalty, discount, totalAssessment, amountPaid, balance,
        status, paymentStatus, amountDue, quarterly_amounts
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb)
      RETURNING *`,
      [
        data.taxDeclarationNumber,
        data.pin || null,
        data.newPspin || null,
        data.ownerName,
        data.propertyLocation || null,
        data.barangay || null,
        data.propertyType || 'Residential',
        data.billingYear || 2025,
        data.quarter || 'Q1-Q4',
        data.billExpiryDate || '2025-10-31',
        data.lotAreaSqM || 0,
        data.marketValue || 0,
        data.assessedValue || 0,
        data.basicTax || 0,
        data.sefTax || 0,
        data.shttcApplied || 0,
        data.penalty || 0,
        data.discount || 0,
        data.totalAssessment || 0,
        data.amountPaid || 0,
        data.balance || data.totalAssessment || 0,
        data.status || 'Unpaid',
        data.paymentStatus || 'Unpaid',
        data.amountDue || data.totalAssessment || 0,
        JSON.stringify(data.quarterlyAmounts || {})
      ]
    );

    await recordAudit(req, 'AUD-RPT-CREATE', 'admin@gov.ph', 'Admin',
      'RPT Module', 'RPT_RECORD_CREATED', 'INFO', null,
      `Created assessment record for TDN: ${data.taxDeclarationNumber}`);

    res.status(201).json({ success: true, message: 'Property assessment created', record: result.rows[0] });
  } catch (err) {
    console.error('Error creating LGU RPT record:', err);
    res.status(500).json({ message: 'Failed to create assessment record.' });
  }
}

export async function updateLguRptRecord(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const data = req.body;

  try {
    const result = await pool.query(
      `UPDATE lgu_rpt_records
       SET ownerName = COALESCE($1, ownerName),
           propertyLocation = COALESCE($2, propertyLocation),
           barangay = COALESCE($3, barangay),
           propertyType = COALESCE($4, propertyType),
           basicTax = COALESCE($5, basicTax),
           sefTax = COALESCE($6, sefTax),
           penalty = COALESCE($7, penalty),
           discount = COALESCE($8, discount),
           totalAssessment = COALESCE($9, totalAssessment),
           balance = COALESCE($10, balance),
           status = COALESCE($11, status),
           paymentStatus = COALESCE($12, paymentStatus)
       WHERE id = $13
       RETURNING *`,
      [
        data.ownerName, data.propertyLocation, data.barangay, data.propertyType,
        data.basicTax, data.sefTax, data.penalty, data.discount,
        data.totalAssessment, data.balance, data.status, data.paymentStatus,
        id
      ]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Record not found' });
      return;
    }

    res.json({ success: true, message: 'Record updated successfully', record: result.rows[0] });
  } catch (err) {
    console.error('Error updating LGU RPT record:', err);
    res.status(500).json({ message: 'Failed to update record' });
  }
}

export async function deleteLguRptRecord(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM lgu_rpt_records WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Record not found' });
      return;
    }
    res.json({ success: true, message: 'Assessment record deleted successfully' });
  } catch (err) {
    console.error('Error deleting LGU RPT record:', err);
    res.status(500).json({ message: 'Failed to delete record' });
  }
}

export async function createRptPayment(req: Request, res: Response): Promise<void> {
  const {
    rptRecordId, taxDeclarationNumber, ownerName,
    amount, paymentMethod, paymentReference, officialReceiptNumber,
    paymentOption, quarterCoverage, paymongoSessionId
  } = req.body as RptPaymentBody & { paymentOption?: string; quarterCoverage?: string; paymongoSessionId?: string };

  try {
    await pool.query(
      `INSERT INTO citizen_rpt_payments
       (rpt_record_id, tax_declaration_number, owner_name, amount, payment_method, payment_reference, official_receipt_number, payment_date, payment_option, quarter_coverage, paymongo_session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10)
       RETURNING *`,
      [
        rptRecordId || null,
        taxDeclarationNumber,
        ownerName,
        amount,
        paymentMethod,
        paymentReference,
        officialReceiptNumber,
        paymentOption || 'Full',
        quarterCoverage || '2025(Q1) - 2025(Q4)',
        paymongoSessionId || null
      ]
    );

    // Update the record's payment status and balance
    if (taxDeclarationNumber) {
      await pool.query(
        `UPDATE lgu_rpt_records
         SET amountPaid = amountPaid + $1,
             balance = GREATEST(0, balance - $1),
             status = CASE WHEN balance - $1 <= 0 THEN 'Paid' ELSE 'Partially Paid' END,
             paymentStatus = CASE WHEN balance - $1 <= 0 THEN 'Paid' ELSE 'Partially Paid' END,
             paymentMethod = $2,
             officialReceiptNumber = $3,
             paymentReference = $4,
             paymentDate = NOW()
         WHERE LOWER(REPLACE(taxDeclarationNumber, ' ', '')) = LOWER(REPLACE($5, ' ', ''))`,
        [amount, paymentMethod, officialReceiptNumber, paymentReference, taxDeclarationNumber]
      );
    }

    await recordAudit(req, 'AUD-RPT-PAY', ownerName, 'Citizen',
      'RPT Module', 'RPT_PAYMENT_PROCESSED', 'INFO', null,
      `Paid ₱${amount} for TDN ${taxDeclarationNumber} via ${paymentMethod} (OR: ${officialReceiptNumber})`);

    res.status(201).json({ success: true, message: 'Payment recorded successfully', officialReceiptNumber, paymentReference });
  } catch (err) {
    console.error('Error processing RPT payment:', err);
    res.status(500).json({ message: 'Payment processing failed' });
  }
}

export async function createGroupRptPayment(req: Request, res: Response): Promise<void> {
  const { items, customerName, customerEmail, paymentMethod, paymongoSessionId } = req.body;
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ message: 'No items provided for group payment.' }); return; }

  const client = await pool.connect();
  const generatedGroupOR = `eOR-QC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const groupPaymentRef = `GRP-PAY-${Date.now().toString().slice(-8)}`;
  try {
    await client.query('BEGIN');
    let totalPaid = 0;
    const processedItems = [];

    for (const item of items) {
      const tdn = String(item.taxDeclarationNumber || '').trim();
      if (!tdn) throw new Error('Each payment item must contain a Tax Declaration Number.');
      const recordResult = await client.query(`SELECT * FROM lgu_rpt_records WHERE LOWER(REPLACE(taxDeclarationNumber, ' ', '')) = LOWER(REPLACE($1, ' ', '')) FOR UPDATE`, [tdn]);
      if (recordResult.rowCount === 0) throw new Error(`RPT record not found for TDN ${tdn}.`);
      const record = recordResult.rows[0];
      const balance = Number(record.balance || record.amountDue || 0);
      const option = String(item.selectedOption || 'Full');
      const coverage = String(item.billCoverage || 'Q1-Q4');
      let itemAmount = Number(item.totalAmount || 0);
      if (!Number.isFinite(itemAmount) || itemAmount <= 0) throw new Error(`Invalid payment amount for TDN ${tdn}.`);

      if (option.toLowerCase().startsWith('quarter')) {
        const q: Record<string, any> = (record.quarterly_amounts && typeof record.quarterly_amounts === 'object') ? record.quarterly_amounts : {};
        const selected: string[] = String(coverage).match(/Q[1-4]/gi) || [];
        if (selected.length) {
          const expected = selected.reduce((sum: number, key: string) => sum + Number(q[key.toLowerCase()] || 0), 0);
          if (expected > 0) itemAmount = expected;
        }
      } else {
        itemAmount = Math.min(itemAmount, balance);
      }
      if (itemAmount <= 0 || itemAmount > balance + 0.01) throw new Error(`Payment amount exceeds the current balance for TDN ${tdn}.`);

      totalPaid += itemAmount;
      const itemOR = `${generatedGroupOR}-${tdn}`;
      const itemRef = `${groupPaymentRef}-${tdn}`;
      await client.query(`INSERT INTO citizen_rpt_payments (rpt_record_id, tax_declaration_number, owner_name, amount, payment_method, payment_reference, official_receipt_number, payment_date, payment_option, quarter_coverage, paymongo_session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10)`, [record.id, tdn, item.ownerName || record.ownername || customerName || 'Property Owner', itemAmount, paymentMethod || 'Online Gateway', itemRef, itemOR, option, coverage, paymongoSessionId || null]);
      const newBalance = Math.max(0, balance - itemAmount);
      await client.query(`UPDATE lgu_rpt_records SET amountPaid = amountPaid + $1, balance = $2, status = CASE WHEN $2 <= 0 THEN 'Paid' ELSE 'Partially Paid' END, paymentStatus = CASE WHEN $2 <= 0 THEN 'Paid' ELSE 'Partially Paid' END, paymentMethod = $3, officialReceiptNumber = $4, paymentReference = $5, paymentDate = NOW() WHERE id = $6`, [itemAmount, newBalance, paymentMethod || 'Online Gateway', itemOR, itemRef, record.id]);
      processedItems.push({ taxDeclarationNumber: tdn, ownerName: item.ownerName || record.ownername || customerName, amount: itemAmount, officialReceiptNumber: itemOR, paymentOption: option });
    }

    await client.query('COMMIT');
    await recordAudit(req, 'AUD-RPT-GROUP-PAY', customerEmail || customerName || 'Citizen', 'Citizen', 'RPT Module', 'RPT_GROUP_PAYMENT_COMPLETED', 'INFO', null, `Settled Group Bill Set (${items.length} TDNs) total ₱${totalPaid.toFixed(2)} via ${paymentMethod} (eOR: ${generatedGroupOR})`);
    res.status(201).json({ success: true, message: 'Group bill payment processed successfully.', groupOfficialReceipt: generatedGroupOR, groupReferenceNumber: groupPaymentRef, totalAmount: totalPaid, items: processedItems, paymentDate: new Date().toISOString() });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error processing group RPT payment:', err);
    res.status(400).json({ message: err.message || 'Failed to complete group payment.' });
  } finally { client.release(); }
}

export async function getRptPayments(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM citizen_rpt_payments ORDER BY payment_date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching RPT payments:', err);
    res.status(500).json({ message: 'Error loading payments' });
  }
}
