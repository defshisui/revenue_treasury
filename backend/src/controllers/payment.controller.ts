import type { Request, Response } from 'express';
import pool from '../db.js';
import { PayMongoService } from '../services/paymongo.service.js';
import { recordAudit } from './audit.controller.js';
import { EmailService } from '../services/email.service.js';


function sanitizeMetadata(raw: Record<string, unknown>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') {
      console.warn(`[PayMongo] Dropping/flattening non-scalar metadata field "${key}":`, value);
      clean[key] = JSON.stringify(value).slice(0, 500);
      continue;
    }
    clean[key] = String(value);
  }
  return clean;
}
async function sendPaymentReceiptOnce(params: {
  paymentKey: string;
  toEmail?: string | null;
  customerName?: string | null;
  service: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  officialReceiptNumber: string;
  paymentDate?: Date | string;
  accountReference?: string | null;
}): Promise<void> {
  const email = String(params.toEmail || '').trim();
  if (!email || !email.includes('@')) {
    console.warn(
      `[ReceiptEmail] No valid citizen email for payment ${params.paymentKey}; receipt email was not sent.`
    );
    return;
  }

  try {
    const claim = await pool.query(
      `INSERT INTO payment_email_notifications
         (payment_key, email, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (payment_key)
       DO UPDATE SET
         email = EXCLUDED.email,
         status = CASE
           WHEN payment_email_notifications.status = 'sent'
             THEN payment_email_notifications.status
           ELSE 'pending'
         END,
         updated_at = NOW()
       WHERE payment_email_notifications.status <> 'sent'
       RETURNING payment_key`,
      [params.paymentKey, email]
    );

    if (claim.rows.length === 0) {
      console.log(`[ReceiptEmail] Receipt already sent for ${params.paymentKey}.`);
      return;
    }

    const result = await EmailService.sendPaymentReceiptEmail({
      toEmail: email,
      customerName: params.customerName || 'Citizen Taxpayer',
      service: params.service,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      officialReceiptNumber: params.officialReceiptNumber,
      paymentDate: params.paymentDate,
      accountReference: params.accountReference || undefined,
    });

    await pool.query(
      `UPDATE payment_email_notifications
       SET status = 'sent',
           message_id = $2,
           sent_at = NOW(),
           updated_at = NOW()
       WHERE payment_key = $1`,
      [params.paymentKey, result.messageId || null]
    );

    console.log(`[ReceiptEmail] Official receipt ${params.officialReceiptNumber} sent to ${email}.`);
  } catch (error: any) {
    await pool.query(
      `UPDATE payment_email_notifications
       SET status = 'failed',
           error_message = $2,
           updated_at = NOW()
       WHERE payment_key = $1`,
      [params.paymentKey, String(error?.message || error).slice(0, 1000)]
    ).catch(() => undefined);

    // Do not make an already-paid transaction fail just because email delivery failed.
    console.error(
      `[ReceiptEmail] Failed to send receipt for ${params.paymentKey}:`,
      error?.message || error
    );
  }
}


function makeOfficialReceiptNumber(): string {
  return `OR-PM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function finalizeBusinessTaxPayment(params: {
  trackingNumber: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  paymongoPaymentId?: string | null;
  paymongoSessionId?: string | null;
}): Promise<{ ok: boolean; status: number; error?: string; record?: any; alreadyRecorded?: boolean }> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT *
       FROM business_assessments
       WHERE tracking_number = $1 OR id::text = $1
       LIMIT 1
       FOR UPDATE`,
      [params.trackingNumber]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'Business Tax assessment record not found.' };
    }

    const record = result.rows[0];
    const paymentStatus = String(record.payment_status || 'UNPAID').toUpperCase();
    let assessedAmount = Number(record.payment_amount || 0);
    if ((!Number.isFinite(assessedAmount) || assessedAmount <= 0) && record.computed_fees) {
      try {
        const legacyFees = typeof record.computed_fees === 'object' ? record.computed_fees : JSON.parse(String(record.computed_fees));
        assessedAmount = Number(legacyFees?.total || 0);
      } catch {
        assessedAmount = 0;
      }
    }

    if (paymentStatus === 'PAID') {
      await client.query('COMMIT');
      return { ok: true, status: 200, alreadyRecorded: true, record };
    }

    if (String(record.status || '').toUpperCase() !== 'APPROVED' && String(record.status || '').toUpperCase() !== 'FOR_OWNER_PAYMENT') {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'This Business Tax assessment is not approved for payment yet.' };
    }

    if (!Number.isFinite(assessedAmount) || assessedAmount <= 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'The approved Business Tax assessment has no valid amount due.' };
    }

    if (!Number.isFinite(params.amount) || Math.abs(params.amount - assessedAmount) > 0.01) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        status: 409,
        error: `Payment amount does not match the approved Business Tax amount due (₱${assessedAmount.toFixed(2)}).`,
      };
    }

    const officialReceiptNumber = String(record.official_receipt_number || makeOfficialReceiptNumber());

    const updated = await client.query(
      `UPDATE business_assessments
       SET payment_status = 'PAID',
           status = 'OR_ISSUED',
           paid_amount = $1,
           payment_method = $2,
           payment_reference = $3,
           payment_date = NOW(),
           official_receipt_number = $4,
           paymongo_payment_id = $5,
           paymongo_session_id = $6,
           remarks = COALESCE(NULLIF($7, ''), remarks),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        params.amount,
        params.paymentMethod,
        params.paymentReference,
        officialReceiptNumber,
        params.paymongoPaymentId || null,
        params.paymongoSessionId || null,
        `Payment verified via ${params.paymentMethod}. O.R.: ${officialReceiptNumber}`,
        record.id,
      ]
    );

    await client.query('COMMIT');
    return { ok: true, status: 200, alreadyRecorded: false, record: updated.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getPayMongoStatus(_req: Request, res: Response): Promise<void> {
  try {
    const connection = await PayMongoService.testConnection();
    const publicKey = PayMongoService.getPublicKey();
    const hasSecretKey = Boolean(PayMongoService.getSecretKey());
    const hasWebhookSecret = Boolean(PayMongoService.getWebhookSecret());

    res.json({
      success: true,
      configured: connection.configured,
      valid: connection.valid,
      environment: connection.environment,
      message: connection.message,
      keys: {
        hasSecretKey,
        publicKey: publicKey ? `${publicKey.slice(0, 10)}...` : 'Not Set',
        hasWebhookSecret,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Error checking PayMongo status',
    });
  }
}

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  const {
    type,
    amount,
    taxDeclarationNumber,
    rptRecordId,
    leaseId,
    businessTrackingNumber,
    rptApplicationId,
    rptService,
    customerName,
    customerEmail,
    customerPhone,
    description,
    frontendRedirectUrl,
  } = req.body;

  if (type !== 'RPT_SERVICE' && (!amount || Number(amount) <= 0)) {
    res.status(400).json({ error: 'A valid payment amount is required.' });
    return;
  }

  let numericAmount = Number(amount);

  if (type === 'BUSINESS_TAX') {
    if (!businessTrackingNumber) {
      res.status(400).json({ error: 'businessTrackingNumber is required for Business Tax payments.' });
      return;
    }

    const businessResult = await pool.query(
      `SELECT tracking_number, business_name, business_owner, email, status, payment_status, payment_amount, computed_fees
       FROM business_assessments
       WHERE tracking_number = $1 OR id::text = $1
       LIMIT 1`,
      [businessTrackingNumber]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ error: 'Business Tax assessment not found.' });
      return;
    }

    const business = businessResult.rows[0];
    let approvedAmount = Number(business.payment_amount || 0);
    if ((!Number.isFinite(approvedAmount) || approvedAmount <= 0) && business.computed_fees) {
      try {
        const legacyFees = typeof business.computed_fees === 'object' ? business.computed_fees : JSON.parse(String(business.computed_fees));
        approvedAmount = Number(legacyFees?.total || 0);
      } catch {
        approvedAmount = 0;
      }
    }

    // Accept FOR_OWNER_PAYMENT (canonical) or legacy APPROVED status.
    const bizStatus = String(business.status || '').toUpperCase();
    if (bizStatus !== 'APPROVED' && bizStatus !== 'FOR_OWNER_PAYMENT') {
      res.status(409).json({ error: 'This Business Tax assessment is not approved for payment yet.' });
      return;
    }

    if (String(business.payment_status || '').toUpperCase() === 'PAID') {
      res.status(409).json({ error: 'This Business Tax assessment has already been paid.' });
      return;
    }

    if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      res.status(409).json({ error: 'The approved Business Tax assessment has no valid amount due.' });
      return;
    }

    if (Math.abs(numericAmount - approvedAmount) > 0.01) {
      res.status(409).json({ error: `Payment amount does not match the approved amount due (₱${approvedAmount.toFixed(2)}).` });
      return;
    }

    numericAmount = approvedAmount;
  }

  if (type === 'RPT_SERVICE') {
    if (!rptApplicationId) {
      res.status(400).json({ error: 'rptApplicationId is required for RPT service payments.' });
      return;
    }

    const applicationResult = await pool.query(
      `SELECT id, service, payment_amount, payment_status, status, email, applicant_name, owner_name, control_number, tax_declaration_number
       FROM rpt_applications
       WHERE id = $1`,
      [rptApplicationId]
    );

    if (applicationResult.rows.length === 0) {
      res.status(404).json({ error: 'RPT service application not found.' });
      return;
    }

    const application = applicationResult.rows[0];
    const assessedAmount = Number(application.payment_amount || 0);

    if (!Number.isFinite(assessedAmount) || assessedAmount <= 0) {
      res.status(400).json({ error: 'The City Assessor has not posted an assessed service fee yet.' });
      return;
    }

    if (String(application.payment_status || '').toLowerCase() === 'paid') {
      res.status(409).json({ error: 'This RPT service application has already been paid.' });
      return;
    }

    numericAmount = assessedAmount;
  }
  const frontendOrigin =
    frontendRedirectUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  const cleanFrontendOrigin = String(frontendOrigin).replace(/\/+$/, '');

  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);

  let referenceNumber = `PAY-${dateCode}-${randomSuffix}`;
  let paymentDescription = description || `Municipal Payment - ${numericAmount.toFixed(2)}`;
  let successRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=success&session_id={CHECKOUT_SESSION_ID}`;
  let cancelRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=cancelled`;

  if (type === 'RPT') {
    referenceNumber = `RPT-${taxDeclarationNumber || dateCode}-${randomSuffix}`;
    paymentDescription = `Real Property Tax Payment for TD# ${taxDeclarationNumber || 'Record'}`;
    successRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=success&session_id={CHECKOUT_SESSION_ID}&type=RPT`;
    cancelRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=cancelled&type=RPT`;
  } else if (type === 'MARKET_STALL') {
    referenceNumber = `MKT-${leaseId || dateCode}-${randomSuffix}`;
    paymentDescription = `Market Stall Lease Payment (${leaseId || 'Stall'})`;
    successRedirectUrl = `${cleanFrontendOrigin}/Market-Vendor?payment=success&session_id={CHECKOUT_SESSION_ID}&type=MARKET`;
    cancelRedirectUrl = `${cleanFrontendOrigin}/Market-Vendor?payment=cancelled&type=MARKET`;
  } else if (type === 'BUSINESS_TAX') {
    referenceNumber = `BIZ-${businessTrackingNumber || dateCode}-${randomSuffix}`;
    paymentDescription = `Business Tax Assessment Payment (${businessTrackingNumber || 'Mayor Permit'})`;
    successRedirectUrl = `${cleanFrontendOrigin}/business-tax-assessment?payment=success&session_id={CHECKOUT_SESSION_ID}&type=BUSINESS`;
    cancelRedirectUrl = `${cleanFrontendOrigin}/business-tax-assessment?payment=cancelled&type=BUSINESS`;
  }
  else if (type === 'RPT_SERVICE') {
    referenceNumber = `RPT-SVC-${rptApplicationId || dateCode}-${randomSuffix}`;
    paymentDescription = `${rptService || 'RPT Service'} Payment`;
    successRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=success&session_id={CHECKOUT_SESSION_ID}&type=RPT_SERVICE`;
    cancelRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=cancelled&type=RPT_SERVICE`;
  }

  try {
    const session = await PayMongoService.createCheckoutSession({
      amount: numericAmount,
      description: paymentDescription,
      referenceNumber,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      successUrl: successRedirectUrl,
      cancelUrl: cancelRedirectUrl,
      metadata: sanitizeMetadata({
        type: type || 'GENERAL',
        rptRecordId,
        taxDeclarationNumber,
        leaseId,
        businessTrackingNumber,
        rptApplicationId,
        rptService: rptService || null,
        customerName,
        customerEmail,
      }),
    });

    await recordAudit(
      req,
      'AUD-PAYMONGO-CHECKOUT',
      customerEmail || 'citizen@gov.ph',
      'Citizen',
      'ePayment Gateway',
      'PAYMONGO_CHECKOUT_CREATED',
      'INFO',
      null,
      `Created PayMongo checkout session ${session.id} for ${referenceNumber} (${numericAmount.toFixed(2)})`
    );

    res.status(200).json({
      success: true,
      checkoutUrl: session.checkoutUrl,
      sessionId: session.id,
      referenceNumber,
      environment: PayMongoService.getEnvironment(),
    });
  } catch (err: any) {
    console.error('Error in createCheckoutSession:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to initiate PayMongo checkout session.',
    });
  }
}

export async function verifySession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required for verification.' });
    return;
  }

  try {
    const session = await PayMongoService.retrieveCheckoutSession(sessionId);

    if (!session.paid) {
      res.status(200).json({
        success: false,
        paid: false,
        status: session.status,
        message: 'Checkout session is not yet paid or is still pending.',
      });
      return;
    }

    const metadata = session.metadata || {};
    const type = metadata.type || 'RPT';
    const paymentItem = session.payments?.[0];
    const sourceMethod = paymentItem?.attributes?.source?.type || 'PayMongo ePayment';
    const formattedPaymentMethod = sourceMethod.toUpperCase();

    const paymentReference = session.referenceNumber || `REF-${sessionId.slice(-8)}`;
    const officialReceiptNumber = `OR-PM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    let recordResult: any = null;


    if (type === 'RPT_SERVICE' && metadata.rptApplicationId) {
      const applicationResult = await pool.query(
        `SELECT * FROM rpt_applications WHERE id = $1`,
        [metadata.rptApplicationId]
      );

      if (applicationResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          paid: false,
          error: 'RPT service application not found.',
        });
        return;
      }

      const application = applicationResult.rows[0];
      const assessedAmount = Number(application.payment_amount || 0);

      if (!Number.isFinite(assessedAmount) || assessedAmount <= 0) {
        res.status(409).json({
          success: false,
          paid: false,
          error: 'No assessed RPT service fee exists for this application.',
        });
        return;
      }

      if (Math.abs(Number(session.amount) - assessedAmount) > 0.01) {
        res.status(409).json({
          success: false,
          paid: false,
          error: 'Payment amount does not match the assessed RPT service fee.',
        });
        return;
      }

      if (String(application.payment_status || '').toLowerCase() === 'paid') {
        res.status(200).json({
          success: true,
          paid: true,
          alreadyRecorded: true,
          officialReceiptNumber: application.official_receipt_number,
          paymentReference: application.payment_reference,
          amount: application.payment_amount,
          paymentMethod: application.payment_method,
          paymentDate: application.payment_date,
          service: application.service,
          applicationId: application.id,
        });
        return;
      }

      await pool.query(
        `UPDATE rpt_applications
         SET status = 'Payment Completed',
             payment_status = 'Paid',
             payment_reference = $1,
             official_receipt_number = $2,
             payment_method = $3,
             payment_date = NOW()
         WHERE id = $4`,
        [
          paymentReference,
          officialReceiptNumber,
          `PayMongo (${formattedPaymentMethod})`,
          metadata.rptApplicationId,
        ]
      );

      recordResult = await pool.query(
        `SELECT * FROM rpt_applications WHERE id = $1`,
        [metadata.rptApplicationId]
      );

      await recordAudit(
        req,
        'AUD-PAYMONGO-RPT-SERVICE',
        metadata.customerEmail || application.email || 'citizen@gov.ph',
        'Citizen',
        'RPT Module',
        'RPT_SERVICE_PAYMENT_VERIFIED',
        'INFO',
        null,
        `RPT service payment confirmed for ${application.service || metadata.rptService || 'RPT Service'}. Application ${metadata.rptApplicationId}. Reference ${paymentReference}. Amount ${assessedAmount.toFixed(2)}. O.R. ${officialReceiptNumber}.`
      );

      await sendPaymentReceiptOnce({
        paymentKey: `checkout:${sessionId}`,
        toEmail: metadata.customerEmail || application.email,
        customerName: metadata.customerName || application.applicant_name || application.owner_name,
        service: application.service || metadata.rptService || 'RPT Service',
        amount: assessedAmount,
        paymentMethod: `PayMongo (${formattedPaymentMethod})`,
        paymentReference,
        officialReceiptNumber,
        paymentDate: new Date(),
        accountReference: application.control_number || application.tax_declaration_number,
      });

      res.status(200).json({
        success: true,
        paid: true,
        alreadyRecorded: false,
        officialReceiptNumber,
        paymentReference,
        amount: assessedAmount,
        paymentMethod: `PayMongo (${formattedPaymentMethod})`,
        paymentDate: new Date().toISOString(),
        service: application.service || metadata.rptService,
        applicationId: application.id,
        controlNumber: application.control_number,
        record: recordResult.rows[0],
      });
      return;
    }

    if (type === 'RPT' && metadata.taxDeclarationNumber) {
      const existingPayment = await pool.query(
        'SELECT * FROM citizen_rpt_payments WHERE paymongo_session_id = $1 OR payment_reference = $2',
        [sessionId, paymentReference]
      );

      if (existingPayment.rows.length > 0) {
        res.status(200).json({
          success: true,
          paid: true,
          alreadyRecorded: true,
          officialReceiptNumber: existingPayment.rows[0].official_receipt_number,
          paymentReference: existingPayment.rows[0].payment_reference,
          amount: session.amount,
          paymentMethod: existingPayment.rows[0].payment_method,
          paymentDate: existingPayment.rows[0].payment_date,
        });
        return;
      }

      await pool.query(
        `UPDATE lgu_rpt_records
         SET balance = 0,
             amount_paid = total_assessment,
             status = 'Paid',
             payment_status = 'Paid',
             payment_method = $1,
             official_receipt_number = $2,
             payment_reference = $3,
             payment_date = NOW()
         WHERE tax_declaration_number ILIKE $4`,
        [formattedPaymentMethod, officialReceiptNumber, paymentReference, metadata.taxDeclarationNumber]
      );

      recordResult = await pool.query(
        `INSERT INTO citizen_rpt_payments
         (rpt_record_id, tax_declaration_number, owner_name, amount, payment_method, payment_reference, official_receipt_number, paymongo_session_id, payment_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [
          metadata.rptRecordId || null,
          metadata.taxDeclarationNumber,
          metadata.customerName || 'Taxpayer Owner',
          session.amount,
          `PayMongo (${formattedPaymentMethod})`,
          paymentReference,
          officialReceiptNumber,
          sessionId,
        ]
      );

      await sendPaymentReceiptOnce({
        paymentKey: `checkout:${sessionId}`,
        toEmail: metadata.customerEmail,
        customerName: metadata.customerName,
        service: 'Real Property Tax',
        amount: Number(session.amount),
        paymentMethod: `PayMongo (${formattedPaymentMethod})`,
        paymentReference,
        officialReceiptNumber,
        paymentDate: new Date(),
        accountReference: metadata.taxDeclarationNumber,
      });
    } else if (
      (type === 'MARKET_STALL' || type === 'MARKET') &&
      metadata.leaseId
    ) {
      // Retrieve the lease first so we never overwrite an existing
      // official receipt with a newly generated number.
      const existingLeaseResult = await pool.query(
        `SELECT *
         FROM market_leases
         WHERE lease_id = $1 OR id::text = $1
         LIMIT 1`,
        [metadata.leaseId]
      );

      if (existingLeaseResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          paid: false,
          error: `Market lease ${metadata.leaseId} was not found.`,
        });
        return;
      }

      const existingLease = existingLeaseResult.rows[0];
      const existingPaymentStatus = String(
        existingLease.payment_status || ''
      ).toLowerCase();

      // If the webhook already recorded the payment, return the
      // database values instead of creating another O.R.
      if (existingPaymentStatus === 'paid') {
        const existingOfficialReceiptNumber =
          existingLease.official_receipt_number ||
          officialReceiptNumber;

        const existingPaymentReference =
          existingLease.payment_reference ||
          paymentReference;

        recordResult = existingLeaseResult;

        res.status(200).json({
          success: true,
          paid: true,
          alreadyRecorded: true,
          officialReceiptNumber: existingOfficialReceiptNumber,
          paymentReference: existingPaymentReference,
          amount: session.amount,
          paymentMethod:
            existingLease.payment_method ||
            `PayMongo (${formattedPaymentMethod})`,
          paymentDate:
            existingLease.payment_date ||
            new Date().toISOString(),
          record: existingLease,
        });
        return;
      }

      const marketOfficialReceiptNumber =
        existingLease.official_receipt_number ||
        officialReceiptNumber;

      const marketPaymentReference =
        existingLease.payment_reference ||
        paymentReference;

      const leaseResult = await pool.query(
        `UPDATE market_leases
         SET payment_status = 'Paid',
             advance_payment_status = 'Paid',
             payment_method = $1,
             official_receipt_number = $2,
             payment_reference = $3,
             payment_date = NOW()
         WHERE lease_id = $4 OR id::text = $4
         RETURNING *`,
        [
          `PayMongo (${formattedPaymentMethod})`,
          marketOfficialReceiptNumber,
          marketPaymentReference,
          metadata.leaseId,
        ]
      );

      if (leaseResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          paid: false,
          error: `Market lease ${metadata.leaseId} could not be updated.`,
        });
        return;
      }

      recordResult = leaseResult;

      await sendPaymentReceiptOnce({
        paymentKey: `checkout:${sessionId}`,
        toEmail: metadata.customerEmail || leaseResult.rows[0]?.email,
        customerName:
          metadata.customerName ||
          `${leaseResult.rows[0]?.first_name || ''} ${leaseResult.rows[0]?.last_name || ''}`.trim(),
        service: 'Market Stall Rental',
        amount: Number(session.amount),
        paymentMethod: `PayMongo (${formattedPaymentMethod})`,
        paymentReference: marketPaymentReference,
        officialReceiptNumber: marketOfficialReceiptNumber,
        paymentDate: new Date(),
        accountReference: metadata.leaseId,
      });

      // Return the same O.R. and database record to the frontend so
      // Verify & Match Payment can display the actual saved values.
      res.status(200).json({
        success: true,
        paid: true,
        alreadyRecorded: false,
        officialReceiptNumber: marketOfficialReceiptNumber,
        paymentReference: marketPaymentReference,
        amount: session.amount,
        paymentMethod: `PayMongo (${formattedPaymentMethod})`,
        paymentDate: leaseResult.rows[0].payment_date || new Date().toISOString(),
        record: leaseResult.rows[0],
      });
      return;
    } else if (type === 'BUSINESS_TAX' && metadata.businessTrackingNumber) {
      const finalized = await finalizeBusinessTaxPayment({
        trackingNumber: String(metadata.businessTrackingNumber),
        amount: Number(session.amount),
        paymentMethod: `PayMongo (${formattedPaymentMethod})`,
        paymentReference,
        paymongoSessionId: sessionId,
      });

      if (!finalized.ok) {
        res.status(finalized.status).json({ success: false, paid: false, error: finalized.error });
        return;
      }

      const businessRecord = finalized.record;
      const businessOfficialReceiptNumber = String(
        businessRecord?.official_receipt_number ||
        officialReceiptNumber
      );
      const businessPaymentReference = String(
        businessRecord?.payment_reference ||
        paymentReference
      );

      await sendPaymentReceiptOnce({
        paymentKey: `checkout:${sessionId}`,
        toEmail: metadata.customerEmail || businessRecord?.email,
        customerName: metadata.customerName || businessRecord?.business_owner,
        service: 'Business Tax and Regulatory Fee',
        amount: Number(session.amount),
        paymentMethod: businessRecord?.payment_method || `PayMongo (${formattedPaymentMethod})`,
        paymentReference: businessPaymentReference,
        officialReceiptNumber: businessOfficialReceiptNumber,
        paymentDate: businessRecord?.payment_date || new Date(),
        accountReference: metadata.businessTrackingNumber,
      });

      await recordAudit(
        req,
        'AUD-PAYMONGO-BUSINESS',
        metadata.customerEmail || businessRecord?.email || 'citizen@gov.ph',
        'Citizen',
        'Business Tax Module',
        'BUSINESS_TAX_PAYMENT_VERIFIED',
        'INFO',
        null,
        `Business Tax payment confirmed. Tracking #${metadata.businessTrackingNumber}. Reference ${businessPaymentReference}. Amount ${Number(session.amount).toFixed(2)}. O.R. ${businessOfficialReceiptNumber}.`
      );

      res.status(200).json({
        success: true,
        paid: true,
        alreadyRecorded: Boolean(finalized.alreadyRecorded),
        officialReceiptNumber: businessOfficialReceiptNumber,
        paymentReference: businessPaymentReference,
        amount: Number(session.amount),
        paymentMethod: businessRecord?.payment_method || `PayMongo (${formattedPaymentMethod})`,
        paymentDate: businessRecord?.payment_date || new Date().toISOString(),
        businessTrackingNumber: metadata.businessTrackingNumber,
        record: businessRecord,
      });
      return;
    }

    await recordAudit(
      req,
      'AUD-PAYMONGO-VERIFY',
      metadata.customerEmail || 'citizen@gov.ph',
      'Citizen',
      'ePayment Gateway',
      'PAYMENT_VERIFIED_SUCCESS',
      'INFO',
      null,
      `Verified PayMongo payment session ${sessionId}. Issued O.R. ${officialReceiptNumber} for ${session.amount.toFixed(2)}`
    );

    res.status(200).json({
      success: true,
      paid: true,
      alreadyRecorded: false,
      officialReceiptNumber,
      paymentReference,
      amount: session.amount,
      paymentMethod: `PayMongo (${formattedPaymentMethod})`,
      paymentDate: new Date().toISOString(),
      record: recordResult ? recordResult.rows[0] : null,
    });
  } catch (err: any) {
    console.error('Error in verifySession:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Error verifying PayMongo checkout session.',
    });
  }
}

export async function handlePayMongoWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const signatureHeader =
    (req.headers['paymongo-signature'] as string) || '';

  const rawBody =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);


  if (PayMongoService.getWebhookSecret()) {
    const isValid = PayMongoService.verifyWebhookSignature(
      rawBody,
      signatureHeader
    );

    if (!isValid) {
      console.warn(
        ' Rejected PayMongo webhook with invalid signature.'
      );

      res.status(401).json({
        error: 'Invalid PayMongo webhook signature',
      });

      return;
    }
  }

  try {
    const event =
      typeof req.body === 'object'
        ? req.body
        : JSON.parse(rawBody);

    const eventAttributes = event.data?.attributes;
    const eventType = eventAttributes?.type;
    const eventData = eventAttributes?.data;

    console.log(` PayMongo Webhook received: ${eventType}`);


    if (eventType !== 'payment.paid') {
      console.log(` Ignoring PayMongo event: ${eventType}`);

      res.status(200).json({
        received: true,
        ignored: true,
        event: eventType,
      });

      return;
    }

    const paymentAttributes = eventData?.attributes || {};
    const paymentId = eventData?.id;


    const paymentIntentId =
      paymentAttributes.payment_intent_id;

    const paymentStatus = paymentAttributes.status;

    const amountCentavos =
      Number(paymentAttributes.amount || 0);

    const amountPhp = amountCentavos / 100;

    const sourceType =
      paymentAttributes.source?.type || 'unknown';

    console.log(' Payment paid:', {
      paymentId,
      paymentIntentId,
      paymentStatus,
      amountPhp,
      sourceType,
    });

    if (paymentStatus !== 'paid') {
      res.status(200).json({
        received: true,
        ignored: true,
        reason: 'Payment status is not paid',
      });

      return;
    }

    if (!paymentIntentId) {
      console.error(
        ' payment.paid event does not contain payment_intent_id.'
      );

      res.status(400).json({
        error: 'payment_intent_id is missing from PayMongo event',
      });

      return;
    }


    const secretKey = PayMongoService.getSecretKey();

    if (!secretKey) {
      throw new Error(
        'PAYMONGO_SECRET_KEY is not configured.'
      );
    }

    const intentResponse = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${secretKey}:`
          ).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const intentData = await intentResponse.json();

    if (!intentResponse.ok) {
      console.error(
        ' Failed to retrieve PayMongo Payment Intent:',
        intentData
      );

      res.status(500).json({
        error: 'Failed to retrieve PayMongo Payment Intent',
      });

      return;
    }

    const intentAttributes =
      intentData.data?.attributes || {};

    const intentStatus = intentAttributes.status;

    const metadata =
      intentAttributes.metadata || {};

    console.log(' Payment Intent metadata:', {
      paymentIntentId,
      intentStatus,
      metadata,
    });


    if (intentStatus !== 'succeeded') {
      console.warn(
        ` Payment Intent ${paymentIntentId} is not succeeded. Current status: ${intentStatus}`
      );

      res.status(200).json({
        received: true,
        ignored: true,
        reason: 'Payment Intent is not succeeded',
        status: intentStatus,
      });

      return;
    }

    const paymentReference =
      metadata.referenceNumber ||
      paymentAttributes.external_reference_number ||
      `REF-${paymentIntentId.slice(-8)}`;

    const officialReceiptNumber =
      `OR-PM-${new Date().getFullYear()}-${Math.floor(
        100000 + Math.random() * 900000
      )}`;

    const formattedPaymentMethod =
      sourceType === 'qrph'
        ? 'PayMongo (QR Ph)'
        : `PayMongo (${String(sourceType).toUpperCase()})`;


    if (metadata.type === 'RPT_SERVICE' && metadata.rptApplicationId) {
      const applicationResult = await pool.query(
        `SELECT * FROM rpt_applications WHERE id = $1`,
        [metadata.rptApplicationId]
      );

      if (applicationResult.rows.length === 0) {
        console.warn(
          `No RPT service application found for ${metadata.rptApplicationId}`
        );
        res.status(200).json({
          received: true,
          success: false,
          reason: 'RPT service application not found',
        });
        return;
      }

      const application = applicationResult.rows[0];
      const assessedAmount = Number(application.payment_amount || 0);

      if (!Number.isFinite(assessedAmount) || assessedAmount <= 0) {
        console.warn(
          `RPT service application ${metadata.rptApplicationId} has no assessed fee.`
        );
        res.status(200).json({
          received: true,
          success: false,
          reason: 'No assessed RPT service fee',
        });
        return;
      }

      if (Math.abs(amountPhp - assessedAmount) > 0.01) {
        console.error(
          `RPT service payment amount mismatch. Expected ${assessedAmount}, received ${amountPhp}.`
        );
        res.status(200).json({
          received: true,
          success: false,
          reason: 'Payment amount does not match assessed service fee',
        });
        return;
      }

      if (String(application.payment_status || '').toLowerCase() === 'paid') {
        res.status(200).json({
          received: true,
          success: true,
          alreadyRecorded: true,
          paymentId,
          paymentIntentId,
          amount: amountPhp,
          paymentReference: application.payment_reference,
          officialReceiptNumber: application.official_receipt_number,
          applicationId: application.id,
        });
        return;
      }

      await pool.query(
        `UPDATE rpt_applications
         SET status = 'Payment Completed',
             payment_status = 'Paid',
             payment_reference = $1,
             official_receipt_number = $2,
             payment_method = $3,
             payment_date = NOW()
         WHERE id = $4`,
        [
          paymentReference,
          officialReceiptNumber,
          formattedPaymentMethod,
          metadata.rptApplicationId,
        ]
      );

      await recordAudit(
        req,
        'AUD-PAYMONGO-WEBHOOK',
        metadata.customerEmail || application.email || 'citizen@gov.ph',
        'Citizen',
        'RPT Module',
        'RPT_SERVICE_PAYMENT_WEBHOOK_SUCCESS',
        'INFO',
        null,
        `RPT service payment confirmed via webhook. Service: ${application.service || metadata.rptService || 'RPT Service'}. Application: ${metadata.rptApplicationId}. Reference ${paymentReference}. Amount ${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
      );

      await sendPaymentReceiptOnce({
        paymentKey: `paymongo:${paymentId || paymentIntentId}`,
        toEmail: metadata.customerEmail || application.email,
        customerName: metadata.customerName || application.applicant_name || application.owner_name,
        service: application.service || metadata.rptService || 'RPT Service',
        amount: amountPhp,
        paymentMethod: formattedPaymentMethod,
        paymentReference,
        officialReceiptNumber,
        paymentDate: new Date(),
        accountReference: application.control_number || application.tax_declaration_number,
      });

      res.status(200).json({
        received: true,
        success: true,
        paymentId,
        paymentIntentId,
        amount: amountPhp,
        paymentMethod: formattedPaymentMethod,
        paymentReference,
        officialReceiptNumber,
        applicationId: metadata.rptApplicationId,
        service: application.service || metadata.rptService,
      });
      return;
    }


    if (metadata.type === 'RPT' && metadata.taxDeclarationNumber) {
      const tdns = String(metadata.taxDeclarationNumber)
        .split(',')
        .map((value: string) => value.trim())
        .filter(Boolean);

      for (const tdn of tdns) {
        await pool.query(
          `UPDATE lgu_rpt_records
           SET balance = 0,
               amount_paid = total_assessment,
               status = 'Paid',
               payment_status = 'Paid',
               payment_method = $1,
               official_receipt_number = $2,
               payment_reference = $3,
               payment_date = NOW()
           WHERE tax_declaration_number ILIKE $4`,
          [formattedPaymentMethod, officialReceiptNumber, paymentReference, tdn]
        );
      }

      await recordAudit(
        req,
        'AUD-PAYMONGO-WEBHOOK',
        metadata.customerEmail || 'citizen@gov.ph',
        'Citizen',
        'ePayment Gateway',
        'PAYMENT_WEBHOOK_SUCCESS',
        'INFO',
        null,
        `RPT payment confirmed via ${formattedPaymentMethod}. TDN(s) ${tdns.join(', ')}. Reference ${paymentReference}. Amount ${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
      );

      await sendPaymentReceiptOnce({
        paymentKey: `paymongo:${paymentId || paymentIntentId}`,
        toEmail: metadata.customerEmail,
        customerName: metadata.customerName,
        service: 'Real Property Tax',
        amount: amountPhp,
        paymentMethod: formattedPaymentMethod,
        paymentReference,
        officialReceiptNumber,
        paymentDate: new Date(),
        accountReference: tdns.join(', '),
      });

      res.status(200).json({
        received: true,
        success: true,
        paymentId,
        paymentIntentId,
        amount: amountPhp,
        paymentMethod: formattedPaymentMethod,
        paymentReference,
        officialReceiptNumber,
        taxDeclarationNumbers: tdns,
      });

      return;
    }


    if (
      (metadata.type === 'MARKET_STALL' || metadata.type === 'MARKET') &&
      metadata.leaseId
    ) {
      console.log(
        ` Processing market stall payment for lease ${metadata.leaseId}`
      );

      // This variable must be declared in the Market webhook scope.
      // It preserves the database O.R. when PayMongo sends a duplicate webhook.
      let marketOfficialReceiptNumber = officialReceiptNumber;

      const existingLease = await pool.query(
        `
        SELECT payment_status, email, first_name, last_name, official_receipt_number
        FROM market_leases
        WHERE lease_id = $1
           OR id::text = $1
        LIMIT 1
        `,
        [metadata.leaseId]
      );

      if (existingLease.rows.length === 0) {
        console.warn(
          ` No market lease found for leaseId ${metadata.leaseId}`
        );

        res.status(200).json({
          received: true,
          success: false,
          paymentId,
          paymentIntentId,
          amount: amountPhp,
          paymentReference,
          message: `Market lease ${metadata.leaseId} was not found.`,
        });

        return;
      }

      const existingLeaseRecord = existingLease.rows[0];
      const existingPaymentStatus = String(
        existingLeaseRecord.payment_status || ''
      ).toLowerCase();

      if (existingPaymentStatus === 'paid') {
        // Keep the existing database O.R. for duplicate webhook events.
        marketOfficialReceiptNumber =
          existingLeaseRecord.official_receipt_number ||
          officialReceiptNumber;

        console.log(
          ` Market lease ${metadata.leaseId} is already Paid with O.R. ${marketOfficialReceiptNumber}.`
        );
      } else {
        // Use an existing O.R. if one exists; otherwise create one once.
        marketOfficialReceiptNumber =
          existingLeaseRecord.official_receipt_number ||
          `OR-PM-${new Date().getFullYear()}-${Math.floor(
            100000 + Math.random() * 900000
          )}`;

        const leaseResult = await pool.query(
          `
          UPDATE market_leases
          SET
            payment_status = 'Paid',
            advance_payment_status = 'Paid',
            payment_method = $1,
            official_receipt_number = $2,
            payment_reference = $3,
            payment_date = NOW()
          WHERE lease_id = $4
             OR id::text = $4
          RETURNING *
          `,
          [
            formattedPaymentMethod,
            marketOfficialReceiptNumber,
            paymentReference,
            metadata.leaseId,
          ]
        );

        if (leaseResult.rows.length === 0) {
          console.warn(
            ` Market lease could not be updated: ${metadata.leaseId}`
          );

          res.status(200).json({
            received: true,
            success: false,
            paymentId,
            paymentIntentId,
            amount: amountPhp,
            paymentReference,
            message: `Market lease ${metadata.leaseId} could not be updated.`,
          });

          return;
        }

        console.log(
          ` Market lease ${metadata.leaseId} marked as PAID with O.R. ${marketOfficialReceiptNumber}.`
        );

        await sendPaymentReceiptOnce({
          paymentKey: `paymongo:${paymentId || paymentIntentId}`,
          toEmail:
            metadata.customerEmail ||
            leaseResult.rows[0]?.email,
          customerName:
            metadata.customerName ||
            `${leaseResult.rows[0]?.first_name || ''} ${leaseResult.rows[0]?.last_name || ''}`.trim(),
          service: 'Market Stall Rental',
          amount: amountPhp,
          paymentMethod: formattedPaymentMethod,
          paymentReference,
          officialReceiptNumber: marketOfficialReceiptNumber,
          paymentDate: new Date(),
          accountReference: metadata.leaseId,
        });
      }

      await recordAudit(
        req,
        'AUD-PAYMONGO-WEBHOOK',
        metadata.customerEmail || 'citizen@gov.ph',
        'Citizen',
        'ePayment Gateway',
        'PAYMENT_WEBHOOK_SUCCESS',
        'INFO',
        null,
        `Market stall payment confirmed via ${formattedPaymentMethod}. Lease ${metadata.leaseId}. Reference ${paymentReference}. Amount ${amountPhp.toFixed(2)}. O.R. ${marketOfficialReceiptNumber}.`
      );

      res.status(200).json({
        received: true,
        success: true,
        paymentId,
        paymentIntentId,
        amount: amountPhp,
        paymentMethod: formattedPaymentMethod,
        paymentReference,
        officialReceiptNumber: marketOfficialReceiptNumber,
        leaseId: metadata.leaseId,
      });

      return;
    }


    if (metadata.taxDeclarationNumber) {
      await pool.query(
        `
        UPDATE lgu_rpt_records
        SET
          balance = 0,
          amount_paid = total_assessment,
          status = 'Paid',
          payment_status = 'Paid',
          payment_method = $1,
          official_receipt_number = $2,
          payment_reference = $3,
          payment_date = NOW()
        WHERE tax_declaration_number ILIKE $4
        `,
        [
          formattedPaymentMethod,
          officialReceiptNumber,
          paymentReference,
          metadata.taxDeclarationNumber,
        ]
      );

      await pool.query(
        `
        INSERT INTO citizen_rpt_payments
        (
          tax_declaration_number,
          owner_name,
          amount,
          payment_method,
          payment_reference,
          official_receipt_number,
          paymongo_session_id,
          payment_date
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
          NOW()
        )
        ON CONFLICT (payment_reference)
        DO NOTHING
        `,
        [
          metadata.taxDeclarationNumber,
          metadata.customerName || 'Taxpayer',
          amountPhp,
          formattedPaymentMethod,
          paymentReference,
          officialReceiptNumber,
          paymentId || paymentIntentId,
        ]
      );

      await recordAudit(
        req,
        'AUD-PAYMONGO-WEBHOOK',
        metadata.customerEmail || 'citizen@gov.ph',
        'Citizen',
        'ePayment Gateway',
        'PAYMENT_WEBHOOK_SUCCESS',
        'INFO',
        null,
        `RPT payment confirmed via ${formattedPaymentMethod}. TD# ${metadata.taxDeclarationNumber}. Reference ${paymentReference}. Amount ${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
      );

      res.status(200).json({
        received: true,
        success: true,
        paymentId,
        paymentIntentId,
        amount: amountPhp,
        paymentMethod: formattedPaymentMethod,
        paymentReference,
        officialReceiptNumber,
        taxDeclarationNumber: metadata.taxDeclarationNumber,
      });

      return;
    }


    if (metadata.businessTrackingNumber) {
      const finalized = await finalizeBusinessTaxPayment({
        trackingNumber: String(metadata.businessTrackingNumber),
        amount: amountPhp,
        paymentMethod: formattedPaymentMethod,
        paymentReference,
        paymongoPaymentId: paymentId || null,
        paymongoSessionId: paymentIntentId || null,
      });

      if (!finalized.ok) {
        res.status(finalized.status).json({
          received: true,
          success: false,
          error: finalized.error,
          paymentId,
          paymentIntentId,
        });
        return;
      }

      const businessRecord = finalized.record;
      const businessOfficialReceiptNumber = String(businessRecord?.official_receipt_number || officialReceiptNumber);
      const businessPaymentReference = String(businessRecord?.payment_reference || paymentReference);

      await recordAudit(
        req,
        'AUD-PAYMONGO-WEBHOOK',
        metadata.customerEmail || businessRecord?.email || 'citizen@gov.ph',
        'Citizen',
        'Business Tax Module',
        'BUSINESS_TAX_PAYMENT_WEBHOOK_CONFIRMED',
        'INFO',
        null,
        `Business tax payment confirmed via ${formattedPaymentMethod}. Tracking #${metadata.businessTrackingNumber}. Reference ${businessPaymentReference}. Amount ${amountPhp.toFixed(2)}. O.R. ${businessOfficialReceiptNumber}.`
      );

      await sendPaymentReceiptOnce({
        paymentKey: `paymongo:${paymentId || paymentIntentId}`,
        toEmail: metadata.customerEmail || businessRecord?.email,
        customerName: metadata.customerName || businessRecord?.business_owner,
        service: 'Business Tax and Regulatory Fee',
        amount: amountPhp,
        paymentMethod: businessRecord?.payment_method || formattedPaymentMethod,
        paymentReference: businessPaymentReference,
        officialReceiptNumber: businessOfficialReceiptNumber,
        paymentDate: businessRecord?.payment_date || new Date(),
        accountReference: metadata.businessTrackingNumber,
      });

      res.status(200).json({
        received: true,
        success: true,
        paymentId,
        paymentIntentId,
        amount: amountPhp,
        paymentMethod: businessRecord?.payment_method || formattedPaymentMethod,
        paymentReference: businessPaymentReference,
        officialReceiptNumber: businessOfficialReceiptNumber,
        businessTrackingNumber: metadata.businessTrackingNumber,
        alreadyRecorded: Boolean(finalized.alreadyRecorded),
      });

      return;
    }


    console.warn(
      ' PayMongo payment was successful but no recognized metadata was found.',
      {
        paymentId,
        paymentIntentId,
        metadata,
      }
    );

    await recordAudit(
      req,
      'AUD-PAYMONGO-WEBHOOK',
      metadata.customerEmail || 'citizen@gov.ph',
      'Citizen',
      'ePayment Gateway',
      'PAYMENT_WEBHOOK_RECEIVED',
      'INFO',
      null,
      `PayMongo payment ${paymentId || paymentIntentId} was received successfully, but no recognized record type was found. Reference ${paymentReference}. Amount ${amountPhp.toFixed(2)}.`
    );

    res.status(200).json({
      received: true,
      success: true,
      paymentId,
      paymentIntentId,
      amount: amountPhp,
      paymentReference,
      message:
        'Payment received, but no matching application record was found.',
    });
  } catch (err: any) {
    console.error(
      ' Error handling PayMongo webhook:',
      err
    );

    res.status(500).json({
      error: 'Webhook processing error',
      message:
        err.message || 'Unknown webhook processing error',
    });
  }
}

export async function getQrPaymentStatus(
  req: Request,
  res: Response
): Promise<void> {
  const { paymentIntentId } = req.params;

  if (!paymentIntentId) {
    res.status(400).json({
      success: false,
      error: 'paymentIntentId is required.',
    });
    return;
  }

  try {
    const secretKey = PayMongoService.getSecretKey();

    if (!secretKey) {
      throw new Error(
        'PAYMONGO_SECRET_KEY is not configured.'
      );
    }

    const response = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${secretKey}:`
          ).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.errors
          ?.map((e: any) => e.detail || e.code)
          .join(', ') ||
        'Failed to retrieve PayMongo Payment Intent';

      throw new Error(errorMsg);
    }

    const attributes = data.data?.attributes || {};
    const status = attributes.status;
    const paid = status === 'succeeded';
    const metadata = attributes.metadata || {};

    console.log(' QR Payment Status:', {
      paymentIntentId,
      status,
      paid,
      metadata,
    });


    if (
      paid &&
      metadata.type === 'BUSINESS_TAX' &&
      metadata.businessTrackingNumber
    ) {
      const qrAmount = Number(attributes.amount || 0) / 100;
      const qrPaymentReference =
        metadata.referenceNumber ||
        attributes.external_reference_number ||
        `REF-${paymentIntentId.slice(-8)}`;

      const finalized = await finalizeBusinessTaxPayment({
        trackingNumber: String(metadata.businessTrackingNumber),
        amount: qrAmount,
        paymentMethod: 'PayMongo (QR Ph)',
        paymentReference: qrPaymentReference,
        paymongoPaymentId: String(paymentIntentId),
      });

      if (!finalized.ok) {
        res.status(finalized.status).json({
          success: false,
          paid: false,
          error: finalized.error,
          paymentIntentId,
          status,
          metadata,
        });
        return;
      }

      const businessRecord = finalized.record;
      const qrOfficialReceiptNumber = String(
        businessRecord?.official_receipt_number ||
        makeOfficialReceiptNumber()
      );
      const qrSavedReference = String(
        businessRecord?.payment_reference ||
        qrPaymentReference
      );

      await recordAudit(
        req,
        'AUD-PAYMONGO-QR',
        metadata.customerEmail || businessRecord?.email || 'citizen@gov.ph',
        'Citizen',
        'Business Tax Module',
        'BUSINESS_TAX_QR_PAYMENT_CONFIRMED',
        'INFO',
        null,
        `Business Tax payment confirmed via PayMongo QR Ph. Tracking #${metadata.businessTrackingNumber}. Amount ${qrAmount.toFixed(2)}. Reference ${qrSavedReference}. O.R. ${qrOfficialReceiptNumber}.`
      );

      await sendPaymentReceiptOnce({
        paymentKey: `paymongo:${paymentIntentId}`,
        toEmail: metadata.customerEmail || businessRecord?.email,
        customerName: metadata.customerName || businessRecord?.business_owner,
        service: 'Business Tax and Regulatory Fee',
        amount: qrAmount,
        paymentMethod: businessRecord?.payment_method || 'PayMongo (QR Ph)',
        paymentReference: qrSavedReference,
        officialReceiptNumber: qrOfficialReceiptNumber,
        paymentDate: businessRecord?.payment_date || new Date(),
        accountReference: metadata.businessTrackingNumber,
      });

      res.status(200).json({
        success: true,
        paid: true,
        paymentIntentId,
        status,
        amount: qrAmount,
        metadata,
        officialReceiptNumber: qrOfficialReceiptNumber,
        paymentReference: qrSavedReference,
        businessTrackingNumber: metadata.businessTrackingNumber,
        alreadyRecorded: Boolean(finalized.alreadyRecorded),
      });
      return;
    }


    let marketOfficialReceiptNumber: string | undefined;

    if (
      paid &&
      (metadata.type === 'MARKET_STALL' || metadata.type === 'MARKET') &&
      metadata.leaseId
    ) {
      console.log(
        `QR payment succeeded for lease ${metadata.leaseId}`
      );

      const existingMarketLease = await pool.query(
        `
        SELECT official_receipt_number
        FROM market_leases
        WHERE lease_id = $1
           OR id::text = $1
        LIMIT 1
        `,
        [metadata.leaseId]
      );

      marketOfficialReceiptNumber =
        existingMarketLease.rows[0]?.official_receipt_number ||
        `OR-PM-${new Date().getFullYear()}-${Math.floor(
          100000 + Math.random() * 900000
        )}`;

      const paymentReference =
        metadata.referenceNumber ||
        attributes.external_reference_number ||
        `MKT-${metadata.leaseId}-${paymentIntentId.slice(-6)}`;

      const leaseResult = await pool.query(
        `
        UPDATE market_leases
        SET
          payment_status = 'Paid',
          advance_payment_status = 'Paid',
          payment_method = 'PayMongo (QR Ph)',
          official_receipt_number = $1,
          payment_reference = $2,
          payment_date = NOW()
        WHERE lease_id = $3
           OR id::text = $3
        RETURNING *
        `,
        [
          marketOfficialReceiptNumber,
          paymentReference,
          metadata.leaseId,
        ]
      );

      if (leaseResult.rows.length > 0) {
        console.log(
          ` Market lease ${metadata.leaseId} marked as PAID with O.R. ${marketOfficialReceiptNumber}.`
        );
      } else {
        console.warn(
          ` Market lease not found: ${metadata.leaseId}`
        );
      }

      if (marketOfficialReceiptNumber) {
        await sendPaymentReceiptOnce({
          paymentKey: `paymongo:${paymentIntentId}`,
          toEmail: metadata.customerEmail || leaseResult.rows[0]?.email,
          customerName: metadata.customerName || (leaseResult.rows[0] ? `${leaseResult.rows[0].first_name || ''} ${leaseResult.rows[0].last_name || ''}`.trim() : undefined),
          service: 'Market Stall Rental',
          amount: Number(attributes.amount || 0) / 100,
          paymentMethod: 'PayMongo (QR Ph)',
          paymentReference,
          officialReceiptNumber: marketOfficialReceiptNumber,
          paymentDate: new Date(),
          accountReference: metadata.leaseId,
        });
      }
    }


    if (
      paid &&
      metadata.type === 'RPT_SERVICE' &&
      metadata.rptApplicationId
    ) {
      const applicationResult = await pool.query(
        `SELECT * FROM rpt_applications WHERE id = $1 LIMIT 1`,
        [metadata.rptApplicationId]
      );

      if (applicationResult.rows.length > 0) {
        const application = applicationResult.rows[0];
        const assessedAmount = Number(application.payment_amount || 0);
        const paidAmount = Number(attributes.amount || 0) / 100;

        if (
          Number.isFinite(assessedAmount) &&
          assessedAmount > 0 &&
          Math.abs(paidAmount - assessedAmount) <= 0.01
        ) {
          if (String(application.payment_status || '').toLowerCase() !== 'paid') {
            const officialReceiptNumber =
              `OR-PM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
            const paymentReference =
              metadata.referenceNumber ||
              attributes.external_reference_number ||
              `REF-${paymentIntentId.slice(-8)}`;

            await pool.query(
              `UPDATE rpt_applications
               SET status = 'Payment Completed',
                   payment_status = 'Paid',
                   payment_reference = $1,
                   official_receipt_number = $2,
                   payment_method = $3,
                   payment_date = NOW()
               WHERE id = $4`,
              [
                paymentReference,
                officialReceiptNumber,
                'PayMongo (QR Ph)',
                metadata.rptApplicationId,
              ]
            );

            await sendPaymentReceiptOnce({
              paymentKey: `paymongo:${paymentIntentId}`,
              toEmail: metadata.customerEmail || application.email,
              customerName: metadata.customerName || application.applicant_name || application.owner_name,
              service: application.service || metadata.rptService || 'RPT Service',
              amount: assessedAmount,
              paymentMethod: 'PayMongo (QR Ph)',
              paymentReference,
              officialReceiptNumber,
              paymentDate: new Date(),
              accountReference: application.control_number || application.tax_declaration_number,
            });

            await recordAudit(
              req,
              'AUD-PAYMONGO-QR',
              metadata.customerEmail || application.email || 'citizen@gov.ph',
              'Citizen',
              'RPT Module',
              'RPT_SERVICE_PAYMENT_QR_SUCCESS',
              'INFO',
              null,
              `RPT service payment confirmed via QR Ph. Application ${metadata.rptApplicationId}. Reference ${paymentReference}. Amount ${assessedAmount.toFixed(2)}. O.R. ${officialReceiptNumber}.`
            );
          }
        } else {
          console.warn(
            `RPT service QR payment amount mismatch or missing assessment for application ${metadata.rptApplicationId}. Expected ${assessedAmount}, received ${paidAmount}.`
          );
        }
      } else {
        console.warn(
          `RPT service application not found: ${metadata.rptApplicationId}`
        );
      }
    }


    if (
      paid &&
      metadata.type === 'RPT' &&
      metadata.taxDeclarationNumber
    ) {
      const tdns = String(metadata.taxDeclarationNumber)
        .split(',')
        .map((value: string) => value.trim())
        .filter(Boolean);

      const rptOfficialReceiptNumber =
        `OR-PM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const rptPaymentReference =
        metadata.referenceNumber ||
        attributes.external_reference_number ||
        `REF-${paymentIntentId.slice(-8)}`;
      let rptOwnerName = metadata.customerName || 'Taxpayer';
      let rptEmail = metadata.customerEmail || '';

      for (const tdn of tdns) {
        const rptResult = await pool.query(
          `
          UPDATE lgu_rpt_records
          SET
            balance = 0,
            amount_paid = total_assessment,
            status = 'Paid',
            payment_status = 'Paid',
            payment_method = 'PayMongo (QR Ph)',
            official_receipt_number = $2,
            payment_reference = $3,
            payment_date = NOW()
          WHERE tax_declaration_number ILIKE $1
          RETURNING *
          `,
          [tdn, rptOfficialReceiptNumber, rptPaymentReference]
        );

        if (rptResult.rows.length > 0) {
          console.log(` RPT ${tdn} marked as PAID.`);
          rptOwnerName = metadata.customerName || rptResult.rows[0].owner_name || rptOwnerName;
        } else {
          console.warn(` RPT record not found: ${tdn}`);
        }
      }

      await sendPaymentReceiptOnce({
        paymentKey: `paymongo:${paymentIntentId}`,
        toEmail: rptEmail,
        customerName: rptOwnerName,
        service: 'Real Property Tax',
        amount: Number(attributes.amount || 0) / 100,
        paymentMethod: 'PayMongo (QR Ph)',
        paymentReference: rptPaymentReference,
        officialReceiptNumber: rptOfficialReceiptNumber,
        paymentDate: new Date(),
        accountReference: tdns.join(', '),
      });
    }

    res.status(200).json({
      success: true,
      paymentIntentId,
      status,
      paid,
      amount: Number(attributes.amount || 0) / 100,
      metadata,
      officialReceiptNumber:
        paid && (metadata.type === 'MARKET_STALL' || metadata.type === 'MARKET')
          ? marketOfficialReceiptNumber
          : undefined,
    });
  } catch (err: any) {
    console.error(
      ' QR payment status error:',
      err
    );

    res.status(500).json({
      success: false,
      error:
        err?.message ||
        'Failed to check QR payment status.',
    });
  }
}

export async function createQrPaymentIntent(
  req: Request,
  res: Response
): Promise<void> {
  const {
    amount,
    type,
    leaseId,
    taxDeclarationNumber,
    rptRecordId,
    businessTrackingNumber,
    rptApplicationId,
    customerName,
    customerEmail,
    customerPhone,
    rptService,
    description,
  } = req.body;

  try {
    let numericAmount = Number(amount);

    const paymentType =
      type ||
      (rptApplicationId
        ? 'RPT_SERVICE'
        : businessTrackingNumber
          ? 'BUSINESS_TAX'
          : taxDeclarationNumber
            ? 'RPT'
            : 'MARKET_STALL');


    if (paymentType === 'BUSINESS_TAX') {
      if (!businessTrackingNumber) {
        res.status(400).json({ success: false, error: 'businessTrackingNumber is required for Business Tax payments.' });
        return;
      }

      const businessResult = await pool.query(
        `SELECT tracking_number, business_name, business_owner, email, status, payment_status, payment_amount, computed_fees
         FROM business_assessments
         WHERE tracking_number = $1 OR id::text = $1
         LIMIT 1`,
        [businessTrackingNumber]
      );

      if (businessResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Business Tax assessment not found.' });
        return;
      }

      const business = businessResult.rows[0];
      let approvedAmount = Number(business.payment_amount || 0);
    if ((!Number.isFinite(approvedAmount) || approvedAmount <= 0) && business.computed_fees) {
      try {
        const legacyFees = typeof business.computed_fees === 'object' ? business.computed_fees : JSON.parse(String(business.computed_fees));
        approvedAmount = Number(legacyFees?.total || 0);
      } catch {
        approvedAmount = 0;
      }
    }

      const bizStatus = String(business.status || '').toUpperCase();
      if (bizStatus !== 'APPROVED' && bizStatus !== 'FOR_OWNER_PAYMENT') {
        res.status(409).json({ success: false, error: 'This Business Tax assessment is not approved for payment yet.' });
        return;
      }

      if (String(business.payment_status || '').toUpperCase() === 'PAID') {
        res.status(409).json({ success: false, error: 'This Business Tax assessment has already been paid.' });
        return;
      }

      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        res.status(409).json({ success: false, error: 'The approved Business Tax assessment has no valid amount due.' });
        return;
      }

      if (Number.isFinite(numericAmount) && Math.abs(numericAmount - approvedAmount) > 0.01) {
        res.status(409).json({ success: false, error: `Payment amount does not match the approved amount due (₱${approvedAmount.toFixed(2)}).` });
        return;
      }

      numericAmount = approvedAmount;
    }

    if (paymentType === 'RPT_SERVICE') {
      if (!rptApplicationId) {
        res.status(400).json({
          success: false,
          error: 'RPT application ID is required.',
        });
        return;
      }

      const applicationResult = await pool.query(
        `SELECT id, service, payment_amount, payment_status, status
         FROM rpt_applications
         WHERE id = $1
         LIMIT 1`,
        [rptApplicationId]
      );

      if (applicationResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'RPT service application not found.',
        });
        return;
      }

      const application = applicationResult.rows[0];
      const assessedAmount = Number(application.payment_amount || 0);

      if (!Number.isFinite(assessedAmount) || assessedAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'The City Assessor has not posted an assessed service fee yet.',
        });
        return;
      }

      if (String(application.payment_status || '').toLowerCase() === 'paid') {
        res.status(409).json({
          success: false,
          error: 'This RPT service application has already been paid.',
        });
        return;
      }

      numericAmount = assessedAmount;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({
        success: false,
        error: 'A valid payment amount is required.',
      });
      return;
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);

    const referenceNumber =
      paymentType === 'BUSINESS_TAX'
        ? `BIZ-${businessTrackingNumber || Date.now()}-${randomSuffix}`
        : paymentType === 'RPT_SERVICE'
          ? `RPT-SVC-${rptApplicationId || Date.now()}-${randomSuffix}`
          : paymentType === 'RPT'
            ? `RPT-${taxDeclarationNumber || Date.now()}-${randomSuffix}`
            : `MKT-${leaseId || Date.now()}-${randomSuffix}`;

    const paymentDescription =
      description ||
      (paymentType === 'BUSINESS_TAX'
        ? 'Business Tax Assessment Payment'
        : paymentType === 'RPT_SERVICE'
          ? `RPT Service Payment (${rptService || 'RPT Service'})`
          : paymentType === 'RPT'
            ? 'Real Property Tax Payment'
            : 'Market Stall Rental Payment');

    const qrMetadata =
      paymentType === 'RPT'
        ? {
          type: 'RPT',

          taxDeclarationNumber: taxDeclarationNumber
            ? String(taxDeclarationNumber)
            : undefined,

          rptRecordId:
            rptRecordId !== undefined && rptRecordId !== null
              ? String(rptRecordId)
              : undefined,

          customerName:
            customerName
              ? String(customerName)
              : undefined,

          customerEmail:
            customerEmail
              ? String(customerEmail)
              : undefined,

          customerPhone:
            customerPhone
              ? String(customerPhone)
              : undefined,
        }
        : {
          type: paymentType,

          leaseId:
            paymentType === 'MARKET_STALL'
              ? leaseId
              : undefined,

          taxDeclarationNumber:
            paymentType === 'RPT'
              ? taxDeclarationNumber
              : undefined,

          rptRecordId:
            paymentType === 'RPT'
              ? rptRecordId
              : undefined,

          rptApplicationId:
            paymentType === 'RPT_SERVICE'
              ? rptApplicationId
              : undefined,

          businessTrackingNumber:
            paymentType === 'BUSINESS_TAX'
              ? businessTrackingNumber
              : undefined,

          customerName,
          customerEmail,
          customerPhone,
        };

    const result = await PayMongoService.createQrPaymentIntent({
      amount: numericAmount,
      description: paymentDescription,
      referenceNumber,
      metadata: sanitizeMetadata(qrMetadata),
    });

    res.status(200).json({
      success: true,
      paymentIntentId: result.id,
      clientKey: result.clientKey,
      amount: result.amount,
      status: result.status,
      referenceNumber,
      publicKey: PayMongoService.getPublicKey(),
    });
  } catch (err: any) {
    console.error(' QR Ph Payment Intent error:', err);

    res.status(500).json({
      success: false,
      error:
        err.message ||
        'Failed to create QR Ph payment.',
    });
  }
}