// src/controllers/users.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import type { CreateUserBody } from '../types/index.js';

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    const formatted = result.rows.map((row) => ({
      id: row.id.toString(),
      fullname: row.name || 'System User',
      username: row.email,
      role: row.role || 'admin',
      status: 'Active',
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

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password.trim(), 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, role`,
      [fullname.trim(), username.trim(), hashedPassword, role || 'treasury-staff']
    );
    const newUser = result.rows[0];

    const clientIP = (req?.headers['x-forwarded-for'] as string) || req?.socket?.remoteAddress || 'Unknown';
    const clientAgent = req?.headers['user-agent'] || 'Unknown';
    await pool.query(
      `INSERT INTO audit_logs (audit_id, user_email, user_role, module, action, severity, ip_address, user_agent, previous_data, new_data)
       VALUES ('AUD-USER-ADD', 'system-admin@lgu.gov.ph', 'admin', 'User Management', 'USER_CREATED', 'WARNING', $1, $2, NULL, $3)`,
      [clientIP, clientAgent, `Created user account for ${newUser.email} with role ${newUser.role}`]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id.toString(),
        fullname: newUser.name,
        username: newUser.email,
        role: newUser.role,
        status: 'Active',
      },
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'Failed to create user in database.' });
  }
}

// NEW: Delete User Function
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    // 1. Fetch the user first so we can log who was deleted
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (userRes.rows.length === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const deletedUser = userRes.rows[0];

    // 2. Delete the user from the database
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    // 3. Log the deletion to the audit trail
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