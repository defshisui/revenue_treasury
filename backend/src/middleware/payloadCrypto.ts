// src/middleware/payloadCrypto.ts
// AES-256-GCM application-layer payload encryption middleware
// All API request bodies are received as { payload: "<encrypted>" }
// and all responses are sent as { payload: "<encrypted>" }

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// ─── Key Setup ────────────────────────────────────────────────────────────────
function getRawSecret(): string {
  return process.env.PAYLOAD_SECRET || '';
}

function getKey(): Buffer {
  const secret = getRawSecret();
  return crypto.createHash('sha256').update(secret).digest();
}

const ALGORITHM = 'aes-256-gcm';

// ─── Core Crypto ──────────────────────────────────────────────────────────────

export function encryptData(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag
  // Pack: iv(12) + ciphertext(N) + authTag(16), encode as base64 (matches browser Web Crypto API layout)
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

export function decryptData(ciphertext: string): string {
  const combined = Buffer.from(ciphertext, 'base64');
  if (combined.length < 28) {
    throw new Error('Ciphertext too short');
  }
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(12, combined.length - 16);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
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
  const secret = getRawSecret();
  // If no PAYLOAD_SECRET is configured, skip (development fallback)
  if (!secret) {
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
  const secret = getRawSecret();
  // If no PAYLOAD_SECRET is configured, skip (development fallback)
  if (!secret) {
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
