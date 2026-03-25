import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserSettings } from '../types';
import { getUserSettings, updateUserSettings as dbUpdateUserSettings, getGravatarUrl } from '../db';

interface UserContextType {
  user: UserSettings | null;
  avatar: string;
  loading: boolean;
  updateSettings: (name: string, email: string, debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserSettings | null>(null);
  const [avatar, setAvatar] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const userData = await getUserSettings();
    if (userData) {
      setUser(userData);
      const gravatar = await getGravatarUrl(userData.email);
      setAvatar(gravatar);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const updateSettings = async (name: string, email: string, debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) => {
    await dbUpdateUserSettings(name, email, debugSpeed, experienceLvl, dayStartHour, dayEndHour);
    await refreshUser();
  };

  return (
    <UserContext.Provider value={{ user, avatar, loading, updateSettings, refreshUser }}>
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
