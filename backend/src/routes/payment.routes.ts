// src/routes/payment.routes.ts
import { Router } from 'express';
import {
  createCheckoutSession,
  verifySession,
  handlePayMongoWebhook,
  getPayMongoStatus,
  createQrPaymentIntent,
} from '../controllers/payment.controller.js';

const router = Router();

// PayMongo API Diagnostics & Status
router.get('/api/paymongo/status', getPayMongoStatus);

// PayMongo Checkout Session Operations
router.post('/api/payments/create-checkout-session', createCheckoutSession);
router.post('/api/payments/verify-session', verifySession);
router.post('/api/payments/create-qr-payment-intent', createQrPaymentIntent);

// PayMongo Webhook Handler
router.post('/api/paymongo/webhook', handlePayMongoWebhook);

export default router;
