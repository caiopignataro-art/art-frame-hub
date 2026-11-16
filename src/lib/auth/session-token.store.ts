/**
 * Armazenamento client-side leve para sincronização de token em memória / sessionStorage
 * utilizado pelo interceptor de Server Functions (`attachSupabaseAuth`).
 * A fonte primária e autoritativa de sessão são os cookies HttpOnly validados no servidor.
 */

const STORAGE_KEY = "afh.auth.session.v1";

interface StoredTokenData {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

let memoryToken: StoredTokenData | null = null;

function readFromStorage(): StoredTokenData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTokenData;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const sessionTokenStore = {
  get(): StoredTokenData | null {
    if (memoryToken) return memoryToken;
    memoryToken = readFromStorage();
    return memoryToken;
  },

  getAccessToken(): string | null {
    const current = this.get();
    if (!current) return null;
    if (current.expiresAt) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (current.expiresAt <= nowSec) {
        return null;
      }
    }
    return current.accessToken;
  },

  getRefreshToken(): string | null {
    return this.get()?.refreshToken ?? null;
  },

  set(data: StoredTokenData | null): void {
    memoryToken = data;
    if (typeof window === "undefined") return;
    try {
      if (!data) {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {
      // Ignora indisponibilidade de sessionStorage
    }
  },

  clear(): void {
    this.set(null);
  },
};
