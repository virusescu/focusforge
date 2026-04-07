import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { AuthUser } from '../types';
import { startOAuthFlow, refreshAccessToken, type StoredAuth } from '../auth';
import { upsertUser, initDb, initDbClient, seedDefaultCategories } from '../db';

interface AuthContextType {
  authUser: AuthUser | null;
  needsSetup: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  completeSetup: (url: string, authToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORE_FILE = 'auth.json';
const AUTH_KEY = 'auth';
const TURSO_URL_KEY = 'turso_url';
const TURSO_TOKEN_KEY = 'turso_auth_token';

async function getStore() {
  return await load(STORE_FILE);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingAuth, setPendingAuth] = useState<{ userInfo: { sub: string; email: string; name: string; picture?: string }; refreshToken: string } | null>(null);

  // Try to restore session from stored refresh token on mount
  useEffect(() => {
    (async () => {
      try {
        const store = await getStore();

        // Check for stored Turso credentials first
        const storedUrl = await store.get<string>(TURSO_URL_KEY);
        const storedToken = await store.get<string>(TURSO_TOKEN_KEY);

        if (!storedUrl || !storedToken) {
          // Check if we have auth to restore (user logged in before but needs setup)
          const stored = await store.get<StoredAuth>(AUTH_KEY);
          if (stored?.refresh_token) {
            setNeedsSetup(true);
          }
          setLoading(false);
          return;
        }

        // Initialize DB with stored credentials
        initDbClient(storedUrl, storedToken);
        await initDb();

        const stored = await store.get<StoredAuth>(AUTH_KEY);
        if (stored?.refresh_token) {
          const { userInfo } = await refreshAccessToken(stored.refresh_token);
          const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
          setAuthUser(user);
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
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

    // Store refresh token
    const store = await getStore();
    await store.set(AUTH_KEY, { refresh_token: refreshToken, google_sub: userInfo.sub } satisfies StoredAuth);
    await store.save();

    // Check if Turso credentials exist
    const storedUrl = await store.get<string>(TURSO_URL_KEY);
    const storedToken = await store.get<string>(TURSO_TOKEN_KEY);

    if (!storedUrl || !storedToken) {
      // Save pending auth info for after setup completes
      setPendingAuth({ userInfo, refreshToken });
      setNeedsSetup(true);
      return;
    }

    // Turso credentials already exist — proceed normally
    initDbClient(storedUrl, storedToken);
    setTursoUrl(storedUrl);
    await initDb();
    const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
    await seedDefaultCategories(user.id);
    setAuthUser(user);
  }, []);

  const completeSetup = useCallback(async (url: string, authToken: string) => {
    // Initialize and validate DB connection
    initDbClient(url, authToken);
    await initDb();

    // Store credentials locally
    const store = await getStore();
    await store.set(TURSO_URL_KEY, url);
    await store.set(TURSO_TOKEN_KEY, authToken);
    await store.save();

    // Complete user registration with pending or stored auth
    let userInfo: { sub: string; email: string; name: string; picture?: string };
    if (pendingAuth) {
      userInfo = pendingAuth.userInfo;
      setPendingAuth(null);
    } else {
      // Restoring from stored refresh token
      const stored = await store.get<StoredAuth>(AUTH_KEY);
      if (!stored?.refresh_token) throw new Error('No auth session found');
      const result = await refreshAccessToken(stored.refresh_token);
      userInfo = result.userInfo;
    }

    const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
    await seedDefaultCategories(user.id);
    setNeedsSetup(false);
    setAuthUser(user);
  }, [pendingAuth]);

  const logout = useCallback(async () => {
    const store = await getStore();
    await store.delete(AUTH_KEY);
    await store.save();
    setAuthUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, needsSetup, loading, login, logout, completeSetup }}>
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
