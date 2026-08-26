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

router.get('/business-assessments', getBusinessAssessments);
router.get('/admin/business-assessments', getBusinessAssessments);
router.post('/business-assessments/sales-declaration', createSalesDeclaration);
router.patch('/admin/business-assessments/:id/status', updateAssessmentStatus);
router.post('/verify/tax-bill', verifyTaxBill);
router.post('/verify/or-number', verifyOrNumber);

export default router;