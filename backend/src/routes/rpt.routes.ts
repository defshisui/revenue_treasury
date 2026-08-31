// src/routes/rpt.routes.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
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

// Wrap multer so upload errors (e.g. FileTooLarge) return a clean JSON 400
// instead of an unhandled crash that sends an empty/HTML response body.
function uploadAny(req: Request, res: Response, next: NextFunction) {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ message: `File upload error: ${err.message}` });
      return;
    }
    if (err) {
      res.status(400).json({ message: `Upload failed: ${(err as Error).message || err}` });
      return;
    }
    next();
  });
}

// Citizen Applications
router.get('/citizen-rpt-applications', getRptApplications);
router.post('/citizen-rpt-applications', uploadAny, createRptApplication);
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