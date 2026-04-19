import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { SessionUser } from "../lib/api/types";

const tokenStorageKey = "stb.mobile.token";
const userStorageKey = "stb.mobile.user";

type PendingRequestCache = Record<string, string>;

function readWebStorage(key: string): string | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeWebStorage(key: string, value: string) {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Ignore browser storage failures and leave the session in memory.
  }
}

function deleteWebStorage(key: string) {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Ignore browser storage failures and leave the session in memory.
  }
}

async function readPersistedValue(key: string): Promise<string | null> {
  if (typeof globalThis.localStorage !== "undefined") {
    return readWebStorage(key);
  }

  return SecureStore.getItemAsync(key);
}

async function writePersistedValue(key: string, value: string): Promise<void> {
  if (typeof globalThis.localStorage !== "undefined") {
    writeWebStorage(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deletePersistedValue(key: string): Promise<void> {
  if (typeof globalThis.localStorage !== "undefined") {
    deleteWebStorage(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

type SessionState = {
  token: string | null;
  user: SessionUser | null;
  hydrated: boolean;
  pendingRequestKeys: PendingRequestCache;
  hydrate: () => Promise<void>;
  signIn: (input: { token: string; user: SessionUser }) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: SessionUser) => Promise<void>;
  rememberRequestKey: (signature: string, key: string) => void;
  consumeRequestKey: (signature: string) => string | null;
  clearRequestKey: (signature: string) => void;
  dropSession: () => void;
};

async function persistSession(token: string, user: SessionUser) {
  await writePersistedValue(tokenStorageKey, token);
  await writePersistedValue(userStorageKey, JSON.stringify(user));
}

async function clearPersistedSession() {
  await deletePersistedValue(tokenStorageKey);
  await deletePersistedValue(userStorageKey);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,
  pendingRequestKeys: {},
  hydrate: async () => {
    const [token, userValue] = await Promise.all([
      readPersistedValue(tokenStorageKey),
      readPersistedValue(userStorageKey)
    ]);

    let user: SessionUser | null = null;

    if (userValue) {
      try {
        user = JSON.parse(userValue) as SessionUser;
      } catch {
        user = null;
      }
    }

    set({
      token: token ?? null,
      user,
      hydrated: true
    });
  },
  signIn: async ({ token, user }) => {
    await persistSession(token, user);
    set({ token, user, hydrated: true });
  },
  signOut: async () => {
    await clearPersistedSession();
    set({
      token: null,
      user: null,
      pendingRequestKeys: {}
    });
  },
  setUser: async (user) => {
    const token = get().token;

    if (token) {
      await persistSession(token, user);
    }

    set({ user });
  },
  rememberRequestKey: (signature, key) => {
    set((state) => ({
      pendingRequestKeys: {
        ...state.pendingRequestKeys,
        [signature]: key
      }
    }));
  },
  consumeRequestKey: (signature) => get().pendingRequestKeys[signature] ?? null,
  clearRequestKey: (signature) => {
    set((state) => {
      const next = { ...state.pendingRequestKeys };
      delete next[signature];
      return { pendingRequestKeys: next };
    });
  },
  dropSession: () => {
    set({
      token: null,
      user: null,
      pendingRequestKeys: {}
    });
    void clearPersistedSession();
  }
}));
