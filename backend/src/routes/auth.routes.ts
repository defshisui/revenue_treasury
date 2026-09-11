import { Router } from 'express';
import {
  login,
  verifyLoginOtp,
  initiateRegister,
  verifyRegisterOtp,
  resendOtp,
  initiateForgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/auth/verify-login-otp', verifyLoginOtp);
router.post('/auth/register-init', initiateRegister);
router.post('/auth/verify-register-otp', verifyRegisterOtp);

router.post(['/auth/resend-otp', '/api/auth/resend-otp'], resendOtp);

router.post('/api/auth/forgot-password/init', initiateForgotPassword);
router.post('/api/auth/forgot-password/reset', resetPassword);

export default router;