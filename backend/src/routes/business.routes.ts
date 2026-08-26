import { Router } from 'express';
import multer from 'multer';
import {
    getBusinessAssessments,
    createSalesDeclaration,
    updateAssessmentStatus,
    verifyTaxBill,
    verifyOrNumber
} from '../controllers/business.controller.js';

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit
const router = Router();

router.get('/business-assessments', getBusinessAssessments);
router.get('/admin/business-assessments', getBusinessAssessments);

// 👈 Add upload.single('financialStatement') middleware here
router.post('/business-assessments/sales-declaration', upload.single('financialStatement'), createSalesDeclaration);

router.patch('/admin/business-assessments/:id/status', updateAssessmentStatus);
router.post('/verify/tax-bill', verifyTaxBill);
router.post('/verify/or-number', verifyOrNumber);

export default router;