// src/controllers/payment.controller.ts
import type { Request, Response } from 'express';
import pool from '../db.js';
import { PayMongoService } from '../services/paymongo.service.js';
import { recordAudit } from './audit.controller.js';

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
    type, // 'RPT' | 'MARKET_STALL' | 'BUSINESS_TAX' | 'CUSTOM'
    amount,
    taxDeclarationNumber,
    rptRecordId,
    leaseId,
    businessTrackingNumber,
    customerName,
    customerEmail,
    customerPhone,
    description,
    frontendRedirectUrl,
  } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'A valid payment amount is required.' });
    return;
  }

  const numericAmount = Number(amount);
  const frontendOrigin =
    frontendRedirectUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  const cleanFrontendOrigin = String(frontendOrigin).replace(/\/+$/, '');

  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);

  let referenceNumber = `PAY-${dateCode}-${randomSuffix}`;
  let paymentDescription = description || `Municipal Payment - ₱${numericAmount.toFixed(2)}`;
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
  } else if (type === 'TRANSFER_TAX') {
    referenceNumber = `TRF-${rptRecordId || dateCode}-${randomSuffix}`;
    paymentDescription = description || `Quezon City Transfer Tax Payment`;
    successRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=success&session_id={CHECKOUT_SESSION_ID}&type=TRANSFER_TAX`;
    cancelRedirectUrl = `${cleanFrontendOrigin}/citizen-rpt?payment=cancelled&type=TRANSFER_TAX`;
  } else if (type === 'BUSINESS_TAX') {
    referenceNumber = `BIZ-${businessTrackingNumber || dateCode}-${randomSuffix}`;
    paymentDescription = `Business Tax Assessment Payment (${businessTrackingNumber || 'Mayor Permit'})`;
    successRedirectUrl = `${cleanFrontendOrigin}/business-tax-assessment?payment=success&session_id={CHECKOUT_SESSION_ID}&type=BUSINESS`;
    cancelRedirectUrl = `${cleanFrontendOrigin}/business-tax-assessment?payment=cancelled&type=BUSINESS`;
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
      metadata: {
        type: type || 'GENERAL',
        rptRecordId,
        taxDeclarationNumber,
        leaseId,
        businessTrackingNumber,
        rptApplicationId: req.body.rptApplicationId,
        customerName,
        customerEmail,
      },
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
      `Created PayMongo checkout session ${session.id} for ${referenceNumber} (₱${numericAmount.toFixed(2)})`
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
             amountPaid = totalAssessment,
             status = 'Paid',
             paymentStatus = 'Paid',
             paymentMethod = $1,
             officialReceiptNumber = $2,
             paymentReference = $3,
             paymentDate = NOW()
         WHERE taxDeclarationNumber ILIKE $4`,
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
    } else if (type === 'TRANSFER_TAX' && metadata.rptApplicationId) {
      const appId = metadata.rptApplicationId;
      const existingPayment = await pool.query('SELECT * FROM rpt_applications WHERE id = $1 LIMIT 1', [appId]);
      if (existingPayment.rowCount === 0) throw new Error('RPT transfer application was not found.');
      const app = existingPayment.rows[0];
      const assessedAmount = Number(app.transfer_tax_amount || app.payment_amount || 0);
      if (assessedAmount > 0 && Math.abs(assessedAmount - Number(session.amount)) > 0.01) {
        throw new Error('Paid amount does not match the assessed Transfer Tax.');
      }
      await pool.query(`UPDATE rpt_applications SET payment_status='Paid', transfer_tax_status='Paid', payment_amount=$1, payment_reference=$2, official_receipt_number=$3, payment_method=$4, payment_date=NOW(), status='Processing', workflow_stage='Transfer Tax Paid / Processing' WHERE id=$5`, [session.amount, paymentReference, officialReceiptNumber, `PayMongo (${formattedPaymentMethod})`, appId]);
      recordResult = await pool.query('SELECT * FROM rpt_applications WHERE id = $1', [appId]);
    } else if (type === 'MARKET_STALL' && metadata.leaseId) {
      await pool.query(
        `UPDATE market_leases
         SET payment_status = 'Paid',
             advance_payment_status = 'Paid',
             payment_method = $1
         WHERE lease_id = $2 OR id::text = $2`,
        [`PayMongo (${formattedPaymentMethod})`, metadata.leaseId]
      );
    } else if (type === 'BUSINESS_TAX' && metadata.businessTrackingNumber) {
      await pool.query(
        `UPDATE business_assessments
         SET status = 'APPROVED',
             remarks = $1
         WHERE tracking_number = $2 OR id::text = $2`,
        [`Paid via PayMongo (${formattedPaymentMethod}) - OR: ${officialReceiptNumber}`, metadata.businessTrackingNumber]
      );
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
      `Verified PayMongo payment session ${sessionId}. Issued O.R. ${officialReceiptNumber} for ₱${session.amount.toFixed(2)}`
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

export async function handlePayMongoWebhook(req: Request, res: Response): Promise<void> {
  const signatureHeader = (req.headers['paymongo-signature'] as string) || '';
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  if (PayMongoService.getWebhookSecret()) {
    const isValid = PayMongoService.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      console.warn('⚠️ Rejected PayMongo webhook with invalid signature.');
      res.status(401).json({ error: 'Invalid PayMongo webhook signature' });
      return;
    }
  }

  try {
    const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
    const eventType = event.data?.attributes?.type;
    const eventData = event.data?.attributes?.data;

    console.log(`🔔 PayMongo Webhook received: ${eventType}`);

    if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
      const attributes = eventData?.attributes || {};
      const metadata = attributes.metadata || {};
      const sessionId = eventData?.id;
      const amountCentavos = attributes.amount || attributes.payments?.[0]?.attributes?.amount || 0;
      const amountPhp = amountCentavos / 100;
      const paymentRef = attributes.reference_number || `REF-${sessionId?.slice(-8)}`;
      const orNo = `OR-WH-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      if (metadata.taxDeclarationNumber) {
        await pool.query(
          `UPDATE lgu_rpt_records
           SET balance = 0,
               amountPaid = totalAssessment,
               status = 'Paid',
               paymentStatus = 'Paid',
               paymentMethod = 'PayMongo Webhook',
               officialReceiptNumber = $1,
               paymentReference = $2,
               paymentDate = NOW()
           WHERE taxDeclarationNumber ILIKE $3`,
          [orNo, paymentRef, metadata.taxDeclarationNumber]
        );

        await pool.query(
          `INSERT INTO citizen_rpt_payments
           (tax_declaration_number, owner_name, amount, payment_method, payment_reference, official_receipt_number, paymongo_session_id, payment_date)
           VALUES ($1, $2, $3, 'PayMongo Live Webhook', $4, $5, $6, NOW())
           ON CONFLICT (payment_reference) DO NOTHING`,
          [metadata.taxDeclarationNumber, metadata.customerName || 'Taxpayer', amountPhp, paymentRef, orNo, sessionId]
        );
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Error handling PayMongo webhook:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
}
export async function createQrPaymentIntent(
  req: Request,
  res: Response
): Promise<void> {
  const {
    amount,
    leaseId,
    customerName,
    customerEmail,
    description,
  } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({
      success: false,
      error: 'A valid payment amount is required.',
    });
    return;
  }

  try {
    const numericAmount = Number(amount);

    const referenceNumber =
      `MKT-${leaseId || Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const result = await PayMongoService.createQrPaymentIntent({
      amount: numericAmount,
      description:
        description || 'Market Stall Rental Payment',
      referenceNumber,
      metadata: {
        type: 'MARKET_STALL',
        leaseId,
        customerName,
        customerEmail,
      },
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
    console.error(
      '❌ QR Ph Payment Intent error:',
      err
    );

    res.status(500).json({
      success: false,
      error:
        err.message ||
        'Failed to create QR Ph payment.',
    });
  }
}