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

  // Verify the webhook signature when a webhook secret is configured.
  if (PayMongoService.getWebhookSecret()) {
    const isValid = PayMongoService.verifyWebhookSignature(
      rawBody,
      signatureHeader
    );

    if (!isValid) {
      console.warn(
        '⚠️ Rejected PayMongo webhook with invalid signature.'
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

    console.log(`🔔 PayMongo Webhook received: ${eventType}`);

    // We only process successful payment events here.
    if (eventType !== 'payment.paid') {
      console.log(`ℹ️ Ignoring PayMongo event: ${eventType}`);

      res.status(200).json({
        received: true,
        ignored: true,
        event: eventType,
      });

      return;
    }

    const paymentAttributes = eventData?.attributes || {};
    const paymentId = eventData?.id;

    // PayMongo payment.paid events contain the Payment Intent ID.
    const paymentIntentId =
      paymentAttributes.payment_intent_id;

    const paymentStatus = paymentAttributes.status;

    const amountCentavos =
      Number(paymentAttributes.amount || 0);

    const amountPhp = amountCentavos / 100;

    const sourceType =
      paymentAttributes.source?.type || 'unknown';

    console.log('💰 Payment paid:', {
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
        '❌ payment.paid event does not contain payment_intent_id.'
      );

      res.status(400).json({
        error: 'payment_intent_id is missing from PayMongo event',
      });

      return;
    }

    // Retrieve the Payment Intent from PayMongo.
    // This is important because the leaseId and payment type
    // were stored in Payment Intent metadata when the payment
    // was created.
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
        '❌ Failed to retrieve PayMongo Payment Intent:',
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

    console.log('🔎 Payment Intent metadata:', {
      paymentIntentId,
      intentStatus,
      metadata,
    });

    // The Payment Intent must have succeeded before we update
    // our database.
    if (intentStatus !== 'succeeded') {
      console.warn(
        `⚠️ Payment Intent ${paymentIntentId} is not succeeded. Current status: ${intentStatus}`
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

    // =========================================================
    // MARKET STALL PAYMENT
    // =========================================================
    if (
      metadata.type === 'MARKET_STALL' &&
      metadata.leaseId
    ) {
      console.log(
        `🏪 Processing market stall payment for lease ${metadata.leaseId}`
      );

      // Check whether the lease is already marked as paid.
      const existingLease = await pool.query(
        `
        SELECT payment_status
        FROM market_leases
        WHERE lease_id = $1
           OR id::text = $1
        LIMIT 1
        `,
        [metadata.leaseId]
      );

      if (existingLease.rows.length === 0) {
        console.warn(
          `⚠️ No market lease found for leaseId ${metadata.leaseId}`
        );
      } else if (
        String(existingLease.rows[0].payment_status).toLowerCase() ===
        'paid'
      ) {
        console.log(
          `ℹ️ Market lease ${metadata.leaseId} is already Paid.`
        );
      } else {
        const leaseResult = await pool.query(
          `
          UPDATE market_leases
          SET
            payment_status = 'Paid',
            advance_payment_status = 'Paid',
            payment_method = $1
          WHERE lease_id = $2
             OR id::text = $2
          RETURNING *
          `,
          [
            formattedPaymentMethod,
            metadata.leaseId,
          ]
        );

        if (leaseResult.rows.length > 0) {
          console.log(
            `✅ Market lease ${metadata.leaseId} marked as PAID.`
          );
        }
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
        `Market stall payment confirmed via ${formattedPaymentMethod}. Lease ${metadata.leaseId}. Reference ${paymentReference}. Amount ₱${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
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
        leaseId: metadata.leaseId,
      });

      return;
    }

    // =========================================================
    // RPT PAYMENT
    // =========================================================
    if (metadata.taxDeclarationNumber) {
      await pool.query(
        `
        UPDATE lgu_rpt_records
        SET
          balance = 0,
          amountPaid = totalAssessment,
          status = 'Paid',
          paymentStatus = 'Paid',
          paymentMethod = $1,
          officialReceiptNumber = $2,
          paymentReference = $3,
          paymentDate = NOW()
        WHERE taxDeclarationNumber ILIKE $4
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
        `RPT payment confirmed via ${formattedPaymentMethod}. TD# ${metadata.taxDeclarationNumber}. Reference ${paymentReference}. Amount ₱${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
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

    // =========================================================
    // BUSINESS TAX PAYMENT
    // =========================================================
    if (metadata.businessTrackingNumber) {
      await pool.query(
        `
        UPDATE business_assessments
        SET
          status = 'APPROVED',
          remarks = $1
        WHERE tracking_number = $2
           OR id::text = $2
        `,
        [
          `Paid via ${formattedPaymentMethod} - OR: ${officialReceiptNumber}`,
          metadata.businessTrackingNumber,
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
        `Business tax payment confirmed via ${formattedPaymentMethod}. Tracking #${metadata.businessTrackingNumber}. Reference ${paymentReference}. Amount ₱${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
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
        businessTrackingNumber:
          metadata.businessTrackingNumber,
      });

      return;
    }

    // =========================================================
    // PAYMENT RECEIVED BUT NO KNOWN RECORD TYPE
    // =========================================================
    console.warn(
      '⚠️ PayMongo payment was successful but no recognized metadata was found.',
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
      `PayMongo payment ${paymentId || paymentIntentId} was received successfully, but no recognized record type was found. Reference ${paymentReference}. Amount ₱${amountPhp.toFixed(2)}.`
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
      '❌ Error handling PayMongo webhook:',
      err
    );

    res.status(500).json({
      error: 'Webhook processing error',
      message:
        err.message || 'Unknown webhook processing error',
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
    businessTrackingNumber,
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

    const paymentType = type || (businessTrackingNumber ? 'BUSINESS_TAX' : 'MARKET_STALL');

    const referenceNumber =
      paymentType === 'BUSINESS_TAX'
        ? `BIZ-${businessTrackingNumber || Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`
        : `MKT-${leaseId || Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const result = await PayMongoService.createQrPaymentIntent({
      amount: numericAmount,
      description:
        description ||
        (paymentType === 'BUSINESS_TAX'
          ? 'Business Tax Assessment Payment'
          : 'Market Stall Rental Payment'),
      referenceNumber,
      metadata: {
        type: paymentType,
        leaseId: paymentType === 'MARKET_STALL' ? leaseId : undefined,
        businessTrackingNumber:
          paymentType === 'BUSINESS_TAX'
            ? businessTrackingNumber
            : undefined,
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