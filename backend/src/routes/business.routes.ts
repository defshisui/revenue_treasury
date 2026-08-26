// src/routes/business.routes.ts
import { Router } from 'express';
import multer from 'multer';
import {
    getBusinessAssessments,
    createSalesDeclaration,
    updateAssessmentStatus,
    deleteBusinessAssessment,
    verifyTaxBill,
    verifyOrNumber,
    createAppointment,
    getAppointments,
    updateAppointmentStatus,
    deleteAppointment // 👈 Ensure this is imported from your controller
} from '../controllers/business.controller.js';

// Use memoryStorage so file.buffer can be converted to base64 for previews[cite: 17]
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit[cite: 17]
});

const router = Router();

// Business Tax Assessments & Filings
router.get('/business-assessments', getBusinessAssessments);
router.get('/admin/business-assessments', getBusinessAssessments);

// Sales Declaration Submission with memory storage file upload middleware[cite: 17]
router.post('/business-assessments/sales-declaration', upload.single('financialStatement'), createSalesDeclaration);

// Admin Actions: Assessment Status Updates & Deletions[cite: 17]
router.patch('/admin/business-assessments/:id/status', updateAssessmentStatus);
router.delete('/admin/business-assessments/:id', deleteBusinessAssessment);

// Verification Gateways[cite: 17]
router.post('/verify/tax-bill', verifyTaxBill);
router.post('/verify/or-number', verifyOrNumber);

// Appointments Endpoints
router.post('/appointments', createAppointment);
router.get('/appointments', getAppointments);
router.get('/admin/appointments', getAppointments);
router.patch('/admin/appointments/:id/status', updateAppointmentStatus);
router.delete('/admin/appointments/:id', deleteAppointment); // 👈 Admin Delete Appointment Endpoint

export default router;