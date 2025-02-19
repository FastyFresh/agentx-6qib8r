import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.6.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import { reducer, actions } from '../../src/store/auth/authSlice';
import { authService } from '../../src/services/authService';
import { AuthState } from '../../src/store/auth/types';
import { UserRole } from '../../src/types/auth.types';

// Mock auth service
jest.mock('../../src/services/authService');

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;
  
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    role: UserRole.ADMIN,
    permissions: ['create:agent', 'read:agent'],
    lastLogin: new Date(),
    mfaEnabled: true
  };

  const mockInitialState: AuthState = {
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
  };

  beforeEach(() => {
    store = configureStore({
      reducer: { auth: reducer },
      preloadedState: {
        auth: mockInitialState
      }
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('reducer', () => {
    it('should return initial state', () => {
      expect(store.getState().auth).toEqual(mockInitialState);
    });

    it('should handle clearError action', () => {
      store.dispatch(actions.clearError());
      expect(store.getState().auth.error).toBeNull();
    });

    it('should handle clearMFAState action', () => {
      const stateWithMFA = {
        ...mockInitialState,
        mfaRequired: true,
        mfaToken: 'mfa-token'
      };
      store = configureStore({
        reducer: { auth: reducer },
        preloadedState: { auth: stateWithMFA }
      });

      store.dispatch(actions.clearMFAState());
      expect(store.getState().auth.mfaRequired).toBeFalse();
      expect(store.getState().auth.mfaToken).toBeNull();
    });
  });

  describe('login thunk', () => {
    const mockLoginCredentials = {
      email: 'test@example.com',
      password: 'password123',
      rememberMe: true
    };

    it('should handle successful login without MFA', async () => {
      const mockResponse = {
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiry: Date.now() + 3600000
      };

      (authService.login as jest.Mock).mockResolvedValueOnce(mockResponse);

      await store.dispatch(actions.login(mockLoginCredentials));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe(mockResponse.accessToken);
      expect(state.refreshToken).toBe(mockResponse.refreshToken);
      expect(state.tokenExpiry).toBe(mockResponse.tokenExpiry);
      expect(state.error).toBeNull();
    });

    it('should handle login requiring MFA', async () => {
      const mockResponse = {
        mfaRequired: true,
        mfaToken: 'mfa-token'
      };

      (authService.login as jest.Mock).mockResolvedValueOnce(mockResponse);

      await store.dispatch(actions.login(mockLoginCredentials));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.mfaRequired).toBe(true);
      expect(state.mfaToken).toBe(mockResponse.mfaToken);
      expect(state.error).toBeNull();
    });

    it('should handle login failure', async () => {
      const mockError = {
        code: 'AUTH_ERROR',
        message: 'Invalid credentials',
        status: 401
      };

      (authService.login as jest.Mock).mockRejectedValueOnce(mockError);

      await store.dispatch(actions.login(mockLoginCredentials));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toEqual(mockError);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('verifyMFA thunk', () => {
    const mockMFAData = {
      code: '123456',
      mfaToken: 'mfa-token',
      rememberDevice: true
    };

    it('should handle successful MFA verification', async () => {
      const mockResponse = {
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiry: Date.now() + 3600000,
        deviceId: 'device-123'
      };

      (authService.verifyMFA as jest.Mock).mockResolvedValueOnce(mockResponse);

      await store.dispatch(actions.verifyMFA(mockMFAData));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe(mockResponse.accessToken);
      expect(state.refreshToken).toBe(mockResponse.refreshToken);
      expect(state.mfaRequired).toBe(false);
      expect(state.mfaToken).toBeNull();
      expect(state.rememberedDevices).toContain(mockResponse.deviceId);
    });

    it('should handle MFA verification failure', async () => {
      const mockError = {
        code: 'MFA_ERROR',
        message: 'Invalid MFA code',
        status: 401
      };

      (authService.verifyMFA as jest.Mock).mockRejectedValueOnce(mockError);

      await store.dispatch(actions.verifyMFA(mockMFAData));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toEqual(mockError);
      expect(state.isLoading).toBe(false);
      expect(state.mfaRequired).toBe(true);
    });
  });

  describe('refreshToken thunk', () => {
    it('should handle successful token refresh', async () => {
      const mockResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenExpiry: Date.now() + 3600000
      };

      (authService.refreshToken as jest.Mock).mockResolvedValueOnce(mockResponse);

      await store.dispatch(actions.refreshToken('old-refresh-token'));
      const state = store.getState().auth;

      expect(state.accessToken).toBe(mockResponse.accessToken);
      expect(state.refreshToken).toBe(mockResponse.refreshToken);
      expect(state.tokenExpiry).toBe(mockResponse.tokenExpiry);
      expect(state.error).toBeNull();
    });

    it('should handle token refresh failure', async () => {
      const mockError = {
        code: 'TOKEN_ERROR',
        message: 'Invalid refresh token',
        status: 401
      };

      (authService.refreshToken as jest.Mock).mockRejectedValueOnce(mockError);

      await store.dispatch(actions.refreshToken('old-refresh-token'));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.error).toEqual(mockError);
    });
  });

  describe('logout thunk', () => {
    it('should handle successful logout', async () => {
      const initialStateWithAuth = {
        ...mockInitialState,
        isAuthenticated: true,
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      store = configureStore({
        reducer: { auth: reducer },
        preloadedState: { auth: initialStateWithAuth }
      });

      (authService.logout as jest.Mock).mockResolvedValueOnce();

      await store.dispatch(actions.logout());
      const state = store.getState().auth;

      expect(state).toEqual(mockInitialState);
    });

    it('should handle logout failure but still clear state', async () => {
      const mockError = {
        code: 'LOGOUT_ERROR',
        message: 'Logout failed',
        status: 500
      };

      (authService.logout as jest.Mock).mockRejectedValueOnce(mockError);

      await store.dispatch(actions.logout());
      const state = store.getState().auth;

      expect(state).toEqual(mockInitialState);
    });
  });
});