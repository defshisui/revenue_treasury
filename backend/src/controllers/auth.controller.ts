import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import type { LoginBody } from '../types/index.js';
import { EmailService } from '../services/email.service.js';
import { AntiFraudService } from '../services/antiFraud.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'municipal-treasury-secret-key-9988';

const loginAttemptsTracker = new Map<string, { count: number; lockUntil: number }>();
const LOCKOUT_LIMIT = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 5;

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password)
  );
}

function handleFailedPasswordAttempt(
  email: string,
  trackingData: { count: number; lockUntil: number },
  currentTime: number,
  res: Response
): void {
  trackingData.count += 1;

  if (trackingData.count >= LOCKOUT_LIMIT) {
    trackingData.lockUntil =
      currentTime + LOCKOUT_DURATION_SECONDS * 1000;

    loginAttemptsTracker.set(email, trackingData);

    res.status(429).json({
      message: 'Too many failed login attempts.',
      retryAfterSeconds: LOCKOUT_DURATION_SECONDS,
    });
  } else {
    loginAttemptsTracker.set(email, trackingData);

    res.status(400).json({
      message: 'Invalid credentials.',
    });
  }
}

export async function login(
  req: Request,
  res: Response
): Promise<void> {
  const { email, password, rememberMe } =
    req.body as LoginBody;

  const auditId =
    'AUD-' +
    Math.floor(100000 + Math.random() * 900000);

  if (!email || !password) {
    res.status(400).json({
      message: 'Email and password are required.',
    });
    return;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  const currentTime = Date.now();

  const trackingData =
    loginAttemptsTracker.get(normalizedEmail) || {
      count: 0,
      lockUntil: 0,
    };

  if (trackingData.lockUntil > currentTime) {
    const remainingSeconds = Math.ceil(
      (trackingData.lockUntil - currentTime) / 1000
    );

    await recordAudit(
      req,
      auditId,
      normalizedEmail,
      'Unknown',
      'Authentication',
      'LOGIN_LOCKED_OUT',
      'CRITICAL',
      null,
      `Locked for ${remainingSeconds}s`
    );

    res.status(429).json({
      message: 'Too many failed login attempts.',
      retryAfterSeconds: remainingSeconds,
    });

    return;
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email ILIKE $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      await recordAudit(
        req,
        auditId,
        normalizedEmail,
        'Unknown',
        'Authentication',
        'LOGIN_FAILED',
        'WARNING',
        null,
        'User not found'
      );

      handleFailedPasswordAttempt(
        normalizedEmail,
        trackingData,
        currentTime,
        res
      );

      return;
    }

    const user = result.rows[0];

    if (user.status === 'ARCHIVED' || user.status === 'Inactive') {
      res.status(403).json({
        message: 'This account has been archived. Access is revoked.',
      });
      return;
    }

    const storedPassword =
      String(user.password).trim();

    const isBcrypt =
      storedPassword.startsWith('$2');

    const passwordMatch = isBcrypt
      ? await bcrypt.compare(
        password.trim(),
        storedPassword
      )
      : storedPassword ===
      String(password).trim();

    if (!passwordMatch) {
      await recordAudit(
        req,
        auditId,
        normalizedEmail,
        user.role || 'admin',
        'Authentication',
        'LOGIN_FAILED',
        'WARNING',
        null,
        'Incorrect password'
      );

      handleFailedPasswordAttempt(
        normalizedEmail,
        trackingData,
        currentTime,
        res
      );

      return;
    }

    loginAttemptsTracker.delete(
      normalizedEmail
    );

    const plainOtp =
      Math.floor(
        100000 + Math.random() * 900000
      ).toString();

    const otpHash =
      await bcrypt.hash(plainOtp, 10);

    const expiresAt = new Date(
      Date.now() +
      OTP_EXPIRY_MINUTES * 60 * 1000
    );

    await pool.query(
      `UPDATE otp_verifications
       SET used = true
       WHERE email ILIKE $1
       AND purpose = 'LOGIN'
       AND used = false`,
      [normalizedEmail]
    );

    await pool.query(
      `INSERT INTO otp_verifications
       (user_id, email, otp_hash, purpose, expires_at, attempts, used, created_at)
       VALUES ($1, $2, $3, 'LOGIN', $4, 0, false, NOW())`,
      [
        user.id,
        normalizedEmail,
        otpHash,
        expiresAt,
      ]
    );

    await EmailService.sendOtpEmail(
      normalizedEmail,
      plainOtp,
      'LOGIN'
    );

    await recordAudit(
      req,
      auditId,
      user.email,
      user.role || 'citizen',
      'Authentication',
      'LOGIN_OTP_SENT',
      'INFO',
      null,
      'Login OTP dispatched via Nodemailer'
    );

    res.status(200).json({
      message:
        'Verification code sent to your email.',
      requireOtp: true,
      email: normalizedEmail,
      rememberMe: Boolean(rememberMe),
    });
  } catch (error: any) {
    console.error('Login Error:', error);

    res.status(500).json({
      message:
        error?.message ||
        'Failed to process login authentication.',
    });
  }
}

export async function verifyLoginOtp(
  req: Request,
  res: Response
): Promise<void> {
  const {
    email,
    otp,
    rememberMe,
  } = req.body;

  const auditId =
    'AUD-' +
    Math.floor(100000 + Math.random() * 900000);

  if (!email || !otp) {
    res.status(400).json({
      message:
        'Email and 6-digit verification code are required.',
    });

    return;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  const inputOtp =
    String(otp).trim();

  try {
    const otpRes = await pool.query(
      `SELECT * FROM otp_verifications
       WHERE email ILIKE $1
       AND purpose = 'LOGIN'
       AND used = false
       ORDER BY id DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    if (otpRes.rows.length === 0) {
      res.status(400).json({
        message:
          'No active verification code found. Please request a new code.',
      });

      return;
    }

    const otpRecord = otpRes.rows[0];

    if (
      new Date(otpRecord.expires_at).getTime() <
      Date.now()
    ) {
      await pool.query(
        'UPDATE otp_verifications SET used = true WHERE id = $1',
        [otpRecord.id]
      );

      res.status(400).json({
        message:
          'Verification code has expired. Please request a new one.',
      });

      return;
    }

    if (otpRecord.attempts >= 5) {
      await pool.query(
        'UPDATE otp_verifications SET used = true WHERE id = $1',
        [otpRecord.id]
      );

      res.status(429).json({
        message:
          'Maximum verification attempts exceeded. Please request a new code.',
      });

      return;
    }

    const isOtpValid =
      await bcrypt.compare(
        inputOtp,
        otpRecord.otp_hash
      );

    if (!isOtpValid) {
      const newAttempts =
        otpRecord.attempts + 1;

      await pool.query(
        'UPDATE otp_verifications SET attempts = $1 WHERE id = $2',
        [
          newAttempts,
          otpRecord.id,
        ]
      );

      await recordAudit(
        req,
        auditId,
        normalizedEmail,
        'Unknown',
        'Authentication',
        'LOGIN_OTP_FAILED',
        'WARNING',
        null,
        `Failed OTP attempt ${newAttempts}/5`
      );

      const remaining =
        Math.max(
          0,
          5 - newAttempts
        );

      res.status(400).json({
        message:
          `Invalid verification code. Attempts remaining: ${remaining}`,
        remainingAttempts:
          remaining,
      });

      return;
    }

    await pool.query(
      'UPDATE otp_verifications SET used = true WHERE id = $1',
      [otpRecord.id]
    );

    const userRes = await pool.query(
      'SELECT * FROM users WHERE email ILIKE $1',
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        message:
          'User account not found.',
      });

      return;
    }

    const user = userRes.rows[0];

    if (user.status === 'ARCHIVED' || user.status === 'Inactive') {
      res.status(403).json({
        message: 'This account has been archived. Access is revoked.',
      });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role:
          user.role || 'citizen',
      },
      JWT_SECRET,
      {
        expiresIn:
          rememberMe
            ? '7d'
            : '24h',
      }
    );

    await recordAudit(
      req,
      auditId,
      user.email,
      user.role || 'citizen',
      'Authentication',
      'LOGIN_SUCCESS',
      'INFO',
      null,
      `Signed in via 2FA Email OTP (RememberMe: ${rememberMe})`
    );

    const sessionId = 'sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);

    const rawForwarded = req.headers['x-forwarded-for'];
    const clientIP = typeof rawForwarded === 'string'
      ? rawForwarded.split(',')[0].trim()
      : (Array.isArray(rawForwarded) ? rawForwarded[0].trim() : (req.ip || '127.0.0.1'));
    const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';

    let browserInfo = 'Web Browser';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browserInfo = 'Chrome';
    else if (userAgent.includes('Edg')) browserInfo = 'Edge';
    else if (userAgent.includes('Firefox')) browserInfo = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browserInfo = 'Safari';

    if (userAgent.includes('Windows')) browserInfo += ' on Windows';
    else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) browserInfo += ' on macOS';
    else if (userAgent.includes('Android')) browserInfo += ' on Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) browserInfo += ' on iOS';

    const cityLocation = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === 'Unknown'
      ? 'Quezon City, PH (Local Network)'
      : `Quezon City, PH (IP: ${clientIP})`;

    const loginTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    try {
      // Check if user already has an active session
      const existingSessionRes = await pool.query(
        `SELECT * FROM user_sessions
         WHERE user_id = $1 AND status = 'ACTIVE' AND last_heartbeat > NOW() - INTERVAL '30 minutes'`,
        [user.id]
      );

      if (existingSessionRes.rows.length > 0) {
        // Record concurrent login alert for the currently logged in user to review
        const alertId = 'cla_' + Math.random().toString(36).substring(2, 10);
        await pool.query(
          `INSERT INTO concurrent_login_alerts (id, user_id, user_email, new_session_id, login_time, browser_info, city_location, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW())`,
          [alertId, user.id, user.email, sessionId, loginTime, browserInfo, cityLocation]
        );
      }

      await pool.query(
        `INSERT INTO user_sessions (user_id, session_id, token, device_info, ip_address, city_location, status, created_at, last_heartbeat)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())`,
        [user.id, sessionId, token, browserInfo, clientIP, cityLocation]
      );

      await pool.query(
        `UPDATE users
         SET last_login = NOW(), last_active_at = NOW(), is_logged_in = TRUE, current_session_id = $2
         WHERE id = $1`,
        [user.id, sessionId]
      );
    } catch (sessionErr) {
      console.error('Failed to register session or check concurrent login:', sessionErr);
    }

    res.status(200).json({
      message:
        'Sign-in verified successfully!',
      token,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullname: user.name,
        avatar:
          user.avatar || null,
      },
    });
  } catch (error: any) {
    console.error(
      'Verify Login OTP Error:',
      error
    );

    res.status(500).json({
      message:
        'Failed to verify verification code.',
    });
  }
}

export async function initiateRegister(
  req: Request,
  res: Response
): Promise<void> {
  const {
    email,
    password,
    firstName,
    middleName,
    lastName,
    suffix,
    birthDate,
    houseNoStreet,
    barangay,
    city,
    occupation,
    sex,
    mobileNumber,
    role = 'citizen',
  } = req.body;

  if (
    !email ||
    !password ||
    !firstName ||
    !lastName ||
    !birthDate ||
    !houseNoStreet ||
    !barangay ||
    !city ||
    !mobileNumber
  ) {
    res.status(400).json({
      message:
        'Please provide all required registration information.',
    });

    return;
  }

  if (!isStrongPassword(String(password))) {
    res.status(400).json({
      message:
        'Password must have at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
    });

    return;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  try {
    const existing =
      await pool.query(
        'SELECT id FROM users WHERE email ILIKE $1',
        [normalizedEmail]
      );

    if (existing.rows.length > 0) {
      res.status(400).json({
        message:
          'A user account with this email address already exists.',
      });

      return;
    }

    const rawForwarded =
      req?.headers['x-forwarded-for'];

    const clientIP =
      typeof rawForwarded === 'string'
        ? rawForwarded
          .split(',')[0]
          .trim()
        : Array.isArray(rawForwarded)
          ? rawForwarded[0].trim()
          : req?.ip ||
          req?.socket?.remoteAddress ||
          'Unknown';

    const fraudCheck =
      await AntiFraudService.evaluateRisk({
        ip:
          clientIP !== 'Unknown'
            ? clientIP
            : undefined,
        email: normalizedEmail,
        username:
          `${firstName} ${lastName}`.trim(),
      });

    if (fraudCheck.isFraud) {
      console.warn(
        `[Anti-Fraud] Blocked registration attempt for ${normalizedEmail}. Score: ${fraudCheck.score}`
      );

      res.status(403).json({
        message:
          'Registration blocked by security policy. Please contact treasury support.',
      });

      return;
    }

    const hashedPassword =
      await bcrypt.hash(
        String(password).trim(),
        12
      );

    const plainOtp =
      Math.floor(
        100000 + Math.random() * 900000
      ).toString();

    const otpHash =
      await bcrypt.hash(
        plainOtp,
        10
      );

    const expiresAt =
      new Date(
        Date.now() +
        OTP_EXPIRY_MINUTES *
        60 *
        1000
      );

    const pendingPayload = {
      fullname:
        `${firstName} ${lastName}`.trim(),

      email:
        normalizedEmail,

      password:
        hashedPassword,

      role:
        role || 'citizen',

      citizenData: {
        firstName,
        middleName:
          middleName || '',
        lastName,
        suffix:
          suffix || '',
        birthDate,
        houseNoStreet,
        barangay,
        city,
        occupation:
          occupation || '',
        sex:
          sex || 'Male',
        mobileNumber,
      },
    };

    await pool.query(
      `UPDATE otp_verifications
       SET used = true
       WHERE email ILIKE $1
       AND purpose = 'REGISTER'
       AND used = false`,
      [normalizedEmail]
    );

    await pool.query(
      `INSERT INTO otp_verifications
       (user_id, email, otp_hash, purpose, expires_at, attempts, used, payload, created_at)
       VALUES (NULL, $1, $2, 'REGISTER', $3, 0, false, $4, NOW())`,
      [
        normalizedEmail,
        otpHash,
        expiresAt,
        JSON.stringify(
          pendingPayload
        ),
      ]
    );

    await EmailService.sendOtpEmail(
      normalizedEmail,
      plainOtp,
      'REGISTER'
    );

    res.status(200).json({
      message:
        'Verification code sent to your email.',
      requireOtp: true,
      email:
        normalizedEmail,
    });
  } catch (error: any) {
    console.error(
      'Initiate Register Error:',
      error
    );

    res.status(500).json({
      message:
        error?.message ||
        'Failed to initiate registration verification.',
    });
  }
}

export async function verifyRegisterOtp(
  req: Request,
  res: Response
): Promise<void> {
  const {
    email,
    otp,
  } = req.body;

  const auditId =
    'AUD-' +
    Math.floor(
      100000 +
      Math.random() *
      900000
    );

  if (!email || !otp) {
    res.status(400).json({
      message:
        'Email and 6-digit verification code are required.',
    });

    return;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  const inputOtp =
    String(otp).trim();

  const client =
    await pool.connect();

  try {
    const otpRes =
      await client.query(
        `SELECT * FROM otp_verifications
         WHERE email ILIKE $1
         AND purpose = 'REGISTER'
         AND used = false
         ORDER BY id DESC
         LIMIT 1`,
        [normalizedEmail]
      );

    if (otpRes.rows.length === 0) {
      res.status(400).json({
        message:
          'No active registration verification code found. Please restart registration.',
      });

      return;
    }

    const otpRecord =
      otpRes.rows[0];

    if (
      new Date(
        otpRecord.expires_at
      ).getTime() <
      Date.now()
    ) {
      await client.query(
        'UPDATE otp_verifications SET used = true WHERE id = $1',
        [otpRecord.id]
      );

      res.status(400).json({
        message:
          'Verification code has expired. Please request a new code.',
      });

      return;
    }

    if (
      otpRecord.attempts >= 5
    ) {
      await client.query(
        'UPDATE otp_verifications SET used = true WHERE id = $1',
        [otpRecord.id]
      );

      res.status(429).json({
        message:
          'Maximum verification attempts exceeded. Please restart registration.',
      });

      return;
    }

    const isOtpValid =
      await bcrypt.compare(
        inputOtp,
        otpRecord.otp_hash
      );

    if (!isOtpValid) {
      const newAttempts =
        otpRecord.attempts + 1;

      await client.query(
        'UPDATE otp_verifications SET attempts = $1 WHERE id = $2',
        [
          newAttempts,
          otpRecord.id,
        ]
      );

      const remaining =
        Math.max(
          0,
          5 - newAttempts
        );

      res.status(400).json({
        message:
          `Invalid verification code. Attempts remaining: ${remaining}`,
        remainingAttempts:
          remaining,
      });

      return;
    }

    const payload =
      typeof otpRecord.payload ===
        'string'
        ? JSON.parse(
          otpRecord.payload
        )
        : otpRecord.payload;

    if (
      !payload ||
      !payload.citizenData
    ) {
      res.status(400).json({
        message:
          'Corrupted registration session. Please restart registration.',
      });

      return;
    }

    if (
      !payload.password ||
      typeof payload.password !==
      'string'
    ) {
      await client.query(
        'UPDATE otp_verifications SET used = true WHERE id = $1',
        [otpRecord.id]
      );

      res.status(400).json({
        message:
          'Invalid registration password. Please restart registration.',
      });

      return;
    }

    await client.query(
      'BEGIN'
    );

    await client.query(
      'UPDATE otp_verifications SET used = true WHERE id = $1',
      [otpRecord.id]
    );

    const checkUser =
      await client.query(
        'SELECT id FROM users WHERE email ILIKE $1',
        [normalizedEmail]
      );

    if (
      checkUser.rows.length > 0
    ) {
      await client.query(
        'ROLLBACK'
      );

      res.status(400).json({
        message:
          'A user account with this email already exists.',
      });

      return;
    }

    const userRes =
      await client.query(
        `INSERT INTO users
         (name, email, password, role, status, is_verified, created_at)
         VALUES ($1, $2, $3, $4, 'Active', true, NOW())
         RETURNING id, name, email, role, status`,
        [
          payload.fullname,
          normalizedEmail,
          payload.password,
          payload.role ||
          'citizen',
        ]
      );

    const newUser =
      userRes.rows[0];

    const c =
      payload.citizenData;

    await client.query(
      `INSERT INTO citizens
       (user_id, first_name, middle_name, last_name, suffix, birth_date, house_no_street, barangay, city, occupation, sex, mobile_number, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        newUser.id,
        c.firstName,
        c.middleName || '',
        c.lastName,
        c.suffix || '',
        c.birthDate,
        c.houseNoStreet,
        c.barangay,
        c.city,
        c.occupation || '',
        c.sex || 'Male',
        c.mobileNumber,
      ]
    );

    await client.query(
      'COMMIT'
    );

    await recordAudit(
      req,
      auditId,
      normalizedEmail,
      'citizen',
      'User Management',
      'USER_REGISTERED_VERIFIED',
      'INFO',
      null,
      'Citizen registered and email verified via OTP'
    );

    res.status(201).json({
      message:
        'Registration and email verification successful! You can now sign in.',
      user: {
        id: newUser.id,
        email:
          newUser.email,
        fullname:
          newUser.name,
      },
    });
  } catch (error: any) {
    await client.query(
      'ROLLBACK'
    );

    console.error(
      'Verify Register OTP Error:',
      error
    );

    res.status(500).json({
      message:
        error?.message ||
        'Failed to complete verified registration.',
    });
  } finally {
    client.release();
  }
}

export async function resendOtp(
  req: Request,
  res: Response
): Promise<void> {
  const {
    email,
    purpose,
  } = req.body;

  if (
    !email ||
    !purpose ||
    !['LOGIN', 'REGISTER', 'FORGOT_PASSWORD'].includes(
      purpose
    )
  ) {
    res.status(400).json({
      message:
        'Email and valid purpose (LOGIN, REGISTER, or FORGOT_PASSWORD) are required.',
    });

    return;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  try {
    const recentRes =
      await pool.query(
        `SELECT * FROM otp_verifications
         WHERE email ILIKE $1
         AND purpose = $2
         ORDER BY id DESC
         LIMIT 1`,
        [
          normalizedEmail,
          purpose,
        ]
      );

    if (
      recentRes.rows.length >
      0
    ) {
      const recent =
        recentRes.rows[0];

      const elapsedSeconds =
        Math.floor(
          (Date.now() -
            new Date(
              recent.created_at
            ).getTime()) /
          1000
        );

      const remainingCooldown =
        OTP_RESEND_COOLDOWN_SECONDS -
        elapsedSeconds;

      if (
        remainingCooldown > 0
      ) {
        res.status(429).json({
          message:
            `Please wait ${remainingCooldown} seconds before requesting a new code.`,
          retryAfterSeconds:
            remainingCooldown,
        });

        return;
      }
    }

    await pool.query(
      `UPDATE otp_verifications
       SET used = true
       WHERE email ILIKE $1
       AND purpose = $2
       AND used = false`,
      [
        normalizedEmail,
        purpose,
      ]
    );

    const plainOtp =
      Math.floor(
        100000 +
        Math.random() *
        900000
      ).toString();

    const otpHash =
      await bcrypt.hash(
        plainOtp,
        10
      );

    const expiresAt =
      new Date(
        Date.now() +
        OTP_EXPIRY_MINUTES *
        60 *
        1000
      );

    const payloadToKeep =
      recentRes.rows[0]
        ?.payload || null;

    const userIdToKeep =
      recentRes.rows[0]
        ?.user_id || null;

    await pool.query(
      `INSERT INTO otp_verifications
       (user_id, email, otp_hash, purpose, expires_at, attempts, used, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, false, $6, NOW())`,
      [
        userIdToKeep,
        normalizedEmail,
        otpHash,
        purpose,
        expiresAt,
        payloadToKeep,
      ]
    );

    await EmailService.sendOtpEmail(
      normalizedEmail,
      plainOtp,
      purpose as
      | 'LOGIN'
      | 'REGISTER'
      | 'FORGOT_PASSWORD'
    );

    res.status(200).json({
      message:
        'A new verification code has been sent to your email.',
      retryAfterSeconds:
        OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (error: any) {
    console.error(
      'Resend OTP Error:',
      error
    );

    res.status(500).json({
      message:
        error?.message ||
        'Failed to resend verification code.',
    });
  }
}

export async function initiateForgotPassword(
  req: Request,
  res: Response
): Promise<void> {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({
      message: 'Email address is required.',
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const genericResponse = {
    message:
      'If an account exists for that email, a verification code has been sent.',
  };

  try {
    const userRes = await pool.query(
      'SELECT * FROM users WHERE email ILIKE $1',
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      // Do not reveal whether the email is registered.
      res.status(200).json(genericResponse);
      return;
    }

    const user = userRes.rows[0];

    const recentRes = await pool.query(
      `SELECT * FROM otp_verifications
       WHERE email ILIKE $1
       AND purpose = 'FORGOT_PASSWORD'
       ORDER BY id DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    if (recentRes.rows.length > 0) {
      const recent = recentRes.rows[0];

      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(recent.created_at).getTime()) / 1000
      );

      const remainingCooldown =
        OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;

      if (remainingCooldown > 0) {
        res.status(429).json({
          message: `Please wait ${remainingCooldown} seconds before requesting a new code.`,
          retryAfterSeconds: remainingCooldown,
        });
        return;
      }
    }

    const plainOtp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const otpHash = await bcrypt.hash(plainOtp, 10);

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    await pool.query(
      `UPDATE otp_verifications
       SET used = true
       WHERE email ILIKE $1
       AND purpose = 'FORGOT_PASSWORD'
       AND used = false`,
      [normalizedEmail]
    );

    await pool.query(
      `INSERT INTO otp_verifications
       (user_id, email, otp_hash, purpose, expires_at, attempts, used, created_at)
       VALUES ($1, $2, $3, 'FORGOT_PASSWORD', $4, 0, false, NOW())`,
      [user.id, normalizedEmail, otpHash, expiresAt]
    );

    await EmailService.sendOtpEmail(
      normalizedEmail,
      plainOtp,
      'FORGOT_PASSWORD'
    );

    await recordAudit(
      req,
      'AUD-' + Math.floor(100000 + Math.random() * 900000),
      user.email,
      user.role || 'citizen',
      'Authentication',
      'FORGOT_PASSWORD_OTP_SENT',
      'INFO',
      null,
      'Password reset OTP dispatched via Nodemailer'
    );

    res.status(200).json(genericResponse);
  } catch (error: any) {
    console.error('Initiate Forgot Password Error:', error);

    res.status(500).json({
      message:
        error?.message ||
        'Failed to process password reset request.',
    });
  }
}

export async function resetPassword(
  req: Request,
  res: Response
): Promise<void> {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({
      message:
        'Email, verification code, and new password are required.',
    });
    return;
  }

  if (!isStrongPassword(newPassword)) {
    res.status(400).json({
      message:
        'Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.',
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const inputOtp = String(otp).trim();

  try {
    const otpRes = await pool.query(
      `SELECT * FROM otp_verifications
       WHERE email ILIKE $1
       AND purpose = 'FORGOT_PASSWORD'
       AND used = false
       ORDER BY id DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    if (otpRes.rows.length === 0) {
      res.status(400).json({
        message:
          'No active verification code found. Please request a new code.',
      });
      return;
    }

    const otpRecord = otpRes.rows[0];

    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      await pool.query(
        'UPDATE otp_verifications SET used = true WHERE id = $1',
        [otpRecord.id]
      );

      res.status(400).json({
        message:
          'Verification code has expired. Please request a new one.',
      });
      return;
    }

    if (otpRecord.attempts >= 5) {
      await pool.query(
        'UPDATE otp_verifications SET used = true WHERE id = $1',
        [otpRecord.id]
      );

      res.status(429).json({
        message:
          'Maximum verification attempts exceeded. Please request a new code.',
      });
      return;
    }

    const isOtpValid = await bcrypt.compare(
      inputOtp,
      otpRecord.otp_hash
    );

    if (!isOtpValid) {
      const newAttempts = otpRecord.attempts + 1;

      await pool.query(
        'UPDATE otp_verifications SET attempts = $1 WHERE id = $2',
        [newAttempts, otpRecord.id]
      );

      const remaining = Math.max(0, 5 - newAttempts);

      res.status(400).json({
        message: `Invalid verification code. Attempts remaining: ${remaining}`,
        remainingAttempts: remaining,
      });
      return;
    }

    await pool.query(
      'UPDATE otp_verifications SET used = true WHERE id = $1',
      [otpRecord.id]
    );

    const userRes = await pool.query(
      'SELECT * FROM users WHERE email ILIKE $1',
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        message: 'User account not found.',
      });
      return;
    }

    const user = userRes.rows[0];

    const newPasswordHash = await bcrypt.hash(
      newPassword.trim(),
      10
    );

    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [newPasswordHash, user.id]
    );

    loginAttemptsTracker.delete(normalizedEmail);

    await recordAudit(
      req,
      'AUD-' + Math.floor(100000 + Math.random() * 900000),
      user.email,
      user.role || 'citizen',
      'Authentication',
      'PASSWORD_RESET_SUCCESS',
      'INFO',
      null,
      'Password reset successfully via forgot-password OTP flow'
    );

    res.status(200).json({
      message:
        'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset Password Error:', error);

    res.status(500).json({
      message: error?.message || 'Failed to reset password.',
    });
  }
}

export async function getSessionStatus(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ((req.query.token as string) || null);
  const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string) || null;

  if (!token) {
    res.status(401).json({ message: 'No authorization token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.id;

    // 1. Check user status in database
    const userRes = await pool.query('SELECT id, email, role, status FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      res.json({ loggedOff: true, reason: 'NOT_FOUND', message: 'You have been logged off.' });
      return;
    }

    const user = userRes.rows[0];
    if (user.status === 'ARCHIVED' || user.status === 'Inactive') {
      res.json({
        loggedOff: true,
        reason: 'ARCHIVED',
        message: 'You have been logged off. Your account has been archived by the administrator.',
      });
      return;
    }

    // 2. Check if this specific session has been revoked
    if (sessionId) {
      const sessRes = await pool.query('SELECT status FROM user_sessions WHERE session_id = $1', [sessionId]);
      if (sessRes.rows.length > 0 && sessRes.rows[0].status === 'REVOKED') {
        res.json({
          loggedOff: true,
          reason: 'REVOKED',
          message: 'You have been logged off. This session was terminated by the account owner.',
        });
        return;
      }

      // Update heartbeat
      await pool.query('UPDATE user_sessions SET last_heartbeat = NOW() WHERE session_id = $1', [sessionId]);
    }

    // Update user active time
    await pool.query('UPDATE users SET last_active_at = NOW(), is_logged_in = TRUE WHERE id = $1', [user.id]);

    // 3. Check for pending concurrent login alerts that the current user needs to answer
    const alertRes = await pool.query(
      `SELECT * FROM concurrent_login_alerts
       WHERE user_id = $1 AND status = 'PENDING'
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (alertRes.rows.length > 0) {
      const alert = alertRes.rows[0];
      // Only show to the session that did NOT initiate the new login
      if (!sessionId || alert.new_session_id !== sessionId) {
        res.json({
          active: true,
          user: { id: user.id, email: user.email, role: user.role },
          concurrentAlert: {
            id: alert.id,
            time: alert.login_time,
            browser: alert.browser_info,
            location: alert.city_location,
          },
        });
        return;
      }
    }

    res.json({
      active: true,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err: any) {
    res.status(401).json({ loggedOff: true, message: 'Invalid or expired session token.' });
  }
}

export async function resolveConcurrentLogin(req: Request, res: Response): Promise<void> {
  const { alertId, action } = req.body;

  if (!alertId || !action) {
    res.status(400).json({ message: 'alertId and action are required.' });
    return;
  }

  try {
    const alertRes = await pool.query('SELECT * FROM concurrent_login_alerts WHERE id = $1', [alertId]);
    if (alertRes.rows.length === 0) {
      res.status(404).json({ message: 'Alert not found.' });
      return;
    }

    const alert = alertRes.rows[0];

    if (action.toUpperCase() === 'YES') {
      await pool.query("UPDATE concurrent_login_alerts SET status = 'APPROVED' WHERE id = $1", [alertId]);
      res.json({ success: true, message: 'Verified as owner. Concurrent login permitted.' });
    } else {
      // action is 'NO' -> Terminate the other session!
      await pool.query("UPDATE concurrent_login_alerts SET status = 'DENIED' WHERE id = $1", [alertId]);
      await pool.query("UPDATE user_sessions SET status = 'REVOKED' WHERE session_id = $1", [alert.new_session_id]);
      res.json({ success: true, message: 'The other session has been logged off.' });
    }
  } catch (err: any) {
    console.error('Error resolving concurrent login:', err);
    res.status(500).json({ message: 'Failed to resolve login confirmation.' });
  }
}

export async function logoutUser(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body;
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  try {
    let userEmail = 'Unknown User';
    let userRole = 'User';

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.id) {
          const userRes = await pool.query('SELECT email, role, fullname FROM users WHERE id = $1', [decoded.id]);
          if (userRes.rows.length > 0) {
            userEmail = userRes.rows[0].email || userRes.rows[0].fullname || userEmail;
            userRole = userRes.rows[0].role || 'User';
          }
        }
      } catch {
        // ignore token error
      }
    } else if (sessionId) {
      try {
        const sessionRes = await pool.query(
          'SELECT u.email, u.role, u.fullname FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.session_id = $1',
          [sessionId]
        );
        if (sessionRes.rows.length > 0) {
          userEmail = sessionRes.rows[0].email || sessionRes.rows[0].fullname || userEmail;
          userRole = sessionRes.rows[0].role || 'User';
        }
      } catch {
        // ignore query error
      }
    }

    if (sessionId) {
      await pool.query("UPDATE user_sessions SET status = 'REVOKED' WHERE session_id = $1", [sessionId]);
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const remaining = await pool.query(
          "SELECT COUNT(*) FROM user_sessions WHERE user_id = $1 AND status = 'ACTIVE' AND last_heartbeat > NOW() - INTERVAL '15 minutes'",
          [decoded.id]
        );
        if (parseInt(remaining.rows[0].count, 10) === 0) {
          await pool.query("UPDATE users SET is_logged_in = FALSE WHERE id = $1", [decoded.id]);
        }
      } catch {
        // ignore token error
      }
    }

    // Explicitly record audit log for logout
    const auditId = 'AUD-' + Math.floor(100000 + Math.random() * 900000);
    await recordAudit(
      req,
      auditId,
      userEmail,
      userRole,
      'Authentication',
      'User Logged Out',
      'INFO',
      `Active session for ${userEmail}`,
      'Session terminated / Logged out'
    );

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Error logging out.' });
  }
}