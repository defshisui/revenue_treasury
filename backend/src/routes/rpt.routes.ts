// src/routes/rpt.routes.ts
import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import {
  getRptApplications,
  createRptApplication,
  getLguRptRecords,
  createRptPayment,
  deleteRptApplication, // 1. Import this
} from '../controllers/rpt.controller.js';

const router = Router();

router.get('/citizen-rpt-applications', getRptApplications);
router.post('/citizen-rpt-applications', upload.any(), createRptApplication);
router.delete('/citizen-rpt-applications/:id', deleteRptApplication); // 2. Add this route
router.get('/lgu-rpt-records', getLguRptRecords);
router.post('/citizen-rpt-payments', createRptPayment);

export default router;