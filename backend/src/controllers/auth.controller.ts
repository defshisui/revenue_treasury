// src/controllers/auth.controller.ts
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

/**
 * STRONG PASSWORD VALIDATION
 *
 * Requirements:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
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

/**
 * STEP 1: USER SIGN IN
 * Validate credentials, then generate & dispatch Login OTP.
 * Does NOT issue JWT token before OTP verification.
 */
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

    // Support both bcrypt hashed and legacy plain-text passwords
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

    // Password verified!
    // Clear password lockout counter
    loginAttemptsTracker.delete(
      normalizedEmail
    );

    // Generate random 6-digit OTP
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

    // Invalidate any existing unused LOGIN OTPs
    await pool.query(
      `UPDATE otp_verifications
       SET used = true
       WHERE email ILIKE $1
       AND purpose = 'LOGIN'
       AND used = false`,
      [normalizedEmail]
    );

    // Save hashed OTP verification record
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

    // Send OTP
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

/**
 * STEP 2: VERIFY SIGN-IN OTP
 * Validate OTP, then issue JWT & session.
 */
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

    // Check expiration
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

    // Check max attempts
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

    // Compare hashed OTP
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

    // Mark OTP as used
    await pool.query(
      'UPDATE otp_verifications SET used = true WHERE id = $1',
      [otpRecord.id]
    );

    // Fetch user details
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

    // Generate JWT Token
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

    res.status(200).json({
      message:
        'Sign-in verified successfully!',
      token,
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

/**
 * STEP 1: USER REGISTRATION
 *
 * Validate registration info, validate strong password,
 * generate & dispatch Register OTP.
 */
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

  // ============================================================
  // STRONG PASSWORD VALIDATION
  // ============================================================
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
    // Check if user already exists
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

    // Anti-Fraud AI Check
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

    // Hash password for pending storage
    const hashedPassword =
      await bcrypt.hash(
        String(password).trim(),
        12
      );

    // Generate random 6-digit OTP
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

    // Package pending registration payload
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

    // Invalidate existing unused REGISTER OTPs
    await pool.query(
      `UPDATE otp_verifications
       SET used = true
       WHERE email ILIKE $1
       AND purpose = 'REGISTER'
       AND used = false`,
      [normalizedEmail]
    );

    // Save pending registration payload and hashed OTP
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

    // Send OTP via Nodemailer
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

/**
 * STEP 2: VERIFY REGISTRATION OTP
 * Validate OTP, create user & citizen in DB,
 * and complete registration.
 */
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

    // Check expiration
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

    // Check attempts limit
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

    // Compare hashed OTP
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

    // OTP is valid! Parse payload
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

    // ============================================================
    // SECOND BACKEND PASSWORD CHECK
    //
    // This protects against an old/malformed pending registration
    // payload bypassing the normal initiateRegister validation.
    // ============================================================
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

    // Execute PostgreSQL Transaction
    await client.query(
      'BEGIN'
    );

    // Invalidate OTP
    await client.query(
      'UPDATE otp_verifications SET used = true WHERE id = $1',
      [otpRecord.id]
    );

    // Check for race condition
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

    // Insert user
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

    // Insert citizen profile
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

/**
 * RESEND OTP
 * Resends a new 6-digit OTP with a mandatory
 * 60-second cooldown.
 */
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
    !['LOGIN', 'REGISTER'].includes(
      purpose
    )
  ) {
    res.status(400).json({
      message:
        'Email and valid purpose (LOGIN or REGISTER) are required.',
    });

    return;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  try {
    // Check most recent OTP record
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

    // Invalidate old OTPs
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

    // Generate new 6-digit OTP
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

    // Save new OTP record
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

    // Send email
    await EmailService.sendOtpEmail(
      normalizedEmail,
      plainOtp,
      purpose as
        | 'LOGIN'
        | 'REGISTER'
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