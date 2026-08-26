// src/controllers/rpt.controller.ts
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import type { RptPaymentBody } from '../types/index.js';

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
  const appData = req.body as Record<string, string>;
  const files = (req as Request & { files?: Express.Multer.File[] }).files;
  const filePaths: string[] = files ? (files as Express.Multer.File[]).map((f) => `/uploads/${f.filename}`) : [];

  let resolvedApplicantName =
    appData.applicantName || appData.name || appData.ownerName || appData.fullName;

  if (!resolvedApplicantName && (appData.firstName || appData.lastName)) {
    resolvedApplicantName = `${appData.firstName || ''} ${appData.lastName || ''}`.trim();
  }
  if (!resolvedApplicantName) {
    resolvedApplicantName = appData.email ? appData.email.split('@')[0] : 'Unknown Applicant';
  }

  try {
    const result = await pool.query(
      `INSERT INTO rpt_applications
       (id, control_number, reference_number, email, mobile_number, service, filed_date, status, penalty,
        applicant_name, pin, tax_declaration_number, property_location, assigned_officer, payment_status, documents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        appData.id || randomUUID(),
        appData.controlNumber || null,
        appData.referenceNumber || null,
        appData.email || null,
        appData.mobileNumber || null,
        appData.service || null,
        appData.filedDate || new Date().toISOString().split('T')[0],
        appData.status || 'Pending',
        appData.penalty || 0,
        resolvedApplicantName,
        appData.pin || null,
        appData.taxDeclarationNumber || null,
        appData.propertyLocation || null,
        appData.assignedOfficer || null,
        appData.paymentStatus || 'Pending',
        filePaths,
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

export async function getLguRptRecords(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM lgu_rpt_records ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching LGU RPT records:', err);
    res.status(500).json({ message: 'Error loading LGU RPT records' });
  }
}

export async function createRptPayment(req: Request, res: Response): Promise<void> {
  const {
    rptRecordId, taxDeclarationNumber, ownerName,
    amount, paymentMethod, paymentReference, officialReceiptNumber,
  } = req.body as RptPaymentBody;

  try {
    await pool.query(
      `INSERT INTO citizen_rpt_payments
       (rpt_record_id, tax_declaration_number, owner_name, amount, payment_method, payment_reference, official_receipt_number, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       RETURNING *`,
      [rptRecordId, taxDeclarationNumber, ownerName, amount, paymentMethod, paymentReference, officialReceiptNumber]
    );
    res.status(201).json({ success: true, message: 'Payment recorded successfully' });
  } catch (err) {
    console.error('Error processing RPT payment:', err);
    res.status(500).json({ message: 'Payment processing failed' });
  }
}
