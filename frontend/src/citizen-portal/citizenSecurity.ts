const CIPHER_KEY = 0x5a;

export function encryptPayload(data: any): string {
  try {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    const enc = encodeURIComponent(json);
    let output = '';
    for (let i = 0; i < enc.length; i++) {
      output += String.fromCharCode(enc.charCodeAt(i) ^ CIPHER_KEY);
    }
    return btoa(output);
  } catch {
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

export function decryptPayload<T = any>(encrypted: string): T | null {
  try {
    const raw = atob(encrypted);
    let decrypted = '';
    for (let i = 0; i < raw.length; i++) {
      decrypted += String.fromCharCode(raw.charCodeAt(i) ^ CIPHER_KEY);
    }
    const decoded = decodeURIComponent(decrypted);
    return JSON.parse(decoded) as T;
  } catch {
    try {
      return JSON.parse(encrypted) as T;
    } catch {
      return null;
    }
  }
}

export function setEncryptedItem(key: string, value: any): void {
  try {
    const cipher = encryptPayload(value);
    localStorage.setItem(`__enc_${key}`, cipher);
  } catch { }
}

export function getEncryptedItem<T = any>(key: string): T | null {
  try {
    const cipher = localStorage.getItem(`__enc_${key}`);
    if (cipher) {
      const dec = decryptPayload<T>(cipher);
      if (dec !== null) return dec;
    }
    const plain = localStorage.getItem(key);
    if (!plain) return null;
    try {
      return JSON.parse(plain) as T;
    } catch {
      return plain as unknown as T;
    }
  } catch {
    return null;
  }
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

  //document.addEventListener('contextmenu', handleContextMenu);
  //document.addEventListener('keydown', handleKeyDown);

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
