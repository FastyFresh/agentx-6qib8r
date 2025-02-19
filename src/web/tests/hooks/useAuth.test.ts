import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.0.5
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import { waitFor } from '@testing-library/react'; // ^13.4.0
import { useAuth } from '../../src/hooks/useAuth';
import { authActions } from '../../src/store/auth/authSlice';
import { ResponseStatus } from '../../src/types/api.types';
import { UserRole } from '../../src/types/auth.types';

// Mock Redux store setup
const mockStore = configureStore({
  reducer: {
    auth: (state = {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      mfaRequired: false,
      mfaToken: null,
      rememberedDevices: []
    }, action) => state
  }
});

// Mock test data
const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: UserRole.AGENT_MANAGER,
  permissions: ['create:agent', 'read:agent'],
  mfaEnabled: false,
  lastLogin: new Date().toISOString()
};

const mockAdmin = {
  id: '2',
  email: 'admin@example.com',
  name: 'Admin User',
  role: UserRole.ADMIN,
  permissions: ['*'],
  mfaEnabled: true,
  lastLogin: new Date().toISOString()
};

const mockMFASecret = 'ABCDEFGHIJKLMNOP';
const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

describe('useAuth Hook', () => {
  // Setup test environment
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={mockStore}>{children}</Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockStore.dispatch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle successful login without MFA', async () => {
    const credentials = {
      email: mockUser.email,
      password: 'password123',
      rememberMe: false
    };

    mockStore.dispatch = jest.fn().mockResolvedValueOf({
      payload: {
        user: mockUser,
        accessToken: mockJWT,
        status: ResponseStatus.SUCCESS
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(credentials);
    });

    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('auth/login')
      })
    );
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('should handle MFA enrollment process', async () => {
    const enrollData = {
      userId: mockUser.id,
      secret: mockMFASecret
    };

    mockStore.dispatch = jest.fn().mockResolvedValueOf({
      payload: {
        success: true,
        qrCode: 'data:image/png;base64,...',
        secret: mockMFASecret
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.enrollMFA(enrollData);
    });

    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('auth/enrollMFA')
      })
    );
  });

  it('should handle MFA verification', async () => {
    const verificationData = {
      code: '123456',
      mfaToken: 'mfa-token',
      rememberDevice: true
    };

    mockStore.dispatch = jest.fn().mockResolvedValueOf({
      payload: {
        success: true,
        accessToken: mockJWT,
        user: mockAdmin
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.verifyMFA(verificationData);
    });

    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('auth/verifyMFA')
      })
    );
  });

  it('should handle login rate limiting', async () => {
    const credentials = {
      email: mockUser.email,
      password: 'wrongpassword',
      rememberMe: false
    };

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      mockStore.dispatch = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
      
      await act(async () => {
        try {
          await result.current.login(credentials);
        } catch (error) {
          // Expected error
        }
      });
    }

    // Verify account is locked
    expect(result.current.isLocked).toBe(true);
    expect(result.current.loginAttempts).toBe(5);

    // Wait for lockout period and try again
    jest.advanceTimersByTime(15 * 60 * 1000); // 15 minutes

    expect(result.current.isLocked).toBe(false);
    expect(result.current.loginAttempts).toBe(0);
  });

  it('should handle role-based access control', async () => {
    mockStore.dispatch = jest.fn().mockResolvedValueOf({
      payload: {
        user: mockAdmin,
        accessToken: mockJWT,
        status: ResponseStatus.SUCCESS
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: mockAdmin.email,
        password: 'password123',
        rememberMe: false
      });
    });

    expect(result.current.user?.role).toBe(UserRole.ADMIN);
    expect(result.current.hasPermission('create:agent')).toBe(true);
  });

  it('should handle session timeout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Set initial authenticated state
    await act(async () => {
      mockStore.dispatch = jest.fn().mockResolvedValueOf({
        payload: {
          user: mockUser,
          accessToken: mockJWT,
          status: ResponseStatus.SUCCESS
        }
      });
    });

    // Advance time beyond session timeout
    jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('auth/logout')
        })
      );
    });
  });

  it('should handle logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('auth/logout')
      })
    );
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should track user activity', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    const initialLastActivity = result.current.lastActivity;

    // Simulate user activity
    await act(async () => {
      result.current.updateActivity();
    });

    expect(result.current.lastActivity.getTime()).toBeGreaterThan(
      initialLastActivity.getTime()
    );
  });

  it('should handle authentication errors', async () => {
    mockStore.dispatch = jest.fn().mockRejectedValue(
      new Error('Authentication failed')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login({
          email: 'invalid@example.com',
          password: 'wrongpassword',
          rememberMe: false
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Authentication failed');
      }
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});