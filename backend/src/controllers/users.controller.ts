import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import type { CreateUserBody } from '../types/index.js';
import { AntiFraudService } from '../services/antiFraud.service.js';

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    const formatted = result.rows.map((row) => ({
      id: row.id.toString(),
      fullname: row.name || 'System User',
      username: row.email,
      role: row.role || 'admin',

      status: row.status || 'Active',
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Error loading user records' });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const { fullname, username, password, role } = req.body as CreateUserBody;

  if (!fullname || !username || !password) {
    res.status(400).json({ message: 'Full name, username/email, and password are required.' });
    return;
  }

  try {
    const existing = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [username.trim()]);
    if (existing.rows.length > 0) {
      res.status(400).json({ message: 'A user with this email/username already exists.' });
      return;
    }


    const rawForwarded = req?.headers['x-forwarded-for'];
    const clientIP = typeof rawForwarded === 'string'
      ? rawForwarded.split(',')[0].trim()
      : (Array.isArray(rawForwarded) ? rawForwarded[0].trim() : (req?.ip || req?.socket?.remoteAddress || 'Unknown'));

    const fraudCheck = await AntiFraudService.evaluateRisk({
      ip: clientIP !== 'Unknown' ? clientIP : undefined,
      email: username.trim(),
      username: fullname.trim()
    });

    if (fraudCheck.isFraud) {
      console.warn(`[Anti-Fraud] Blocked account creation attempt for ${username.trim()}. Score: ${fraudCheck.score}`);

      const clientAgent = req?.headers['user-agent'] || 'Unknown';
      await pool.query(
        `INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
         VALUES ('AUD-FRAUD-BLOCK', $1, 'Unknown', 'User Management', 'ACCOUNT_CREATION_BLOCKED', 'CRITICAL', $2, $3, NULL, $4)`,
        [username.trim(), clientIP, clientAgent, `Blocked by Anti-Fraud AI. Score: ${fraudCheck.score}`]
      );
      res.status(403).json({ message: 'Account creation blocked by security policy. Please verify your details or contact support.' });
      return;
    }


    const hashedPassword = await bcrypt.hash(password.trim(), 12);

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active'`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, name, email, role, status`,
      [fullname.trim(), username.trim(), hashedPassword, role || 'treasury-staff', 'Active']
    );
    const newUser = result.rows[0];

    const clientAgent = req?.headers['user-agent'] || 'Unknown';
    await pool.query(
      `INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
       VALUES ('AUD-USER-ADD', 'system-admin@lgu.gov.ph', 'admin', 'User Management', 'USER_CREATED', 'WARNING', $1, $2, NULL, $3)`,
      [clientIP, clientAgent, `Created user account for ${newUser.email} with role ${newUser.role}. Risk Score: ${fraudCheck.score}`]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id.toString(),
        fullname: newUser.name,
        username: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (err: any) {
    console.error('[createUser] Error:', err?.message || err);
    console.error('[createUser] Stack:', err?.stack);
    res.status(500).json({ message: err?.message || 'Failed to create user in database.' });
  }
}


export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;


  if (!status || !['Active', 'ARCHIVED'].includes(status)) {
    res.status(400).json({ message: 'Invalid status. Must be Active or ARCHIVED.' });
    return;
  }

  try {

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const targetUser = userRes.rows[0];


    await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2',
      [status, id]
    );


    const clientIP = (req?.headers['x-forwarded-for'] as string) || req?.socket?.remoteAddress || 'Unknown';
    const clientAgent = req?.headers['user-agent'] || 'Unknown';
    const actionType = status === 'ARCHIVED' ? 'USER_ARCHIVED' : 'USER_RESTORED';
    const severity = status === 'ARCHIVED' ? 'CRITICAL' : 'WARNING';

    await pool.query(
      `INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
       VALUES ($1, 'system-admin@lgu.gov.ph', 'admin', 'User Management', $2, $3, $4, $5, $6, $7)`,
      [
        `AUD-${actionType}`,
        actionType,
        severity,
        clientIP,
        clientAgent,
        `Previous Status: ${targetUser.status || 'Active'}`,
        `New Status: ${status}`
      ]
    );

    res.status(200).json({ message: `User status successfully updated to ${status}.` });
  } catch (err) {
    console.error('Error updating user status:', err);
    res.status(500).json({ message: 'Failed to update user status in database.' });
  }
}


export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (userRes.rows.length === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const deletedUser = userRes.rows[0];


    await pool.query('DELETE FROM users WHERE id = $1', [id]);


    const clientIP = (req?.headers['x-forwarded-for'] as string) || req?.socket?.remoteAddress || 'Unknown';
    const clientAgent = req?.headers['user-agent'] || 'Unknown';

    await pool.query(
      `INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
       VALUES ('AUD-USER-DEL', 'system-admin@lgu.gov.ph', 'admin', 'User Management', 'USER_DELETED', 'CRITICAL', $1, $2, $3, NULL)`,
      [clientIP, clientAgent, `Deleted user account for ${deletedUser.email} (Role: ${deletedUser.role})`]
    );

    res.status(200).json({ message: 'User successfully deleted.' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Failed to delete user from database.' });
  }
}