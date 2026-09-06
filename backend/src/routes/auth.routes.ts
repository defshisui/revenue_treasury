import { Router } from 'express';
import {
  login,
  verifyLoginOtp,
  initiateRegister,
  verifyRegisterOtp,
  resendOtp,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/auth/verify-login-otp', verifyLoginOtp);

router.post('/auth/register-init', initiateRegister);
router.post('/auth/verify-register-otp', verifyRegisterOtp);

router.post('/auth/resend-otp', resendOtp);

export default router;
