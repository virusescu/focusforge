import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserSettings } from '../types';
import { getUserSettings, updateUserSettings as dbUpdateUserSettings } from '../db';
import { useAuth } from './AuthContext';

interface UserContextType {
  user: UserSettings | null;
  avatar: string;
  name: string;
  email: string;
  loading: boolean;
  updateSettings: (debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { authUser } = useAuth();
  const [user, setUser] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!authUser) return;
    const userData = await getUserSettings(authUser.id);
    if (userData) {
      setUser(userData);
    }
    setLoading(false);
  }, [authUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const updateSettings = async (debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) => {
    if (!authUser) return;
    await dbUpdateUserSettings(authUser.id, debugSpeed, experienceLvl, dayStartHour, dayEndHour);
    await refreshUser();
  };

  // Name, email, avatar come from Google (via AuthContext)
  const name = authUser?.name ?? '';
  const email = authUser?.email ?? '';
  const avatar = authUser?.avatar_url ?? '';

  return (
    <UserContext.Provider value={{ user, avatar, name, email, loading, updateSettings, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
