// src/routes/auth.routes.ts
import { Router } from 'express';
import {
  login,
  verifyLoginOtp,
  initiateRegister,
  verifyRegisterOtp,
  resendOtp,
} from '../controllers/auth.controller.js';

const router = Router();

// Sign-In Flow
router.post('/login', login);
router.post('/auth/verify-login-otp', verifyLoginOtp);

// Registration Flow
router.post('/auth/register-init', initiateRegister);
router.post('/auth/verify-register-otp', verifyRegisterOtp);

// Shared Resend Mechanism
router.post('/auth/resend-otp', resendOtp);

export default router;
