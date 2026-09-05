// src/config/apiCrypto.ts
// AES-256-GCM application-layer encryption for all API requests/responses.
// Uses the browser's built-in Web Crypto API — no dependencies needed.
// Intercepts every fetch() call to API_BASE_URL automatically.

import { API_BASE_URL } from './api';

// ─── Key Setup ────────────────────────────────────────────────────────────────

const RAW_SECRET: string = import.meta.env.VITE_PAYLOAD_SECRET || '';

let _cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey | null> {
  if (!RAW_SECRET) return null; // No secret configured → no encryption
  if (_cachedKey) return _cachedKey;

  // Derive a 256-bit AES-GCM key from the secret via SHA-256
  const encoder = new TextEncoder();
  const rawKeyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(RAW_SECRET));
  _cachedKey = await crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return _cachedKey;
}

// ─── Core Encrypt / Decrypt ───────────────────────────────────────────────────

async function encryptPayload(data: unknown): Promise<string> {
  const key = await getKey();
  if (!key) return JSON.stringify(data); // Fallback: plain JSON

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Pack: iv(12) + ciphertext, base64-encode
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptResponse(ciphertext: string): Promise<unknown> {
  const key = await getKey();
  if (!key) {
    try { return JSON.parse(ciphertext); } catch { return ciphertext; }
  }

  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.subarray(0, 12);
  const data = combined.subarray(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text);
}

// ─── Response Parser ──────────────────────────────────────────────────────────

async function parseSecureResponse(response: globalThis.Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text; // raw text response
  }

  // If the backend returned an encrypted envelope, decrypt it
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'payload' in (parsed as object) &&
    typeof (parsed as Record<string, unknown>).payload === 'string' &&
    Object.keys(parsed as object).length === 1
  ) {
    try {
      return await decryptResponse((parsed as Record<string, string>).payload);
    } catch {
      return parsed; // If decryption fails, return as-is
    }
  }

  return parsed;
}

// ─── Secure Fetch Wrappers ────────────────────────────────────────────────────

interface SecureRequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function secureGet(
  path: string,
  options: SecureRequestOptions = {}
): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const err = await parseSecureResponse(response) as any;
    throw new Error(err?.message || err?.error || `Request failed (${response.status})`);
  }

  return parseSecureResponse(response);
}

export async function securePost(
  path: string,
  data: unknown,
  options: SecureRequestOptions = {}
): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const key = await getKey();
  let body: string;
  let contentType = 'application/json';

  if (key) {
    const encrypted = await encryptPayload(data);
    body = JSON.stringify({ payload: encrypted });
  } else {
    body = JSON.stringify(data);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      ...options.headers,
    },
    body,
    signal: options.signal,
  });

  if (!response.ok) {
    const err = await parseSecureResponse(response) as any;
    throw new Error(err?.message || err?.error || `Request failed (${response.status})`);
  }

  return parseSecureResponse(response);
}

export async function securePut(
  path: string,
  data: unknown,
  options: SecureRequestOptions = {}
): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const key = await getKey();
  let body: string;

  if (key) {
    const encrypted = await encryptPayload(data);
    body = JSON.stringify({ payload: encrypted });
  } else {
    body = JSON.stringify(data);
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body,
    signal: options.signal,
  });

  if (!response.ok) {
    const err = await parseSecureResponse(response) as any;
    throw new Error(err?.message || err?.error || `Request failed (${response.status})`);
  }

  return parseSecureResponse(response);
}

export async function secureDelete(
  path: string,
  options: SecureRequestOptions = {}
): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const err = await parseSecureResponse(response) as any;
    throw new Error(err?.message || err?.error || `Request failed (${response.status})`);
  }

  return parseSecureResponse(response);
}

// ─── Global Fetch Interceptor ─────────────────────────────────────────────────
// Automatically encrypts all fetch() calls going to API_BASE_URL.
// Install once at app startup via installFetchInterceptor().

let _interceptorInstalled = false;

export function installFetchInterceptor(): void {
  if (_interceptorInstalled) return;
  _interceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<globalThis.Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

    // Only intercept calls to our API
    if (!url.startsWith(API_BASE_URL)) {
      return originalFetch(input, init);
    }

    // Skip upload endpoints (multipart/form-data must not be encrypted)
    if (url.includes('/uploads') || (init?.body instanceof FormData)) {
      return originalFetch(input, init);
    }

    const method = (init?.method || 'GET').toUpperCase();
    const key = await getKey();

    // ── Encrypt outgoing body (POST / PUT / PATCH) ──
    let patchedInit = { ...init };
    if (key && init?.body && typeof init.body === 'string' && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const parsed = JSON.parse(init.body as string);
        // Don't double-encrypt if already wrapped
        if (!(parsed && typeof parsed === 'object' && 'payload' in parsed && Object.keys(parsed).length === 1)) {
          const encrypted = await encryptPayload(parsed);
          patchedInit = {
            ...init,
            body: JSON.stringify({ payload: encrypted }),
            headers: {
              ...(init?.headers as Record<string, string> || {}),
              'Content-Type': 'application/json',
            },
          };
        }
      } catch {
        // If body isn't JSON, send as-is
      }
    }

    // ── Make the actual request ──
    const response = await originalFetch(input, patchedInit);

    // ── Decrypt encrypted response ──
    if (key) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json && typeof json === 'object' && 'payload' in json && typeof json.payload === 'string' && Object.keys(json).length === 1) {
          const decrypted = await decryptResponse(json.payload);
          const decryptedText = JSON.stringify(decrypted);
          // Return a new Response with decrypted body but same status/headers
          return new Response(decryptedText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch {
        // Not encrypted or parse failed — return original
      }
      // Return with original text (re-wrapped since we consumed the stream)
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  };
}
