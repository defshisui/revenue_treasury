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
    deleteAppointment
} from '../controllers/business.controller.js';


const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

const router = Router();

router.get('/business-assessments', getBusinessAssessments);
router.get('/admin/business-assessments', getBusinessAssessments);


router.post('/business-assessments/sales-declaration', upload.single('financialStatement'), createSalesDeclaration);


router.patch('/admin/business-assessments/:id/status', updateAssessmentStatus);
router.delete('/admin/business-assessments/:id', deleteBusinessAssessment);


router.post('/verify/tax-bill', verifyTaxBill);
router.post('/verify/or-number', verifyOrNumber);


router.post('/appointments', createAppointment);
router.get('/appointments', getAppointments);
router.get('/admin/appointments', getAppointments);
router.patch('/admin/appointments/:id/status', updateAppointmentStatus);
router.delete('/admin/appointments/:id', deleteAppointment);

export default router;