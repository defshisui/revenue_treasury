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
      metadata: {
        type: type || 'GENERAL',
        rptRecordId,
        taxDeclarationNumber,
        leaseId,
        businessTrackingNumber,
        rptApplicationId,
        rptService: rptService || null,
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
          ` No market lease found for leaseId ${metadata.leaseId}`
        );
      } else if (
        String(existingLease.rows[0].payment_status).toLowerCase() ===
        'paid'
      ) {
        console.log(
          ` Market lease ${metadata.leaseId} is already Paid.`
        );
      } else {
        const officialReceiptNumber =
          existingLease.rows[0].official_receipt_number ||
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
            officialReceiptNumber,
            paymentReference,
            metadata.leaseId,
          ]
        );

        if (leaseResult.rows.length > 0) {
          console.log(
            ` Market lease ${metadata.leaseId} marked as PAID with O.R. ${officialReceiptNumber}.`
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
        `Market stall payment confirmed via ${formattedPaymentMethod}. Lease ${metadata.leaseId}. Reference ${paymentReference}. Amount ${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
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
        `Business tax payment confirmed via ${formattedPaymentMethod}. Tracking #${metadata.businessTrackingNumber}. Reference ${paymentReference}. Amount ${amountPhp.toFixed(2)}. O.R. ${officialReceiptNumber}.`
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
      console.log(
        `QR payment succeeded for business tax ${metadata.businessTrackingNumber}`
      );

      const officialReceiptNumber =
        `OR-PM-${new Date().getFullYear()}-${Math.floor(
          100000 + Math.random() * 900000
        )}`;

      const businessResult = await pool.query(
        `
        UPDATE business_assessments
        SET
          status = 'APPROVED',
          remarks = $1
        WHERE tracking_number = $2
           OR id::text = $2
        RETURNING *
        `,
        [
          `Paid via PayMongo (QR Ph) - OR: ${officialReceiptNumber}`,
          metadata.businessTrackingNumber,
        ]
      );

      if (businessResult.rows.length > 0) {
        console.log(
          ` Business Tax ${metadata.businessTrackingNumber} marked as PAID.`
        );
      } else {
        console.warn(
          ` Business Tax record not found: ${metadata.businessTrackingNumber}`
        );
      }

      await recordAudit(
        req,
        'AUD-PAYMONGO-QR',
        metadata.customerEmail || 'citizen@gov.ph',
        'Citizen',
        'ePayment Gateway',
        'PAYMENT_QR_SUCCESS',
        'INFO',
        null,
        `Business tax payment confirmed via PayMongo QR Ph. Tracking #${metadata.businessTrackingNumber}. Amount ${(Number(attributes.amount || 0) / 100).toFixed(2)}. O.R. ${officialReceiptNumber}.`
      );
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
            payment_date = NOW()
          WHERE tax_declaration_number ILIKE $1
          RETURNING *
          `,
          [tdn]
        );

        if (rptResult.rows.length > 0) {
          console.log(` RPT ${tdn} marked as PAID.`);
        } else {
          console.warn(` RPT record not found: ${tdn}`);
        }
      }
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
  metadata: qrMetadata,
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
