// src/routes/business.routes.ts
import { Router } from 'express';
import multer from 'multer';
import {
    getBusinessAssessments,
    createSalesDeclaration,
    updateAssessmentStatus,
    deleteBusinessAssessment,
    verifyTaxBill,
    verifyOrNumber
} from '../controllers/business.controller.js';

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit
const router = Router();

router.get('/business-assessments', getBusinessAssessments);
router.get('/admin/business-assessments', getBusinessAssessments);

// Sales Declaration Submission with file upload middleware[cite: 5]
router.post('/business-assessments/sales-declaration', upload.single('financialStatement'), createSalesDeclaration);

// Admin Actions: Status Updates & Deletions
router.patch('/admin/business-assessments/:id/status', updateAssessmentStatus);
router.delete('/admin/business-assessments/:id', deleteBusinessAssessment);

// Verification Gateways
router.post('/verify/tax-bill', verifyTaxBill);
router.post('/verify/or-number', verifyOrNumber);

export default router;