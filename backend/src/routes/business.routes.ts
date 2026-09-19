import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import {
  getBusinessAssessments,
  createSalesDeclaration,
  uploadBusinessComplianceDocuments,
  updateAssessmentStatus,
  deleteBusinessAssessment,
  verifyTaxBill,
  verifyOrNumber,
  createAppointment,
  getAppointments,
  updateAppointmentStatus,
  deleteAppointment,
} from '../controllers/business.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 20,
  },
});

const router = Router();

const staffOnly = (req: any, res: any, next: any) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (!['admin', 'treasury-staff', 'treasury_admin', 'staff', 'treasurer'].includes(role)) {
    res.status(403).json({ message: 'Treasury staff authorization is required.' });
    return;
  }
  next();
};

// Citizen assessment records are always scoped to the authenticated citizen.
router.get('/business-assessments', authenticateToken, getBusinessAssessments);

// Administrative assessment queue.
router.get('/admin/business-assessments', authenticateToken, staffOnly, getBusinessAssessments);

// Initial Business Tax filing / Sales Declaration.
router.post(
  '/business-assessments/sales-declaration',
  authenticateToken,
  upload.array('documents', 20),
  createSalesDeclaration
);

// Returned-for-compliance resubmission.
router.post(
  '/business-assessments/:id/compliance-documents',
  authenticateToken,
  upload.array('documents', 20),
  uploadBusinessComplianceDocuments
);

router.patch(
  '/admin/business-assessments/:id/status',
  authenticateToken,
  staffOnly,
  updateAssessmentStatus
);

router.delete(
  '/admin/business-assessments/:id',
  authenticateToken,
  staffOnly,
  deleteBusinessAssessment
);

// Public verification endpoints are intentionally separate from the citizen list endpoint.
router.post('/verify/tax-bill', verifyTaxBill);
router.post('/verify/or-number', verifyOrNumber);

router.post('/appointments', authenticateToken, createAppointment);
router.get('/appointments', authenticateToken, getAppointments);
router.get('/admin/appointments', authenticateToken, staffOnly, getAppointments);
router.patch('/admin/appointments/:id/status', authenticateToken, staffOnly, updateAppointmentStatus);
router.delete('/admin/appointments/:id', authenticateToken, staffOnly, deleteAppointment);

export default router;
