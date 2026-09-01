// src/controllers/admin.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper  get client IP
function getIP(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  return typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket?.remoteAddress || '127.0.0.1';
}

// ------------------------------------------------------------------
// GET /admin/profile   fetch current profile by email
// Body: { email }
// ------------------------------------------------------------------
export async function getAdminProfile(req: Request, res: Response): Promise<void> {
  const email = (req.query.email as string) || (req.body?.email as string);
  if (!email) { res.status(400).json({ message: 'email is required' }); return; }

  try {
    const result = await pool.query(
      'SELECT id, name, email, role, phone, department, address, avatar FROM users WHERE email ILIKE $1',
      [email.trim()]
    );
    if (result.rows.length === 0) { res.status(404).json({ message: 'User not found.' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[getAdminProfile]', err);
    res.status(500).json({ message: 'Server error fetching profile.' });
  }
}

// ------------------------------------------------------------------
// PATCH /admin/profile   update name, email, phone, department, address
// Body: { currentEmail, fullname, email, phone, department, address }
// ------------------------------------------------------------------
export async function updateAdminProfile(req: Request, res: Response): Promise<void> {
  const { currentEmail, fullname, email, phone, department, address } = req.body as {
    currentEmail: string; fullname: string; email: string;
    phone?: string; department?: string; address?: string;
  };

  if (!currentEmail || !fullname || !email) {
    res.status(400).json({ message: 'currentEmail, fullname and email are required.' });
    return;
  }

  try {
    // Ensure optional columns exist (safe migration)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);

    const existing = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [currentEmail.trim()]);
    if (existing.rows.length === 0) { res.status(404).json({ message: 'User not found.' }); return; }
    const user = existing.rows[0];

    // If email is changing, check no collision
    if (email.trim().toLowerCase() !== currentEmail.trim().toLowerCase()) {
      const collision = await pool.query('SELECT id FROM users WHERE email ILIKE $1 AND id <> $2', [email.trim(), user.id]);
      if (collision.rows.length > 0) {
        res.status(400).json({ message: 'Another account already uses that email address.' });
        return;
      }
    }

    await pool.query(
      `UPDATE users SET name = $1, email = $2, phone = $3, department = $4, address = $5 WHERE id = $6`,
      [fullname.trim(), email.trim(), phone || user.phone, department || user.department, address || user.address, user.id]
    );

    await recordAudit(
      req,
      'AUD-' + Math.floor(100000 + Math.random() * 900000),
      email.trim(), user.role || 'admin',
      'Profile Management', 'ADMIN_PROFILE_UPDATED', 'INFO',
      `Name: ${user.name}, Email: ${user.email}`,
      `Name: ${fullname}, Email: ${email}`
    );

    res.json({ message: 'Profile updated successfully.', user: { name: fullname, email, phone, department, address } });
  } catch (err) {
    console.error('[updateAdminProfile]', err);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
}

// ------------------------------------------------------------------
// PATCH /admin/change-password
// Body: { email, currentPassword, newPassword }
// ------------------------------------------------------------------
export async function changeAdminPassword(req: Request, res: Response): Promise<void> {
  const { email, currentPassword, newPassword } = req.body as {
    email: string; currentPassword: string; newPassword: string;
  };

  if (!email || !currentPassword || !newPassword) {
    res.status(400).json({ message: 'email, currentPassword and newPassword are required.' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ message: 'New password must be at least 8 characters.' });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [email.trim()]);
    if (result.rows.length === 0) { res.status(404).json({ message: 'User not found.' }); return; }
    const user = result.rows[0];

    const storedPassword = String(user.password).trim();
    const isBcrypt = storedPassword.startsWith('$2');
    const match = isBcrypt
      ? await bcrypt.compare(currentPassword.trim(), storedPassword)
      : storedPassword === currentPassword.trim();

    if (!match) {
      await recordAudit(
        req,
        'AUD-' + Math.floor(100000 + Math.random() * 900000),
        email, user.role || 'admin',
        'Authentication', 'PASSWORD_CHANGE_FAILED', 'WARNING',
        null, 'Incorrect current password supplied'
      );
      res.status(401).json({ message: 'Current password is incorrect.' });
      return;
    }

    const hashed = await bcrypt.hash(newPassword.trim(), 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);

    await recordAudit(
      req,
      'AUD-' + Math.floor(100000 + Math.random() * 900000),
      email, user.role || 'admin',
      'Authentication', 'PASSWORD_CHANGED', 'WARNING',
      null, 'Admin password successfully changed and re-hashed'
    );

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[changeAdminPassword]', err);
    res.status(500).json({ message: 'Server error changing password.' });
  }
}

// ------------------------------------------------------------------
// PATCH /admin/avatar
// Body: { email, avatar }   (avatar is a base64 data-URL string)
// ------------------------------------------------------------------
export async function updateAdminAvatar(req: Request, res: Response): Promise<void> {
  const { email, avatar } = req.body as { email?: string; avatar?: string };

  if (!email || !avatar) {
    res.status(400).json({ message: 'email and avatar (base64) are required.' });
    return;
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
    await pool.query('UPDATE users SET avatar = $1 WHERE email ILIKE $2', [avatar, email.trim()]);
    res.json({ message: 'Avatar updated successfully.' });
  } catch (err) {
    console.error('[updateAdminAvatar]', err);
    res.status(500).json({ message: 'Server error updating avatar.' });
  }
}
