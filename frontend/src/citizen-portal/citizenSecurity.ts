const LS_SECRET: string = (import.meta as any).env?.VITE_PAYLOAD_SECRET || 'rt-local-fallback-key-2026';

let _lsKey: CryptoKey | null = null;

async function getLsKey(): Promise<CryptoKey> {
  if (_lsKey) return _lsKey;
  const encoder = new TextEncoder();
  const rawKey = await crypto.subtle.digest('SHA-256', encoder.encode(LS_SECRET));
  _lsKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return _lsKey;
}

export async function encryptPayload(data: any): Promise<string> {
  try {
    const key = await getLsKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  } catch {
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

export async function decryptPayload<T = any>(ciphertext: string): Promise<T | null> {
  try {
    const key = await getLsKey();
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.subarray(0, 12);
    const data = combined.subarray(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    const text = new TextDecoder().decode(decrypted);
    return JSON.parse(text) as T;
  } catch {
    try { return JSON.parse(ciphertext) as T; } catch { return null; }
  }
}

export async function setEncryptedItem(key: string, value: any): Promise<void> {
  try {
    const cipher = await encryptPayload(value);
    localStorage.setItem(`__enc_${key}`, cipher);
  } catch { }
}

export async function getEncryptedItem<T = any>(key: string): Promise<T | null> {
  try {
    const cipher = localStorage.getItem(`__enc_${key}`);
    if (cipher) {
      const dec = await decryptPayload<T>(cipher);
      if (dec !== null) return dec;
    }
    const plain = localStorage.getItem(key);
    if (!plain) return null;
    try { return JSON.parse(plain) as T; }
    catch { return plain as unknown as T; }
  } catch { return null; }
}


export function initCitizenSecurity(): () => void {
  const isCitizenPath = window.location.pathname.includes('citizen') ||
    window.location.pathname.includes('market') ||
    window.location.pathname.includes('business-tax') ||
    window.location.pathname.includes('hawker') ||
    window.location.pathname === '/';

  if (!isCitizenPath) return () => { };

  document.documentElement.classList.remove('dark');
  document.body.classList.remove('dark');

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      ['I', 'i', 'J', 'j', 'C', 'c', 'K', 'k'].includes(e.key)
    ) {
      e.preventDefault();
      return false;
    }
    if ((e.ctrlKey || e.metaKey) && ['U', 'u', 'S', 's'].includes(e.key)) {
      e.preventDefault();
      return false;
    }
  };


  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  console.log = () => { };
  console.info = () => { };
  console.debug = () => { };
  console.dir = () => { };

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    console.info = originalInfo;
  };
}
