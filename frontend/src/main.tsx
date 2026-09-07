import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./legacy-styles.css";
import App from "./App.tsx";

import { ThemeProvider } from "./components/ThemeContext";
import { API_BASE_URL } from "./config/api";



const _originalFetch = window.fetch.bind(window);
const API_ORIGIN = API_BASE_URL;

const _RAW_SECRET: string = (import.meta as any).env?.VITE_PAYLOAD_SECRET || '';
let _cryptoKey: CryptoKey | null = null;

async function _getCryptoKey(): Promise<CryptoKey | null> {
  if (!_RAW_SECRET) return null;
  if (_cryptoKey) return _cryptoKey;
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(_RAW_SECRET));
  _cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return _cryptoKey;
}

async function _encrypt(data: unknown): Promise<string> {
  const key = await _getCryptoKey();
  if (!key) return JSON.stringify(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function _decrypt(ciphertext: string): Promise<unknown> {
  const key = await _getCryptoKey();
  if (!key) { try { return JSON.parse(ciphertext); } catch { return ciphertext; } }
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.subarray(0, 12);
  const data = combined.subarray(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

  const isBackendCall =
    url.startsWith(API_ORIGIN) || (url.startsWith("/") && !url.startsWith("//"));
  const isLoginRoute = url.includes("/login");
  const isUpload = url.includes("/uploads") || (init?.body instanceof FormData);
  const method = (init?.method || "GET").toUpperCase();

  let patchedInit: RequestInit = { ...(init ?? {}) };

  if (isBackendCall && !isLoginRoute) {
    const token = localStorage.getItem("token");
    if (token) {
      const existingHeaders: Record<string, string> = {};
      if (patchedInit.headers instanceof Headers) {
        patchedInit.headers.forEach((v, k) => {
          existingHeaders[k] = v;
        });
      } else if (patchedInit.headers) {
        Object.assign(existingHeaders, patchedInit.headers as Record<string, string>);
      }
      patchedInit.headers = { ...existingHeaders, Authorization: `Bearer ${token}` };
    }
  }

  if (
    isBackendCall &&
    !isUpload &&
    ["POST", "PUT", "PATCH"].includes(method) &&
    patchedInit.body &&
    typeof patchedInit.body === "string"
  ) {
    const key = await _getCryptoKey();
    if (key) {
      try {
        const parsed = JSON.parse(patchedInit.body as string);
        const alreadyEncrypted =
          parsed &&
          typeof parsed === "object" &&
          "payload" in parsed &&
          Object.keys(parsed).length === 1;
        if (!alreadyEncrypted) {
          const encrypted = await _encrypt(parsed);
          patchedInit.body = JSON.stringify({ payload: encrypted });
          patchedInit.headers = {
            ...((patchedInit.headers as Record<string, string>) || {}),
            "Content-Type": "application/json",
          };
        }
      } catch {

      }
    }
  }

  const response = await _originalFetch(input, patchedInit);

  if (response.status === 401 && isBackendCall && !isLoginRoute) {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("user");
    localStorage.removeItem("user_role");
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("user");
    if (
      !window.location.pathname.includes("/login") &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/";
    }
    return response;
  }

  if (isBackendCall && !isUpload) {
    const key = await _getCryptoKey();
    if (key) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (
          json &&
          typeof json === "object" &&
          "payload" in json &&
          typeof json.payload === "string" &&
          Object.keys(json).length === 1
        ) {
          const decrypted = await _decrypt(json.payload);
          return new Response(JSON.stringify(decrypted), {
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
  }

  return response;
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
