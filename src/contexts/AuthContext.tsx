import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { AuthUser } from '../types';
import { startOAuthFlow, refreshAccessToken, type StoredAuth } from '../auth';
import { upsertUser, initDb, seedDefaultCategories } from '../db';

interface AuthContextType {
  authUser: AuthUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORE_FILE = 'auth.json';
const AUTH_KEY = 'auth';

async function getStore() {
  return await load(STORE_FILE);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session from stored refresh token on mount
  useEffect(() => {
    (async () => {
      try {
        await initDb();
        const store = await getStore();
        const stored = await store.get<StoredAuth>(AUTH_KEY);
        if (stored?.refresh_token) {
          const { userInfo } = await refreshAccessToken(stored.refresh_token);
          const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
          setAuthUser(user);
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
        // Clear stored auth if refresh failed
        try {
          const store = await getStore();
          await store.delete(AUTH_KEY);
          await store.save();
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async () => {
    const { userInfo, refreshToken } = await startOAuthFlow();
    const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);

    // Seed default categories for new users
    await seedDefaultCategories(user.id);

    // Store refresh token
    const store = await getStore();
    await store.set(AUTH_KEY, { refresh_token: refreshToken, google_sub: userInfo.sub } satisfies StoredAuth);
    await store.save();

    setAuthUser(user);
  }, []);

  const logout = useCallback(async () => {
    const store = await getStore();
    await store.delete(AUTH_KEY);
    await store.save();
    setAuthUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
