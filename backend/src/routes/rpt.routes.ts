import { Router } from 'express';

import { upload } from '../middleware/upload.js';
import { authenticateToken, optionalAuthToken } from '../middleware/auth.js';

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
  setRptPaymentLedgerArchive,
} from '../controllers/rpt.controller.js';

const router = Router();

router.get(
  '/citizen-rpt-applications',
  optionalAuthToken,
  getRptApplications
);


router.post(
  '/citizen-rpt-applications',
  optionalAuthToken,
  upload.any(),
  createRptApplication
);

router.delete(
  '/citizen-rpt-applications/:id',
  authenticateToken,
  deleteRptApplication
);

router.patch(
  '/citizen-rpt-applications/:id/status',
  authenticateToken,
  updateRptApplicationStatus
);

router.get('/api/rpt/search', searchRptByTdn);

router.get(
  '/lgu-rpt-records/search/:tdn',
  searchRptByTdn
);

router.get(
  '/lgu-rpt-records',
  getLguRptRecords
);

router.post(
  '/lgu-rpt-records',
  authenticateToken,
  createLguRptRecord
);

router.put(
  '/lgu-rpt-records/:id',
  authenticateToken,
  updateLguRptRecord
);

router.delete(
  '/lgu-rpt-records/:id',
  authenticateToken,
  deleteLguRptRecord
);

router.post(
  '/citizen-rpt-payments',
  createRptPayment
);

router.post(
  '/citizen-rpt-payments/group',
  createGroupRptPayment
);

router.get(
  '/citizen-rpt-payments',
  getRptPayments
);

router.patch(
  '/citizen-rpt-payments/:id/ledger-archive',
  authenticateToken,
  setRptPaymentLedgerArchive
);

export default router;