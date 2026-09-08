import { API_BASE_URL } from './api';


const RAW_SECRET: string = import.meta.env.VITE_PAYLOAD_SECRET || '';

let _cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey | null> {
  if (!RAW_SECRET) return null;
  if (_cachedKey) return _cachedKey;

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


async function encryptPayload(data: unknown): Promise<string> {
  const key = await getKey();
  if (!key) return JSON.stringify(data);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

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


async function parseSecureResponse(response: globalThis.Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }

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
      return parsed;
    }
  }

  return parsed;
}


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



let _interceptorInstalled = false;

export function installFetchInterceptor(): void {
  if (_interceptorInstalled) return;
  _interceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<globalThis.Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

    if (!url.startsWith(API_BASE_URL)) {
      return originalFetch(input, init);
    }

    if (url.includes('/uploads')) {
      return originalFetch(input, init);
    }

    const isFormData = init?.body instanceof FormData;
    const method = (init?.method || 'GET').toUpperCase();
    const key = await getKey();

    let patchedInit = { ...init };
    if (!isFormData && key && init?.body && typeof init.body === 'string' && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const parsed = JSON.parse(init.body as string);

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
      }
    }

    const response = await originalFetch(input, patchedInit);

    if (key) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json && typeof json === 'object' && 'payload' in json && typeof json.payload === 'string' && Object.keys(json).length === 1) {
          const decrypted = await decryptResponse(json.payload);
          const decryptedText = JSON.stringify(decrypted);

          return new Response(decryptedText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch {
      }

      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  };
}
