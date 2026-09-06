import { Router } from 'express';
import {
  createCheckoutSession,
  verifySession,
  handlePayMongoWebhook,
  getPayMongoStatus,
  createQrPaymentIntent,
  getQrPaymentStatus,
} from '../controllers/payment.controller.js';

const router = Router();

router.get('/api/paymongo/status', getPayMongoStatus);

router.post('/api/payments/create-checkout-session', createCheckoutSession);
router.post('/api/payments/verify-session', verifySession);
router.post('/api/payments/create-qr-payment-intent', createQrPaymentIntent);
router.get('/api/payments/qr-status/:paymentIntentId', getQrPaymentStatus);

router.post('/api/paymongo/webhook', handlePayMongoWebhook);

export default router;
