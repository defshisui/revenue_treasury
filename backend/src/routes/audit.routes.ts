import { Router } from 'express';
import { getAuditLogs, createBeaconAuditLog, clearAuditLogs } from '../controllers/audit.controller.js';

const router = Router();


router.get('/audit-logs', getAuditLogs);
router.post('/audit-logs', createBeaconAuditLog);
router.delete('/audit-logs', clearAuditLogs);


router.get('/admin/audit-logs', getAuditLogs);
router.post('/admin/audit-logs', createBeaconAuditLog);
router.delete('/admin/audit-logs', clearAuditLogs);

export default router;