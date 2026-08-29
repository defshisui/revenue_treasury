import { Router } from 'express';
import { 
  getAuditLogs, 
  createBeaconAuditLog, 
  clearAuditLogs,
  toggleArchiveAuditLog,
  deleteSingleAuditLog
} from '../controllers/audit.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Note: POST /audit-logs intentionally left open — used by navigator.sendBeacon
// which cannot send custom Authorization headers
router.get('/audit-logs', authenticateToken, getAuditLogs);
router.post('/audit-logs', createBeaconAuditLog);
router.patch('/audit-logs/:id/archive', authenticateToken, toggleArchiveAuditLog);
router.delete('/audit-logs/:id', authenticateToken, deleteSingleAuditLog);
router.delete('/audit-logs', authenticateToken, clearAuditLogs);

router.get('/admin/audit-logs', authenticateToken, getAuditLogs);
router.post('/admin/audit-logs', createBeaconAuditLog);
router.patch('/admin/audit-logs/:id/archive', authenticateToken, toggleArchiveAuditLog);
router.delete('/admin/audit-logs/:id', authenticateToken, deleteSingleAuditLog);
router.delete('/admin/audit-logs', authenticateToken, clearAuditLogs);

export default router;