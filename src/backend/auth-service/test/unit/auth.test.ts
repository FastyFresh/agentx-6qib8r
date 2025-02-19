// @package-version jest@29.6.0
// @package-version @auth0/auth0-spa-js@2.1.0
// @package-version jsonwebtoken@9.0.1
// @package-version typeorm@0.3.17

import { AuthService } from '../../src/services/auth.service';
import { User, UserRole } from '../../src/models/User';
import { Repository } from 'typeorm';
import { AuthenticationClient } from 'auth0';
import { verify } from 'jsonwebtoken';
import { auth0Config } from '../../src/config/auth0.config';

// Mock implementations
jest.mock('auth0');
jest.mock('typeorm');
jest.mock('../../src/config/auth0.config');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<Repository<User>>;
  let mockRateLimiter: jest.Mocked<any>;
  let mockTokenBlacklist: jest.Mocked<any>;
  let mockAuditLogger: jest.Mocked<any>;
  let mockAuth0Client: jest.Mocked<AuthenticationClient>;

  const testUser = new User({
    id: '123e4567-e89b-12d3-a456-426614174000',
    auth0Id: 'auth0|123456789',
    email: 'test@example.com',
    role: UserRole.ADMIN,
    mfaEnabled: false,
    isActive: true
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mocks
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    mockRateLimiter = {
      checkLimit: jest.fn(),
    };

    mockTokenBlacklist = {
      isBlacklisted: jest.fn(),
      addToBlacklist: jest.fn(),
    };

    mockAuditLogger = {
      log: jest.fn(),
    };

    mockAuth0Client = new AuthenticationClient({}) as jest.Mocked<AuthenticationClient>;

    authService = new AuthService(
      mockUserRepository,
      mockRateLimiter,
      mockTokenBlacklist,
      mockAuditLogger
    );
  });

  describe('login', () => {
    const loginCredentials = {
      email: 'test@example.com',
      password: 'Test123!',
      ipAddress: '192.168.1.1'
    };

    test('successful login with valid credentials', async () => {
      // Setup mocks
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockUserRepository.findOne.mockResolvedValue(testUser);
      mockAuth0Client.passwordGrant.mockResolvedValue({
        access_token: 'mock_token',
        expires_in: 3600
      });

      const result = await authService.login(
        loginCredentials.email,
        loginCredentials.password,
        loginCredentials.ipAddress
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(loginCredentials.email);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          status: 'SUCCESS'
        })
      );
    });

    test('login failure with rate limiting', async () => {
      mockRateLimiter.checkLimit.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        authService.login(
          loginCredentials.email,
          loginCredentials.password,
          loginCredentials.ipAddress
        )
      ).rejects.toThrow('Rate limit exceeded');
    });

    test('account lockout after multiple failed attempts', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockUserRepository.findOne.mockResolvedValue({
        ...testUser,
        loginAttempts: 4
      });
      mockAuth0Client.passwordGrant.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        authService.login(
          loginCredentials.email,
          loginCredentials.password,
          loginCredentials.ipAddress
        )
      ).rejects.toThrow();

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          loginAttempts: 5,
          isActive: false
        })
      );
    });
  });

  describe('MFA', () => {
    const mfaTestUser = { ...testUser, mfaEnabled: true };
    const testMfaToken = '123456';

    test('successful MFA setup', async () => {
      mockUserRepository.findOne.mockResolvedValue(testUser);
      mockAuth0Client.createAuthenticator.mockResolvedValue({
        secret: 'test_secret',
        barcode_uri: 'test_qr_code',
        recovery_codes: ['code1', 'code2']
      });

      const result = await authService.setupMFA(testUser.id);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeUrl');
      expect(result).toHaveProperty('recoveryCodes');
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          mfaEnabled: true
        })
      );
    });

    test('successful MFA verification', async () => {
      mockUserRepository.findOne.mockResolvedValue(mfaTestUser);
      mockAuth0Client.verifyOTP.mockResolvedValue(true);

      const result = await authService.verifyMFA(mfaTestUser.id, testMfaToken);

      expect(result).toBe(true);
      expect(mockAuth0Client.verifyOTP).toHaveBeenCalledWith({
        user_id: mfaTestUser.auth0Id,
        otp: testMfaToken
      });
    });

    test('MFA verification failure with invalid token', async () => {
      mockUserRepository.findOne.mockResolvedValue(mfaTestUser);
      mockAuth0Client.verifyOTP.mockResolvedValue(false);

      const result = await authService.verifyMFA(mfaTestUser.id, 'invalid_token');

      expect(result).toBe(false);
    });
  });

  describe('role-based access control', () => {
    const testCases = [
      { role: UserRole.SUPER_ADMIN, expectedAccess: true },
      { role: UserRole.ADMIN, expectedAccess: true },
      { role: UserRole.AGENT_MANAGER, expectedAccess: false },
      { role: UserRole.VIEWER, expectedAccess: false }
    ];

    test.each(testCases)('validates access for $role role', async ({ role, expectedAccess }) => {
      const user = { ...testUser, role };
      const token = await authService.login(user.email, 'password', '192.168.1.1');
      const decoded = verify(token.accessToken, auth0Config.clientSecret) as any;

      expect(decoded.role).toBe(role);
      expect(decoded.sub).toBe(user.id);
    });

    test('prevents role elevation attempts', async () => {
      const user = { ...testUser, role: UserRole.VIEWER };
      mockUserRepository.findOne.mockResolvedValue(user);

      await expect(
        authService.validateRoleAccess(user.id, UserRole.ADMIN)
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('security features', () => {
    test('token blacklisting', async () => {
      const token = 'valid_token';
      mockTokenBlacklist.isBlacklisted.mockResolvedValue(true);

      const result = await authService.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has been revoked');
    });

    test('rate limiting enforcement', async () => {
      const ipAddress = '192.168.1.1';
      mockRateLimiter.checkLimit.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        authService.checkRateLimits(ipAddress)
      ).rejects.toThrow('Rate limit exceeded');
    });

    test('token refresh with valid refresh token', async () => {
      const refreshToken = 'valid_refresh_token';
      mockAuth0Client.refreshToken.mockResolvedValue({
        access_token: 'new_access_token',
        user_id: testUser.auth0Id
      });
      mockUserRepository.findOne.mockResolvedValue(testUser);

      const result = await authService.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(testUser.email);
    });
  });
});