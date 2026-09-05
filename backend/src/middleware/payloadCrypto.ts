// src/middleware/payloadCrypto.ts
// AES-256-GCM application-layer payload encryption middleware
// All API request bodies are received as { payload: "<encrypted>" }
// and all responses are sent as { payload: "<encrypted>" }

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// ─── Key Setup ────────────────────────────────────────────────────────────────
const RAW_SECRET = process.env.PAYLOAD_SECRET || '';

function deriveKey(secret: string): Buffer {
  // Derive a 32-byte key from the secret using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

const KEY = deriveKey(RAW_SECRET);
const ALGORITHM = 'aes-256-gcm';

// ─── Core Crypto ──────────────────────────────────────────────────────────────

export function encryptData(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag
  // Pack: iv(12) + authTag(16) + ciphertext, encode as base64
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decryptData(ciphertext: string): string {
  const combined = Buffer.from(ciphertext, 'base64');
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ─── Middleware: Decrypt Incoming Requests ────────────────────────────────────

export function decryptRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If no PAYLOAD_SECRET is configured, skip (development fallback)
  if (!RAW_SECRET) {
    next();
    return;
  }

  // Only process requests that carry an encrypted payload
  if (
    req.body &&
    typeof req.body === 'object' &&
    typeof req.body.payload === 'string' &&
    Object.keys(req.body).length === 1
  ) {
    try {
      const decrypted = decryptData(req.body.payload);
      req.body = JSON.parse(decrypted);
    } catch {
      res.status(400).json({ message: 'Invalid encrypted payload.' });
      return;
    }
  }

  next();
}

// ─── Middleware: Encrypt Outgoing Responses ───────────────────────────────────

export function encryptResponse(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If no PAYLOAD_SECRET is configured, skip (development fallback)
  if (!RAW_SECRET) {
    next();
    return;
  }

  // Capture the original res.json
  const originalJson = res.json.bind(res);

  res.json = (data: any): Response => {
    try {
      const plaintext = JSON.stringify(data);
      const encrypted = encryptData(plaintext);
      return originalJson({ payload: encrypted });
    } catch {
      return originalJson(data);
    }
  };

  next();
}
