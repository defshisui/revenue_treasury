// src/controllers/audit.controller.ts
import type { Request, Response } from 'express';
import pool from '../db.js';
import type { AuditBeaconBody } from '../types/index.js';

export async function recordAudit(
  req: Request,
  auditId: string,
  userEmail: string,
  userRole: string,
  moduleName: string,
  actionName: string,
  severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO',
  prevData: string | null = null,
  newData: string | null = null
): Promise<void> {
  try {
    const ipAddress =
      (req?.headers['x-forwarded-for'] as string) ||
      req?.socket?.remoteAddress ||
      'Unknown IP';
    const userAgent = req?.headers['user-agent'] || 'Unknown Agent';

    await pool.query(
      `INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [auditId, userEmail, userRole, moduleName, actionName, severity, ipAddress, userAgent, prevData, newData]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export async function getAuditLogs(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    const formatted = result.rows.map((row) => ({
      id: row.id.toString(),
      auditId: row.audit_id,
      user: row.user_email,
      role: row.user_role,
      module: row.module,
      action: row.action,
      severity: row.severity || 'INFO',
      ipAddress: row.ip_address || 'N/A',
      userAgent: row.user_agent || 'N/A',
      previousData: row.previous_data || '',
      newData: row.new_data || '',
      timestamp: new Date(row.timestamp).toLocaleString(),
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ message: 'Error loading audit logs' });
  }
}

export async function createBeaconAuditLog(req: Request, res: Response): Promise<void> {
  try {
    let logData: AuditBeaconBody = req.body;
    if (typeof logData === 'string') {
      try { logData = JSON.parse(logData); } catch { /* fallback */ }
    }

    const {
      auditId = 'AUD-' + Math.floor(100000 + Math.random() * 900000),
      user = 'Anonymous',
      role = 'User',
      module = 'Authentication',
      action = 'LOGOUT',
      severity = 'INFO',
      previousData = null,
      newData = null,
    } = logData || {};

    await recordAudit(req, auditId, user, role, module, action, severity as 'INFO' | 'WARNING' | 'CRITICAL', previousData ?? null, newData ?? null);
    res.status(200).json({ success: true, message: 'Audit log recorded via beacon.' });
  } catch (err) {
    console.error('Error saving beacon audit log:', err);
    res.status(500).json({ message: 'Failed to record audit log.' });
  }
}

export async function clearAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const clientIP = (req?.headers['x-forwarded-for'] as string) || req?.socket?.remoteAddress || 'Unknown';
    const clientAgent = req?.headers['user-agent'] || 'Unknown';

    await pool.query(
      `INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
       VALUES ('AUD-SYS-WIPE', 'system-admin@lgu.gov.ph', 'admin', 'System Security', 'AUDIT_LOGS_PURGED', 'CRITICAL', $1, $2, 'Table contained historical database records', 'Table records deleted via UI')`,
      [clientIP, clientAgent]
    );

    await pool.query("DELETE FROM audit_logs WHERE audit_id != 'AUD-SYS-WIPE';");
    res.status(200).json({ message: 'Audit logs successfully cleared and archived.' });
  } catch (err) {
    console.error('Error clearing audit logs:', err);
    res.status(500).json({ message: 'Failed to clear audit logs.' });
  }
}
