import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';


function getRawSecret(): string {
  return process.env.PAYLOAD_SECRET || '';
}

function getKey(): Buffer {
  const secret = getRawSecret();
  return crypto.createHash('sha256').update(secret).digest();
}

const ALGORITHM = 'aes-256-gcm';


export function encryptData(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
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


export function decryptRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = getRawSecret();

  if (!secret) {
    next();
    return;
  }

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


export function encryptResponse(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = getRawSecret();

  if (!secret) {
    next();
    return;
  }


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
