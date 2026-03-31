import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from './UserContext';
import type { ReactNode } from 'react';

// Mock DB
vi.mock('../db', () => ({
  getUserSettings: vi.fn().mockResolvedValue({
    id: 1,
    name: 'TEST_OP',
    email: 'test@example.com',
    debug_speed: 1.0,
    experience_lvl: 42
  }),
  updateUserSettings: vi.fn().mockResolvedValue(undefined),
  getGravatarUrl: vi.fn().mockResolvedValue('https://mock-avatar.com')
}));

const STABLE_AUTH_USER = {
  id: 1,
  name: 'TEST_OP',
  email: 'test@example.com',
  avatar_url: 'https://mock-avatar.com'
};

// Mock AuthContext
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    authUser: STABLE_AUTH_USER,
    loading: false,
    signOut: vi.fn()
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <UserProvider>{children}</UserProvider>
);

describe('UserContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides user data and loading state', async () => {
    const { result } = renderHook(() => useUser(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.name).toBe('TEST_OP');
    expect(result.current.avatar).toBe('https://mock-avatar.com');
  });

  it('throws error if used outside provider', () => {
    // Suppress console.error for this test as it's expected
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => renderHook(() => useUser())).toThrow('useUser must be used within a UserProvider');
    
    consoleSpy.mockRestore();
  });
});
