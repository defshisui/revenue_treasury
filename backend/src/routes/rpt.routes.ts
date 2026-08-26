// src/routes/rpt.routes.ts
import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import {
  getRptApplications,
  createRptApplication,
  getLguRptRecords,
  createRptPayment,
} from '../controllers/rpt.controller.js';

const router = Router();

router.get('/citizen-rpt-applications', getRptApplications);
router.post('/citizen-rpt-applications', upload.any(), createRptApplication);
router.get('/lgu-rpt-records', getLguRptRecords);
router.post('/citizen-rpt-payments', createRptPayment);

export default router;
