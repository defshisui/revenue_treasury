import { Router } from 'express';

import { upload } from '../middleware/upload.js';

import {
  authenticateToken,
  optionalAuthToken,
} from '../middleware/auth.js';

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

  // Payment Ledger Archiver
  getRptPaymentLedgerArchives,
  archiveRptPaymentLedgerEntry,
  restoreRptPaymentLedgerEntry,
  deleteRptPaymentLedgerEntry,
} from '../controllers/rpt.controller.js';

const router = Router();


// ==========================================================
// RPT CITIZEN APPLICATIONS
// ==========================================================

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


// ==========================================================
// RPT SEARCH
// ==========================================================

// If this router is mounted with app.use('/api', rptRoutes),
// use '/rpt/search' rather than '/api/rpt/search'.

router.get(
  '/rpt/search',
  searchRptByTdn
);

router.get(
  '/lgu-rpt-records/search/:tdn',
  searchRptByTdn
);


// ==========================================================
// LGU RPT MASTER DATABASE
// ==========================================================

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


// ==========================================================
// RPT PAYMENTS
// ==========================================================

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


// ==========================================================
// PAYMENT LEDGER ARCHIVER
// ==========================================================

// Get archived payment ledger entries
router.get(
  '/rpt-payment-ledger-archives',
  authenticateToken,
  getRptPaymentLedgerArchives
);


// Archive an active payment ledger entry
router.post(
  '/rpt-payment-ledger-archives',
  authenticateToken,
  archiveRptPaymentLedgerEntry
);


// Restore an archived payment back to Active Ledger
router.delete(
  '/rpt-payment-ledger-archives/:key',
  authenticateToken,
  restoreRptPaymentLedgerEntry
);


// Delete an archived payment from the Archiver
router.delete(
  '/rpt-payment-ledger-archives/:key/permanent',
  authenticateToken,
  deleteRptPaymentLedgerEntry
);


export default router;