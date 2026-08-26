// src/routes/business.routes.ts
import { Router } from 'express';
import {
    getBusinessAssessments,
    createSalesDeclaration,
    updateAssessmentStatus,
    verifyTaxBill,
    verifyOrNumber
} from '../controllers/business.controller.js';

const router = Router();

// Citizen & Admin Assessment Queries
router.get('/business-assessments', getBusinessAssessments);
router.get('/admin/business-assessments', getBusinessAssessments);

// Sales Declaration Submission (Must be POST)
router.post('/business-assessments/sales-declaration', createSalesDeclaration);

// Administrative Approvals & Status Updates
router.patch('/admin/business-assessments/:id/status', updateAssessmentStatus);

// Verification Gateways
router.post('/verify/tax-bill', verifyTaxBill);
router.post('/verify/or-number', verifyOrNumber);

export default router;