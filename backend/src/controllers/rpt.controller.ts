import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import type { RptPaymentBody } from '../types/index.js';

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

    if (isStaff || !authenticatedUser || !email) {
      const result = await pool.query(
        `SELECT *
         FROM rpt_applications
         ORDER BY created_at DESC`
      );

      res.json(result.rows);
      return;
    }

    if (email) {
      const result = await pool.query(
        `SELECT *
         FROM rpt_applications
         WHERE LOWER(TRIM(email)) = $1
         ORDER BY created_at DESC`,
        [email]
      );

      res.json(result.rows);
      return;
    }

    const fallbackResult = await pool.query(
      `SELECT *
       FROM rpt_applications
       ORDER BY created_at DESC`
    );
    res.json(fallbackResult.rows);
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
    paymentDueDate
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

  try {
    const result = await pool.query(
      `UPDATE rpt_applications
       SET
         status = COALESCE($1, status),
         notes = COALESCE($2, notes),
         assigned_officer = COALESCE($3, assigned_officer),
         payment_amount = COALESCE($4, payment_amount),
         payment_status = COALESCE($5, payment_status),
         payment_due_date = COALESCE($6, payment_due_date)
       WHERE id = $7
       RETURNING *`,
      [
        status,
        notes,
        assignedOfficer,
        numericPaymentAmount,
        paymentStatus,
        paymentDueDate || null,
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
  const rawTdn = String(
    req.query.tdn ||
    req.params.tdn ||
    ''
  ).trim();

  if (!rawTdn) {
    res.status(400).json({
      message:
        'Please provide a Tax Declaration Number.'
    });
    return;
  }

  try {
    const directResult = await pool.query(
      `SELECT *
       FROM lgu_rpt_records
       WHERE LOWER(
         REPLACE(taxDeclarationNumber, ' ', '')
       )
       =
       LOWER(
         REPLACE($1, ' ', '')
       )
       LIMIT 1`,
      [rawTdn]
    );

    if (directResult.rowCount === 0) {
      res.status(404).json({
        found: false,
        message:
          `Tax Declaration Number "${rawTdn}" was not found in the city assessment records.`
      });
      return;
    }

    const matchedRecord =
      directResult.rows[0];

    const ownerName =
      matchedRecord.ownername ||
      matchedRecord.ownerName;

    const associatedResult = await pool.query(
      `SELECT *
       FROM lgu_rpt_records
       WHERE
       (
         LOWER(TRIM(ownerName))
         =
         LOWER(TRIM($1))
       )
       OR
       (
         pin IS NOT NULL
         AND SUBSTRING(pin FROM 1 FOR 10)
             =
             SUBSTRING($2 FROM 1 FOR 10)
       )
       ORDER BY taxDeclarationNumber`,
      [
        ownerName || '',
        matchedRecord.pin || ''
      ]
    );

    const rows =
      associatedResult.rows.length > 0
        ? associatedResult.rows
        : [matchedRecord];

    const properties = rows.map(
      (row: any) => ({
        id: row.id,
        taxDeclarationNumber:
          row.taxDeclarationNumber,
        pin: row.pin,
        newPspin: row.new_pspin,
        ownerName:
          row.ownerName ||
          row.ownername,
        propertyLocation:
          row.propertyLocation,
        barangay:
          row.barangay,
        propertyType:
          row.propertyType,
        billingYear:
          Number(row.billingYear) || 2025,
        quarter:
          row.quarter,
        billExpiryDate:
          row.bill_expiry_date,
        lotAreaSqM:
          Number(row.lot_area_sqm) || 0,
        marketValue:
          Number(row.market_value) || 0,
        assessedValue:
          Number(row.assessed_value) || 0,
        basicTax:
          Number(row.basicTax) || 0,
        sefTax:
          Number(row.sefTax) || 0,
        shttcApplied:
          Number(row.shttc_applied) || 0,
        penalty:
          Number(row.penalty) || 0,
        discount:
          Number(row.discount) || 0,
        totalAssessment:
          Number(row.totalAssessment) || 0,
        amountPaid:
          Number(row.amountPaid) || 0,
        balance:
          Number(row.balance) || 0,
        amountDue:
          Number(row.amountDue) ||
          Number(row.balance) ||
          0,
        status:
          row.status || 'Unpaid',
        paymentStatus:
          row.paymentStatus ||
          'Unpaid',
        paymentMethod:
          row.paymentMethod || null,
        officialReceiptNumber:
          row.officialReceiptNumber ||
          null,
        paymentReference:
          row.paymentReference ||
          null,
        paymentDate:
          row.paymentDate ||
          null,
        quarterlyAmounts:
          row.quarterly_amounts || {}
      })
    );

    res.json({
      found: true,
      ownerName:
        ownerName || 'Property Owner',
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

  try {
    const result = await pool.query(
      `INSERT INTO lgu_rpt_records (
        taxDeclarationNumber,
        pin,
        new_pspin,
        ownerName,
        propertyLocation,
        barangay,
        propertyType,
        billingYear,
        quarter,
        bill_expiry_date,
        lot_area_sqm,
        market_value,
        assessed_value,
        basicTax,
        sefTax,
        shttc_applied,
        penalty,
        discount,
        totalAssessment,
        amountPaid,
        balance,
        status,
        paymentStatus,
        amountDue,
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
        $24,
        $25::jsonb
      )
      RETURNING *`,
      [
        data.taxDeclarationNumber,
        data.pin || null,
        data.newPspin || null,
        data.ownerName,
        data.propertyLocation || null,
        data.barangay || null,
        data.propertyType ||
        'Residential',
        data.billingYear || 2025,
        data.quarter || 'Q1-Q4',
        data.billExpiryDate ||
        '2025-10-31',
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
        data.balance ||
        data.totalAssessment ||
        0,
        data.status || 'Unpaid',
        data.paymentStatus ||
        'Unpaid',
        data.amountDue ||
        data.totalAssessment ||
        0,
        JSON.stringify(
          data.quarterlyAmounts || {}
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
      `Created assessment record for TDN: ${data.taxDeclarationNumber}`
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
        'Failed to create assessment record.'
    });
  }
}

export async function updateLguRptRecord(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const data = req.body;

  try {
    const result = await pool.query(
      `UPDATE lgu_rpt_records
       SET
         ownerName = COALESCE($1, ownerName),
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
        data.ownerName,
        data.propertyLocation,
        data.barangay,
        data.propertyType,
        data.basicTax,
        data.sefTax,
        data.penalty,
        data.discount,
        data.totalAssessment,
        data.balance,
        data.status,
        data.paymentStatus,
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
        'Failed to update record'
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
    await pool.query(
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
        amount,
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
      await pool.query(
        `UPDATE lgu_rpt_records
         SET
           amountPaid =
             amountPaid + $1,

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

           paymentStatus =
             CASE
               WHEN balance - $1 <= 0
                 THEN 'Paid'
               ELSE 'Partially Paid'
             END,

           paymentMethod = $2,
           officialReceiptNumber = $3,
           paymentReference = $4,
           paymentDate = NOW()

         WHERE LOWER(
           REPLACE(
             taxDeclarationNumber,
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
          amount,
          paymentMethod,
          officialReceiptNumber,
          paymentReference,
          taxDeclarationNumber
        ]
      );
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
    let totalPaid = 0;

    const processedItems: Array<{
      taxDeclarationNumber: string;
      ownerName: string;
      amount: number;
      officialReceiptNumber: string;
      paymentOption?: string;
    }> = [];

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

      await pool.query(
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

      await pool.query(
        `UPDATE lgu_rpt_records
         SET
           amountPaid =
             amountPaid + $1,

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

           paymentStatus =
             CASE
               WHEN balance - $1 <= 0
                 THEN 'Paid'
               ELSE 'Partially Paid'
             END,

           paymentMethod = $2,
           officialReceiptNumber = $3,
           paymentReference = $4,
           paymentDate = NOW()

         WHERE LOWER(
           REPLACE(
             taxDeclarationNumber,
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