import { authService } from '../../src/services/authService';
import { httpClient } from '../../src/services/httpClient';
import { Auth0Client } from '@auth0/auth0-spa-js'; // ^2.1.0
import { AUTH_ENDPOINTS } from '../../src/constants/apiEndpoints';
import { UserRole, AuthError } from '../../src/types/auth.types';

// Mock Auth0 client
jest.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    loginWithRedirect: jest.fn(),
    handleRedirectCallback: jest.fn(),
    getTokenSilently: jest.fn(),
    isAuthenticated: jest.fn(),
    getUser: jest.fn(),
    logout: jest.fn()
  }))
}));

// Mock HTTP client
jest.mock('../../src/services/httpClient', () => ({
  httpClient: {
    post: jest.fn(),
    get: jest.fn(),
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn()
  }
}));

describe('AuthService', () => {
  let mockAuth0Client: jest.Mocked<Auth0Client>;
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    role: UserRole.ADMIN,
    permissions: ['create:agent', 'read:agent'],
    lastLogin: new Date(),
    mfaEnabled: true
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup Auth0 client mock
    mockAuth0Client = new Auth0Client({}) as jest.Mocked<Auth0Client>;
    (Auth0Client as jest.Mock).mockImplementation(() => mockAuth0Client);
    
    // Reset window location
    delete window.location;
    window.location = new URL('https://app.example.com') as any;
    
    // Setup performance monitoring
    jest.spyOn(window.performance, 'now').mockImplementation(() => 0);
  });

  describe('Core Authentication', () => {
    test('should initialize Auth0 client successfully', async () => {
      mockAuth0Client.isAuthenticated.mockResolvedValue(false);
      
      await authService.initialize();
      
      expect(Auth0Client).toHaveBeenCalledWith(expect.any(Object));
      expect(mockAuth0Client.isAuthenticated).toHaveBeenCalled();
    });

    test('should handle login with correct credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true
      };

      await authService.login(credentials);

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'none',
          connection: 'username-password-authentication'
        })
      );
    });

    test('should handle login rate limiting', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrong',
        rememberMe: false
      };

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        try {
          await authService.login(credentials);
        } catch (error) {
          // Expected to fail
        }
      }

      await expect(authService.login(credentials))
        .rejects
        .toThrow('Too many login attempts');
    });

    test('should handle token refresh', async () => {
      const mockToken = 'new.access.token';
      mockAuth0Client.getTokenSilently.mockResolvedValue(mockToken);
      
      await authService.initialize();
      await (authService as any).refreshToken();

      expect(mockAuth0Client.getTokenSilently).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutInSeconds: 10 })
      );
      expect(httpClient.setAuthToken).toHaveBeenCalledWith(mockToken);
    });
  });

  describe('MFA Verification', () => {
    test('should verify MFA code successfully', async () => {
      const verificationData = {
        code: '123456',
        mfaToken: 'mfa.token.123',
        rememberDevice: true
      };

      httpClient.post.mockResolvedValue({
        data: { token: 'new.access.token' }
      });

      await authService.verifyMFA(verificationData);

      expect(httpClient.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.VERIFY_2FA,
        verificationData
      );
      expect(httpClient.setAuthToken).toHaveBeenCalledWith('new.access.token');
    });

    test('should handle MFA verification failure', async () => {
      const verificationData = {
        code: 'wrong',
        mfaToken: 'mfa.token.123',
        rememberDevice: false
      };

      httpClient.post.mockRejectedValue(new Error('Invalid MFA code'));

      await expect(authService.verifyMFA(verificationData))
        .rejects
        .toThrow('Invalid MFA code');
    });
  });

  describe('SSO Integration', () => {
    test('should handle enterprise SSO login', async () => {
      const credentials = {
        email: 'user@company.com',
        password: 'password123',
        rememberMe: true
      };

      await authService.login(credentials);

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: 'company-sso'
        })
      );
    });

    test('should handle SSO callback', async () => {
      const mockAppState = { returnTo: '/dashboard' };
      mockAuth0Client.handleRedirectCallback.mockResolvedValue({ appState: mockAppState });
      mockAuth0Client.getTokenSilently.mockResolvedValue('new.access.token');
      
      window.location.search = '?code=auth0code';
      
      await authService.initialize();

      expect(mockAuth0Client.handleRedirectCallback).toHaveBeenCalled();
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        document.title,
        '/dashboard'
      );
    });
  });

  describe('Security Monitoring', () => {
    test('should log authentication events', async () => {
      const mockDispatchEvent = jest.spyOn(window, 'dispatchEvent');
      
      mockAuth0Client.getTokenSilently.mockRejectedValue(new Error('Token expired'));
      
      try {
        await (authService as any).refreshToken();
      } catch (error) {
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'auth:error',
            detail: expect.objectContaining({
              code: 'AUTH_ERROR'
            })
          })
        );
      }
    });

    test('should handle suspicious activity', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrong',
        rememberMe: false
      };

      // Simulate suspicious activity with rapid login attempts
      const attempts = Array(3).fill(null).map(() => authService.login(credentials));
      
      await Promise.allSettled(attempts);

      const lastAttempt = authService.login(credentials);
      await expect(lastAttempt).rejects.toThrow('Too many login attempts');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should initialize within performance threshold', async () => {
      const start = performance.now();
      
      await authService.initialize();
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // 1 second threshold
    });

    test('should handle token refresh within threshold', async () => {
      mockAuth0Client.getTokenSilently.mockResolvedValue('new.access.token');
      
      const start = performance.now();
      
      await (authService as any).refreshToken();
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200); // 200ms threshold
    });
  });
});