// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import type { LoginBody } from '../types/index.js';

const loginAttemptsTracker = new Map<string, { count: number; lockUntil: number }>();
const LOCKOUT_LIMIT = 5;
const LOCKOUT_DURATION_SECONDS = 60;

function handleFailedAttempt(
  req: Request,
  email: string,
  trackingData: { count: number; lockUntil: number },
  currentTime: number,
  res: Response
): void {
  trackingData.count += 1;
  if (trackingData.count >= LOCKOUT_LIMIT) {
    trackingData.lockUntil = currentTime + LOCKOUT_DURATION_SECONDS * 1000;
    loginAttemptsTracker.set(email, trackingData);
    res.status(429).json({
      message: 'Too many failed attempts.',
      retryAfterSeconds: LOCKOUT_DURATION_SECONDS,
    });
  } else {
    loginAttemptsTracker.set(email, trackingData);
    res.status(400).json({ message: 'Invalid credentials.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, rememberMe } = req.body as LoginBody;
  const auditId = 'AUD-' + Math.floor(100000 + Math.random() * 900000);

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  const currentTime = Date.now();
  const trackingData = loginAttemptsTracker.get(email) || { count: 0, lockUntil: 0 };

  if (trackingData.lockUntil > currentTime) {
    const remainingSeconds = Math.ceil((trackingData.lockUntil - currentTime) / 1000);
    await recordAudit(req, auditId, email, 'Unknown', 'Authentication', 'LOGIN_LOCKED_OUT', 'CRITICAL', null, `Locked for ${remainingSeconds}s`);
    res.status(429).json({ message: 'Too many failed login attempts.', retryAfterSeconds: remainingSeconds });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [email.trim()]);

    if (result.rows.length === 0) {
      await recordAudit(req, auditId, email, 'Unknown', 'Authentication', 'LOGIN_FAILED', 'WARNING', null, 'User not found');
      handleFailedAttempt(req, email, trackingData, currentTime, res);
      return;
    }

    const user = result.rows[0];

    // Support both bcrypt hashed and legacy plain-text passwords
    const storedPassword = String(user.password).trim();
    const isBcrypt = storedPassword.startsWith('$2');
    const passwordMatch = isBcrypt
      ? await bcrypt.compare(password.trim(), storedPassword)
      : storedPassword === String(password).trim();

    if (!passwordMatch) {
      await recordAudit(req, auditId, email, user.role || 'admin', 'Authentication', 'LOGIN_FAILED', 'WARNING', null, 'Incorrect password');
      handleFailedAttempt(req, email, trackingData, currentTime, res);
      return;
    }

    loginAttemptsTracker.delete(email);
    await recordAudit(req, auditId, user.email, user.role || 'admin', 'Authentication', 'LOGIN_SUCCESS', 'INFO', null, `Successful session init (RememberMe: ${rememberMe})`);

    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullname: user.name,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}
