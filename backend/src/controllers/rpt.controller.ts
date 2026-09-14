import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import type { RptPaymentBody } from '../types/index.js';

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || '';

async function verifyPaymongoSession(
  sessionId: string | null | undefined
): Promise<{ paid: boolean; amount: number | null; rawStatus: string | null }> {
  if (!sessionId) {
    return { paid: false, amount: null, rawStatus: null };
  }

  if (!PAYMONGO_SECRET_KEY) {
    console.error(
      'PAYMONGO_SECRET_KEY is not configured — refusing to trust client-supplied payment status.'
    );
    return { paid: false, amount: null, rawStatus: null };
  }

  try {
    const authHeader =
      'Basic ' + Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64');

    const response = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${sessionId}`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(
        `PayMongo verification failed (HTTP ${response.status}) for session ${sessionId}`
      );
      return { paid: false, amount: null, rawStatus: null };
    }

    const body = await response.json() as {
      data?: {
        attributes?: {
          payment_intent?: {
            attributes?: {
              status?: string;
              amount?: number;
            };
          };
          payments?: Array<{
            attributes?: { status?: string; amount?: number };
          }>;
        };
      };
    };

    const attrs = body?.data?.attributes;
    const intentStatus = attrs?.payment_intent?.attributes?.status;
    const intentAmount = attrs?.payment_intent?.attributes?.amount;

    if (intentStatus === 'succeeded' && typeof intentAmount === 'number') {
      return {
        paid: true,
        amount: intentAmount / 100,
        rawStatus: intentStatus
      };
    }

    const paidPayment = (attrs?.payments || []).find(
      (p) => p?.attributes?.status === 'paid'
    );

    if (paidPayment && typeof paidPayment.attributes?.amount === 'number') {
      return {
        paid: true,
        amount: paidPayment.attributes.amount / 100,
        rawStatus: 'paid'
      };
    }

    return {
      paid: false,
      amount: null,
      rawStatus: intentStatus || 'unknown'
    };
  } catch (err) {
    console.error('Error verifying PayMongo session:', sessionId, err);
    return { paid: false, amount: null, rawStatus: null };
  }
}

export async function getRptApplications(req: Request, res: Response): Promise<void> {
  try {
    const authenticatedUser = (req as Request & {
      user?: {
        id?: number | string;
        email?: string;
        role?: string;
      };
    }).user;

    const role = String(
      authenticatedUser?.role || ''
    ).trim().toLowerCase();

    const email = String(
      authenticatedUser?.email || ''
    ).trim().toLowerCase();

    const isStaff = ['admin', 'treasury-staff'].includes(role);

    if (!authenticatedUser || !email) {
      res.status(401).json({
        message: 'Authentication required to access RPT applications.'
      });
      return;
    }

    if (isStaff) {
      const result = await pool.query(
        `SELECT *
         FROM rpt_applications
         ORDER BY created_at DESC`
      );

      res.json(result.rows);
      return;
    }

    const result = await pool.query(
      `SELECT *
       FROM rpt_applications
       WHERE LOWER(TRIM(email)) = $1
       ORDER BY created_at DESC`,
      [email]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching RPT applications:', err);
    res.status(500).json({
      message: 'Error loading RPT applications'
    });
  }
}

export async function createRptApplication(
  req: Request,
  res: Response
): Promise<void> {
  const appData = req.body as Record<string, any>;

  const files = (
    req as Request & {
      files?: Express.Multer.File[];
    }
  ).files;

  const authenticatedUser = (
    req as Request & {
      user?: {
        id?: number | string;
        email?: string;
        role?: string;
      };
    }
  ).user;

  const authenticatedEmail = String(
    authenticatedUser?.email || ''
  ).trim().toLowerCase();

  const authenticatedRole = String(
    authenticatedUser?.role || ''
  ).trim().toLowerCase();

  const isStaff = ['admin', 'treasury-staff'].includes(
    authenticatedRole
  );

  const applicationEmail = isStaff
    ? (appData.email || authenticatedEmail || null)
    : (authenticatedEmail || appData.email || null);

  let fileObjects: Array<{
    name: string;
    url: string;
  }> = [];

  if (files && files.length > 0) {
    fileObjects = files.map((f: any) => ({
      name: f.originalname || f.filename,
      url: f.buffer
        ? `data:${f.mimetype};base64,${f.buffer.toString('base64')}`
        : `/uploads/${f.filename}`
    }));
  }

  if (fileObjects.length === 0 && appData.documents) {
    try {
      const parsed =
        typeof appData.documents === 'string'
          ? JSON.parse(appData.documents)
          : appData.documents;

      if (Array.isArray(parsed)) {
        fileObjects = parsed.map((item: any) => {
          if (
            typeof item === 'object' &&
            item !== null
          ) {
            return {
              name: item.name || 'Document',
              url: item.url || ''
            };
          }

          const itemStr =
            typeof item === 'string'
              ? item
              : JSON.stringify(item);

          const cleanPath = itemStr
            .replace(/["'{}]/g, '')
            .trim();

          const parts = cleanPath.split(': ');

          const fileName =
            parts.length > 1
              ? parts[1].trim()
              : cleanPath;

          const pathOnly =
            fileName.startsWith('data:') ||
              fileName.startsWith('http') ||
              fileName.startsWith('/uploads/')
              ? fileName
              : `/uploads/${fileName}`;

          return {
            name:
              fileName.split('/').pop() ||
              fileName,
            url: pathOnly
          };
        });
      }
    } catch {
      const cleanStr = String(appData.documents)
        .replace(/["'{}]/g, '')
        .trim();

      const parts = cleanStr.split(': ');

      const fileName =
        parts.length > 1
          ? parts[1].trim()
          : cleanStr;

      const pathOnly =
        fileName.startsWith('data:') ||
          fileName.startsWith('http') ||
          fileName.startsWith('/uploads/')
          ? fileName
          : `/uploads/${fileName}`;

      fileObjects = [
        {
          name:
            fileName.split('/').pop() ||
            fileName,
          url: pathOnly
        }
      ];
    }
  }

  const ownerName =
    appData.owner_name ||
    appData.ownerName ||
    '';

  const resolvedApplicantName =
    appData.applicant_name ||
    appData.applicantName ||
    ownerName ||
    'Unknown Applicant';

  try {
    const result = await pool.query(
      `INSERT INTO rpt_applications
       (
         id,
         control_number,
         tax_declaration_number,
         owner_name,
         applicant_name,
         applicant_type,
         email,
         mobile_number,
         service,
         property_location,
         barangay,
         property_type,
         status,
         filed_date,
         notes,
         documents
       )
       VALUES
       (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12,
         $13,
         $14,
         $15,
         $16::jsonb
       )
       RETURNING *`,
      [
        appData.id || randomUUID(),
        appData.control_number || null,
        appData.tax_declaration_number || null,
        ownerName,
        resolvedApplicantName,
        appData.applicant_type || null,
        applicationEmail,
        appData.mobile_number || null,
        appData.service || null,
        appData.property_location || null,
        appData.barangay || null,
        appData.property_type || null,
        appData.status || 'Submitted',
        appData.filed_date ||
        new Date()
          .toISOString()
          .split('T')[0],
        appData.notes || null,
        JSON.stringify(fileObjects)
      ]
    );

    await recordAudit(
      req,
      'AUD-RPT-SUBMIT',
      applicationEmail || 'citizen@gov.ph',
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
    console.error(
      'Error saving RPT application:',
      err
    );

    res.status(500).json({
      message:
        'Failed to save RPT application to database.'
    });
  }
}

export async function deleteRptApplication(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  const authenticatedUser = (
    req as Request & { user?: { email?: string; } }
  ).user;
  const authenticatedEmail = String(
    authenticatedUser?.email || ''
  ).trim().toLowerCase();

  try {
    const result = await pool.query(
      `DELETE FROM rpt_applications
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        message: 'RPT application not found'
      });
      return;
    }

    await recordAudit(
      req,
      'AUD-RPT-DELETE',
      authenticatedEmail || 'admin@gov.ph',
      'Admin',
      'RPT Module',
      'RPT_APPLICATION_DELETED',
      'WARNING',
      null,
      `Deleted RPT application ID: ${id}`
    );

    res.json({
      success: true,
      message:
        'RPT application deleted successfully'
    });
  } catch (err) {
    console.error(
      'Error deleting RPT application:',
      err
    );

    res.status(500).json({
      message:
        'Failed to delete RPT application from database.'
    });
  }
}

export async function updateRptApplicationStatus(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  const authenticatedUser = (
    req as Request & { user?: { email?: string; } }
  ).user;
  const authenticatedEmail = String(
    authenticatedUser?.email || ''
  ).trim().toLowerCase();

  const {
    status,
    notes,
    assignedOfficer,
    paymentAmount,
    paymentStatus,
    paymentDueDate,
    officialReceiptNumber,
    paymentMethod,
    paymentReference,
    paymentDate
  } = req.body;

  const numericPaymentAmount =
    paymentAmount === undefined ||
      paymentAmount === null ||
      paymentAmount === ''
      ? null
      : Number(paymentAmount);

  if (
    numericPaymentAmount !== null &&
    (
      !Number.isFinite(numericPaymentAmount) ||
      numericPaymentAmount < 0
    )
  ) {
    res.status(400).json({
      message:
        'Payment amount must be a valid non-negative number.'
    });
    return;
  }

  const finalStatus =
    status ||
    ((paymentStatus === 'Paid' || paymentStatus === 'Settled')
      ? 'Payment Completed'
      : undefined);

  try {
    const result = await pool.query(
      `UPDATE rpt_applications
       SET
         status = COALESCE($1, status),
         notes = COALESCE($2, notes),
         assigned_officer = COALESCE($3, assigned_officer),
         payment_amount = COALESCE($4, payment_amount),
         payment_status = COALESCE($5, payment_status),
         payment_due_date = COALESCE($6, payment_due_date),
         official_receipt_number = COALESCE($7, official_receipt_number),
         payment_method = COALESCE($8, payment_method),
         payment_reference = COALESCE($9, payment_reference),
         payment_date = CASE 
           WHEN $5 IN ('Paid', 'Settled') THEN COALESCE($10, payment_date, NOW())
           ELSE payment_date
         END
       WHERE id = $11
       RETURNING *`,
      [
        finalStatus,
        notes,
        assignedOfficer,
        numericPaymentAmount,
        paymentStatus,
        paymentDueDate || null,
        officialReceiptNumber || null,
        paymentMethod || null,
        paymentReference || null,
        paymentDate || null,
        id
      ]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        message: 'RPT application not found'
      });
      return;
    }

    await recordAudit(
      req,
      'AUD-RPT-STATUS',
      authenticatedEmail || 'admin@gov.ph',
      'Admin',
      'RPT Module',
      'RPT_STATUS_UPDATED',
      'INFO',
      null,
      `Updated RPT application ${id} status to ${status}`
    );

    res.json({
      success: true,
      message: 'Status updated successfully',
      record: result.rows[0]
    });
  } catch (err) {
    console.error(
      'Error updating RPT application status:',
      err
    );

    res.status(500).json({
      message: 'Failed to update status'
    });
  }
}

export async function searchRptByTdn(
  req: Request,
  res: Response
): Promise<void> {
  const rawQuery = String(
    req.query.tdn ||
    req.query.query ||
    req.query.q ||
    req.query.search ||
    req.query.owner ||
    req.params.tdn ||
    ''
  ).trim();

  try {
    let rows: any[] = [];
    let matchedOwner = 'Property Owner';

    // This is a public, unauthenticated lookup endpoint — it must always be
    // scoped to a specific TDN/owner/PIN search term. An empty query or the
    // literal value "ALL" must never fall through to returning every record
    // in lgu_rpt_records; that would expose every citizen's property and
    // assessment data to anyone who hits this endpoint.
    if (!rawQuery || rawQuery.toUpperCase() === 'ALL') {
      res.status(400).json({
        found: false,
        properties: [],
        message: 'Please provide a specific Tax Declaration Number, PIN, or owner name to search.'
      });
      return;
    }

    {
      const searchPattern = `%${rawQuery}%`;
      const searchResult = await pool.query(
        `SELECT *
         FROM lgu_rpt_records
         WHERE
           LOWER(REPLACE(COALESCE(tax_declaration_number, taxdeclarationnumber, ''), ' ', '')) LIKE LOWER(REPLACE($1, ' ', ''))
           OR LOWER(COALESCE(owner_name, ownername, '')) LIKE LOWER($2)
           OR LOWER(COALESCE(pin, '')) LIKE LOWER($2)
           OR LOWER(COALESCE(new_pspin, newpspin, '')) LIKE LOWER($2)
           OR LOWER(COALESCE(property_location, propertylocation, '')) LIKE LOWER($2)
           OR LOWER(COALESCE(barangay, '')) LIKE LOWER($2)
         ORDER BY id ASC`,
        [searchPattern, searchPattern]
      );

      if (searchResult.rowCount === 0) {
        res.status(404).json({
          found: false,
          properties: [],
          message: `No assessment records found matching "${rawQuery}".`
        });
        return;
      }

      rows = searchResult.rows;
      const firstRow = rows[0];
      matchedOwner = firstRow.owner_name || firstRow.ownername || 'Property Owner';

      // Also get all properties by the same owner if found
      if (matchedOwner && matchedOwner !== 'Property Owner') {
        const ownerRecords = await pool.query(
          `SELECT * FROM lgu_rpt_records WHERE LOWER(TRIM(COALESCE(owner_name, ownername, ''))) = LOWER(TRIM($1)) ORDER BY id ASC`,
          [matchedOwner]
        );
        if (ownerRecords.rows.length > rows.length) {
          rows = ownerRecords.rows;
        }
      }
    }

    const properties = rows.map(
      (row: any) => ({
        id: row.id,
        taxDeclarationNumber:
          row.taxdeclarationnumber ||
          row.tax_declaration_number ||
          row.taxDeclarationNumber,
        pin: row.pin,
        newPspin: row.new_pspin || row.newpspin || row.newPspin,
        ownerName:
          row.ownername ||
          row.owner_name ||
          row.ownerName,
        propertyLocation:
          row.propertylocation ||
          row.property_location ||
          row.propertyLocation,
        barangay:
          row.barangay,
        propertyType:
          row.propertytype ||
          row.property_type ||
          row.propertyType,
        billingYear:
          Number(row.billingyear || row.billing_year || row.billingYear) || 2025,
        quarter:
          row.quarter,
        billExpiryDate:
          row.bill_expiry_date ||
          row.billexpirydate ||
          row.billExpiryDate,
        lotAreaSqM:
          Number(row.lot_area_sqm || row.lotareasqm || row.lotAreaSqM) || 0,
        marketValue:
          Number(row.market_value || row.marketvalue || row.marketValue) || 0,
        assessedValue:
          Number(row.assessed_value || row.assessedvalue || row.assessedValue) || 0,
        basicTax:
          Number(row.basictax || row.basic_tax || row.basicTax) || 0,
        sefTax:
          Number(row.seftax || row.sef_tax || row.sefTax) || 0,
        shttcApplied:
          Number(row.shttc_applied || row.shttcapplied || row.shttcApplied) || 0,
        penalty:
          Number(row.penalty) || 0,
        discount:
          Number(row.discount) || 0,
        totalAssessment:
          Number(row.totalassessment || row.total_assessment || row.totalAssessment) || 0,
        amountPaid:
          Number(row.amountpaid || row.amount_paid || row.amountPaid) || 0,
        balance:
          Number(row.balance) || 0,
        amountDue:
          Number(row.amountdue || row.amount_due || row.balance || row.totalassessment || row.total_assessment || row.totalAssessment) || 0,
        status:
          row.status || 'Active',
        paymentStatus:
          row.paymentstatus ||
          row.payment_status ||
          row.paymentStatus ||
          'Unpaid',
        paymentMethod:
          row.paymentmethod ||
          row.payment_method ||
          row.paymentMethod || null,
        officialReceiptNumber:
          row.officialreceiptnumber ||
          row.official_receipt_number ||
          row.officialReceiptNumber ||
          null,
        paymentReference:
          row.paymentreference ||
          row.payment_reference ||
          row.paymentReference ||
          null,
        paymentDate:
          row.paymentdate ||
          row.payment_date ||
          row.paymentDate ||
          null,
        quarterlyAmounts:
          row.quarterly_amounts || row.quarterlyamounts || {}
      })
    );

    res.json({
      found: true,
      ownerName:
        matchedOwner || 'Property Owner',
      properties
    });
  } catch (err) {
    console.error(
      'Error searching RPT by TDN:',
      err
    );

    res.status(500).json({
      message:
        'Failed to search RPT records.'
    });
  }
}

export async function getLguRptRecords(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT *
       FROM lgu_rpt_records
       ORDER BY id ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(
      'Error fetching LGU RPT records:',
      err
    );

    res.status(500).json({
      message:
        'Failed to load RPT assessment records.'
    });
  }
}

export async function createLguRptRecord(
  req: Request,
  res: Response
): Promise<void> {
  const data = req.body;

  const authenticatedUser = (
    req as Request & { user?: { email?: string; } }
  ).user;
  const authenticatedEmail = String(
    authenticatedUser?.email || ''
  ).trim().toLowerCase();

  const tdn = data.tax_declaration_number || data.taxDeclarationNumber;
  if (!tdn) {
    res.status(400).json({ message: 'Tax declaration number is required' });
    return;
  }

  let resolvedPaymentStatus = String(data.payment_status || data.paymentStatus || 'Unpaid').trim();
  if (resolvedPaymentStatus === 'Payment Completed' || resolvedPaymentStatus === 'Settled') {
    resolvedPaymentStatus = 'Paid';
  } else if (resolvedPaymentStatus === 'Pending') {
    resolvedPaymentStatus = 'Pending Payment';
  } else if (!['Unpaid', 'Pending Payment', 'Partially Paid', 'Paid'].includes(resolvedPaymentStatus)) {
    resolvedPaymentStatus = 'Unpaid';
  }

  try {
    const result = await pool.query(
      `INSERT INTO lgu_rpt_records (
        tax_declaration_number,
        pin,
        new_pspin,
        owner_name,
        property_location,
        barangay,
        property_type,
        billing_year,
        quarter,
        bill_expiry_date,
        lot_area_sqm,
        market_value,
        assessed_value,
        basic_tax,
        sef_tax,
        shttc_applied,
        penalty,
        discount,
        total_assessment,
        amount_paid,
        balance,
        status,
        payment_status,
        quarterly_amounts
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24::jsonb
      )
      RETURNING *`,
      [
        tdn,
        data.pin || null,
        data.newPspin || data.new_pspin || null,
        data.ownerName || data.owner_name || 'Taxpayer',
        data.propertyLocation || data.property_location || data.location || 'N/A',
        data.barangay || 'Central',
        data.propertyType || data.property_type || 'Residential',
        data.billingYear || data.billing_year || 2025,
        data.quarter || 'Q1-Q4',
        data.billExpiryDate || data.bill_expiry_date || '2025-10-31',
        data.lotAreaSqM || data.lotAreaSqm || data.lot_area_sqm || 0,
        data.marketValue || data.market_value || 0,
        data.assessedValue || data.assessed_value || 0,
        data.basicTax || data.basic_tax || 0,
        data.sefTax || data.sef_tax || 0,
        data.shttcApplied || data.shttc_applied || 0,
        data.penalty || 0,
        data.discount || 0,
        data.totalAssessment || data.total_assessment || 0,
        data.amountPaid || data.amount_paid || 0,
        data.balance !== undefined ? data.balance : (data.totalAssessment || data.total_assessment || 0),
        data.status || 'Active',
        resolvedPaymentStatus,
        JSON.stringify(
          data.quarterlyAmounts || data.quarterly_amounts || {}
        )
      ]
    );

    await recordAudit(
      req,
      'AUD-RPT-CREATE',
      authenticatedEmail || 'admin@gov.ph',
      'Admin',
      'RPT Module',
      'RPT_RECORD_CREATED',
      'INFO',
      null,
      `Created assessment record for TDN: ${tdn}`
    );

    res.status(201).json({
      success: true,
      message:
        'Property assessment created',
      record: result.rows[0]
    });
  } catch (err) {
    console.error(
      'Error creating LGU RPT record:',
      err
    );

    res.status(500).json({
      message:
        `Failed to create assessment record: ${(err as any)?.message || 'Unknown database error'}`
    });
  }
}

export async function updateLguRptRecord(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const data = req.body;

  const rawPaymentStatus = data.payment_status || data.paymentStatus;
  const isPaid = rawPaymentStatus === 'Paid' || rawPaymentStatus === 'Settled' || rawPaymentStatus === 'Payment Completed';
  const computedBalance = isPaid && data.balance === undefined ? 0 : data.balance;
  const computedStatus = isPaid && !data.status ? 'Paid' : data.status;

  let resolvedPaymentStatus: string | null = null;
  if (rawPaymentStatus) {
    if (isPaid) resolvedPaymentStatus = 'Paid';
    else if (rawPaymentStatus === 'Pending') resolvedPaymentStatus = 'Pending Payment';
    else if (['Unpaid', 'Pending Payment', 'Partially Paid', 'Paid'].includes(rawPaymentStatus)) {
      resolvedPaymentStatus = rawPaymentStatus;
    } else {
      resolvedPaymentStatus = 'Unpaid';
    }
  }

  try {
    const result = await pool.query(
      `UPDATE lgu_rpt_records
       SET
         owner_name = COALESCE($1, owner_name),
         property_location = COALESCE($2, property_location),
         barangay = COALESCE($3, barangay),
         property_type = COALESCE($4, property_type),
         market_value = COALESCE($5, market_value),
         assessed_value = COALESCE($6, assessed_value),
         lot_area_sqm = COALESCE($7, lot_area_sqm),
         basic_tax = COALESCE($8, basic_tax),
         sef_tax = COALESCE($9, sef_tax),
         penalty = COALESCE($10, penalty),
         discount = COALESCE($11, discount),
         total_assessment = COALESCE($12, total_assessment),
         balance = COALESCE($13, balance),
         status = COALESCE($14, status),
         payment_status = COALESCE($15, payment_status),
         amount_paid = CASE
           WHEN $15::text IN ('Paid', 'Settled') AND $16::numeric IS NULL THEN COALESCE(total_assessment, 0)
           ELSE COALESCE($16, amount_paid)
         END,
         official_receipt_number = COALESCE($17, official_receipt_number),
         payment_method = COALESCE($18, payment_method),
         payment_date = CASE
           WHEN $15::text IN ('Paid', 'Settled') THEN COALESCE($19, payment_date, NOW())
           ELSE payment_date
         END,
         quarterly_amounts = COALESCE($20::jsonb, quarterly_amounts)
       WHERE id = $21
       RETURNING *`,
      [
        data.ownerName || data.owner_name || null,
        data.propertyLocation || data.property_location || data.location || null,
        data.barangay || null,
        data.propertyType || data.property_type || null,
        data.marketValue !== undefined ? data.marketValue : (data.market_value !== undefined ? data.market_value : null),
        data.assessedValue !== undefined ? data.assessedValue : (data.assessed_value !== undefined ? data.assessed_value : null),
        data.lotAreaSqM !== undefined ? data.lotAreaSqM : (data.lotAreaSqm !== undefined ? data.lotAreaSqm : (data.lot_area_sqm !== undefined ? data.lot_area_sqm : null)),
        data.basicTax !== undefined ? data.basicTax : (data.basic_tax !== undefined ? data.basic_tax : null),
        data.sefTax !== undefined ? data.sefTax : (data.sef_tax !== undefined ? data.sef_tax : null),
        data.penalty !== undefined ? data.penalty : null,
        data.discount !== undefined ? data.discount : null,
        data.totalAssessment !== undefined ? data.totalAssessment : (data.total_assessment !== undefined ? data.total_assessment : null),
        computedBalance !== undefined ? computedBalance : null,
        computedStatus || null,
        resolvedPaymentStatus,
        data.amountPaid !== undefined ? data.amountPaid : (data.amount_paid !== undefined ? data.amount_paid : null),
        data.officialReceiptNumber || data.official_receipt_number || null,
        data.paymentMethod || data.payment_method || null,
        data.paymentDate || data.payment_date || null,
        data.quarterlyAmounts || data.quarterly_amounts ? JSON.stringify(data.quarterlyAmounts || data.quarterly_amounts) : null,
        id
      ]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        message: 'Record not found'
      });
      return;
    }

    res.json({
      success: true,
      message:
        'Record updated successfully',
      record: result.rows[0]
    });
  } catch (err) {
    console.error(
      'Error updating LGU RPT record:',
      err
    );

    res.status(500).json({
      message:
        `Failed to update record: ${(err as any)?.message || 'Unknown database error'}`
    });
  }
}

export async function deleteLguRptRecord(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM lgu_rpt_records
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        message: 'Record not found'
      });
      return;
    }

    res.json({
      success: true,
      message:
        'Assessment record deleted successfully'
    });
  } catch (err) {
    console.error(
      'Error deleting LGU RPT record:',
      err
    );

    res.status(500).json({
      message:
        'Failed to delete record'
    });
  }
}

export async function createRptPayment(
  req: Request,
  res: Response
): Promise<void> {
  const {
    rptRecordId,
    taxDeclarationNumber,
    ownerName,
    amount,
    paymentMethod,
    paymentReference,
    officialReceiptNumber,
    paymentOption,
    quarterCoverage,
    paymongoSessionId
  } = req.body as RptPaymentBody & {
    paymentOption?: string;
    quarterCoverage?: string;
    paymongoSessionId?: string;
  };

  try {
    const verification = await verifyPaymongoSession(paymongoSessionId);

    if (!verification.paid) {
      res.status(402).json({
        success: false,
        message:
          'Payment could not be verified with PayMongo. No payment was recorded.'
      });
      return;
    }

    const verifiedAmount = verification.amount as number;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO citizen_rpt_payments
         (
           rpt_record_id,
           tax_declaration_number,
           owner_name,
           amount,
           payment_method,
           payment_reference,
           official_receipt_number,
           payment_date,
           payment_option,
           quarter_coverage,
           paymongo_session_id
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           NOW(),
           $8,
           $9,
           $10
         )
         RETURNING *`,
        [
          rptRecordId || null,
          taxDeclarationNumber,
          ownerName,
          verifiedAmount,
          paymentMethod,
          paymentReference,
          officialReceiptNumber,
          paymentOption || 'Full',
          quarterCoverage ||
          '2025(Q1) - 2025(Q4)',
          paymongoSessionId || null
        ]
      );

      if (taxDeclarationNumber) {
        await client.query(
          `UPDATE lgu_rpt_records
           SET
             amount_paid =
               amount_paid + $1,

             balance =
               GREATEST(
                 0,
                 balance - $1
               ),

             status =
               CASE
                 WHEN balance - $1 <= 0
                   THEN 'Paid'
                 ELSE 'Partially Paid'
               END,

             payment_status =
               CASE
                 WHEN balance - $1 <= 0
                   THEN 'Paid'
                 ELSE 'Partially Paid'
               END,

             payment_method = $2,
             official_receipt_number = $3,
             payment_reference = $4,
             payment_date = NOW()

           WHERE LOWER(
             REPLACE(
               tax_declaration_number,
               ' ',
               ''
             )
           )
           =
           LOWER(
             REPLACE(
               $5,
               ' ',
               ''
             )
           )`,
          [
            verifiedAmount,
            paymentMethod,
            officialReceiptNumber,
            paymentReference,
            taxDeclarationNumber
          ]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await recordAudit(
      req,
      'AUD-RPT-PAY',
      ownerName,
      'Citizen',
      'RPT Module',
      'RPT_PAYMENT_PROCESSED',
      'INFO',
      null,
      `Paid ${amount} for TDN ${taxDeclarationNumber} via ${paymentMethod} (OR: ${officialReceiptNumber})`
    );

    res.status(201).json({
      success: true,
      message:
        'Payment recorded successfully',
      officialReceiptNumber,
      paymentReference
    });
  } catch (err) {
    console.error(
      'Error processing RPT payment:',
      err
    );

    res.status(500).json({
      message:
        'Payment processing failed'
    });
  }
}

export async function createGroupRptPayment(
  req: Request,
  res: Response
): Promise<void> {
  const {
    items,
    customerName,
    customerEmail,
    paymentMethod,
    paymongoSessionId
  } = req.body;

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    res.status(400).json({
      message:
        'No items provided for group payment.'
    });
    return;
  }

  const generatedGroupOR =
    `eOR-QC-${new Date().getFullYear()}-${Math.floor(
      100000 + Math.random() * 900000
    )}`;

  const groupPaymentRef =
    `GRP-PAY-${Date.now()
      .toString()
      .slice(-8)}`;

  try {
    const verification = await verifyPaymongoSession(paymongoSessionId);

    if (!verification.paid) {
      res.status(402).json({
        success: false,
        message:
          'Payment could not be verified with PayMongo. No payment was recorded.'
      });
      return;
    }

    const claimedTotal = items.reduce(
      (sum: number, item: any) =>
        sum + parseFloat(item.totalAmount || item.amount || 0),
      0
    );

    const verifiedTotal = verification.amount as number;
    if (Math.abs(claimedTotal - verifiedTotal) > 1) {
      console.error(
        `Group payment mismatch: claimed ${claimedTotal} vs PayMongo-verified ${verifiedTotal} (session ${paymongoSessionId})`
      );
      res.status(402).json({
        success: false,
        message:
          'Payment amount could not be reconciled with PayMongo. No payment was recorded.'
      });
      return;
    }

    let totalPaid = 0;

    const processedItems: Array<{
      taxDeclarationNumber: string;
      ownerName: string;
      amount: number;
      officialReceiptNumber: string;
      paymentOption?: string;
    }> = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of items) {
        const itemAmount = parseFloat(
          item.totalAmount ||
          item.amount ||
          0
        );

        totalPaid += itemAmount;

        const itemOR =
          `${generatedGroupOR}-${item.taxDeclarationNumber}`;

        const itemRef =
          `${groupPaymentRef}-${item.taxDeclarationNumber}`;

        await client.query(
          `INSERT INTO citizen_rpt_payments
           (
             rpt_record_id,
             tax_declaration_number,
             owner_name,
             amount,
             payment_method,
             payment_reference,
             official_receipt_number,
             payment_date,
             payment_option,
             quarter_coverage,
             paymongo_session_id
           )
           VALUES (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7,
             NOW(),
             $8,
             $9,
             $10
           )`,
          [
            item.id || null,
            item.taxDeclarationNumber,
            item.ownerName ||
            customerName ||
            'Property Owner',
            itemAmount,
            paymentMethod ||
            'Online Gateway',
            itemRef,
            itemOR,
            item.selectedOption ||
            'Full Payment',
            item.billCoverage ||
            '2025(Q1) - 2025(Q4)',
            paymongoSessionId ||
            null
          ]
        );

        await client.query(
          `UPDATE lgu_rpt_records
           SET
             amount_paid =
               amount_paid + $1,

             balance =
               GREATEST(
                 0,
                 balance - $1
               ),

             status =
               CASE
                 WHEN balance - $1 <= 0
                   THEN 'Paid'
                 ELSE 'Partially Paid'
               END,

             payment_status =
               CASE
                 WHEN balance - $1 <= 0
                   THEN 'Paid'
                 ELSE 'Partially Paid'
               END,

             payment_method = $2,
             official_receipt_number = $3,
             payment_reference = $4,
             payment_date = NOW()

           WHERE LOWER(
             REPLACE(
               tax_declaration_number,
               ' ',
               ''
             )
           )
           =
           LOWER(
             REPLACE(
               $5,
               ' ',
               ''
             )
           )`,
          [
            itemAmount,
            paymentMethod,
            itemOR,
            itemRef,
            item.taxDeclarationNumber
          ]
        );

        processedItems.push({
          taxDeclarationNumber:
            item.taxDeclarationNumber,
          ownerName:
            item.ownerName,
          amount: itemAmount,
          officialReceiptNumber:
            itemOR,
          paymentOption:
            item.selectedOption
        });
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await recordAudit(
      req,
      'AUD-RPT-GROUP-PAY',
      customerEmail ||
      customerName ||
      'Citizen',
      'Citizen',
      'RPT Module',
      'RPT_GROUP_PAYMENT_COMPLETED',
      'INFO',
      null,
      `Settled Group Bill Set (${items.length} TDNs) total ${totalPaid} via ${paymentMethod} (eOR: ${generatedGroupOR})`
    );

    res.status(201).json({
      success: true,
      message:
        'Group bill payment processed successfully.',
      groupOfficialReceipt:
        generatedGroupOR,
      groupReferenceNumber:
        groupPaymentRef,
      totalAmount:
        totalPaid,
      items:
        processedItems,
      paymentDate:
        new Date().toISOString()
    });
  } catch (err) {
    console.error(
      'Error processing group RPT payment:',
      err
    );

    res.status(500).json({
      message:
        'Failed to complete group payment.'
    });
  }
}

export async function getRptPayments(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT *
       FROM citizen_rpt_payments
       ORDER BY payment_date DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(
      'Error fetching RPT payments:',
      err
    );

    res.status(500).json({
      message: 'Error loading payments'
    });
  }
}