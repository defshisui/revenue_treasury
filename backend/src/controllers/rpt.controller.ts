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
        appData.service || null,
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