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
router.post('/verify-login-otp', verifyLoginOtp);

router.post('/register-init', initiateRegister);
router.post('/verify-register-otp', verifyRegisterOtp);

router.post('/resend-otp', resendOtp);

router.post('/forgot-password/init', initiateForgotPassword);
router.post('/forgot-password/reset', resetPassword);

export default router;