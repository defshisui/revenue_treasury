import { Router } from 'express';
import { 
  getAuditLogs, 
  createBeaconAuditLog, 
  clearAuditLogs,
  toggleArchiveAuditLog,
  deleteSingleAuditLog
} from '../controllers/audit.controller.js';

const router = Router();

router.get('/audit-logs', getAuditLogs);
router.post('/audit-logs', createBeaconAuditLog);
router.patch('/audit-logs/:id/archive', toggleArchiveAuditLog);
router.delete('/audit-logs/:id', deleteSingleAuditLog);
router.delete('/audit-logs', clearAuditLogs);

router.get('/admin/audit-logs', getAuditLogs);
router.post('/admin/audit-logs', createBeaconAuditLog);
router.patch('/admin/audit-logs/:id/archive', toggleArchiveAuditLog);
router.delete('/admin/audit-logs/:id', deleteSingleAuditLog);
router.delete('/admin/audit-logs', clearAuditLogs);

export default router;