// src/routes/rpt.routes.ts
import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import {
  getRptApplications,
  createRptApplication,
  deleteRptApplication,
  updateRptApplicationStatus,
  searchRptByTdn,
  getLguRptRecords,
  createLguRptRecord,
  updateLguRptRecord,
  deleteLguRptRecord,
  createRptPayment,
  createGroupRptPayment,
  getRptPayments,
} from '../controllers/rpt.controller.js';

const router = Router();

// Citizen Applications
router.get('/citizen-rpt-applications', getRptApplications);
router.post('/citizen-rpt-applications', upload.any(), createRptApplication);
router.delete('/citizen-rpt-applications/:id', deleteRptApplication);
router.patch('/citizen-rpt-applications/:id/status', updateRptApplicationStatus);

// QC-style Tax Declaration Search & Group Properties
router.get('/api/rpt/search', searchRptByTdn);
router.get('/lgu-rpt-records/search/:tdn', searchRptByTdn);

// LGU Master Property Assessment Records
router.get('/lgu-rpt-records', getLguRptRecords);
router.post('/lgu-rpt-records', createLguRptRecord);
router.put('/lgu-rpt-records/:id', updateLguRptRecord);
router.delete('/lgu-rpt-records/:id', deleteLguRptRecord);

// Payments & Group Settlements
router.post('/citizen-rpt-payments', createRptPayment);
router.post('/citizen-rpt-payments/group', createGroupRptPayment);
router.get('/citizen-rpt-payments', getRptPayments);

export default router;