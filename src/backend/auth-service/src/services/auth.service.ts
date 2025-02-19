// @package-version auth0@3.4.0
// @package-version jsonwebtoken@9.0.1
// @package-version typeorm@0.3.17
import { AuthenticationClient } from 'auth0';
import { verify, sign } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { auth0Config } from '../config/auth0.config';
import { User, UserRole } from '../models/User';

interface AuthResponse {
  accessToken: string;
  user: Omit<User, 'auth0Id'>;
  expiresIn: number;
  tokenType: string;
}

interface TokenValidationResult {
  isValid: boolean;
  user?: User;
  error?: string;
}

interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  recoveryCodes: string[];
}

/**
 * Enhanced authentication service implementing OAuth 2.0 + OIDC with Auth0
 * Includes rate limiting, token blacklisting, and comprehensive security features
 */
export class AuthService {
  private auth0Client: AuthenticationClient;
  private readonly TOKEN_BLACKLIST_KEY = 'token_blacklist:';
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly userRepository: Repository<User>,
    private readonly rateLimiter: RateLimiter,
    private readonly tokenBlacklist: TokenBlacklist,
    private readonly auditLogger: AuditLogger
  ) {
    this.auth0Client = new AuthenticationClient({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      clientSecret: auth0Config.clientSecret
    });
  }

  /**
   * Authenticates user with enhanced security checks and rate limiting
   */
  public async login(
    email: string,
    password: string,
    ipAddress: string
  ): Promise<AuthResponse> {
    try {
      // Check rate limiting for IP address
      await this.rateLimiter.checkLimit(ipAddress);

      // Authenticate with Auth0
      const auth0Response = await this.auth0Client.passwordGrant({
        username: email,
        password,
        audience: auth0Config.audience,
        scope: 'openid profile email'
      });

      // Get or create user in local database
      const auth0User = await this.auth0Client.getUser(auth0Response.access_token);
      let user = await this.userRepository.findOne({ where: { auth0Id: auth0User.sub } });

      if (!user) {
        user = new User({
          auth0Id: auth0User.sub,
          email: auth0User.email,
          role: UserRole.VIEWER
        });
      }

      // Update login information
      user.lastLoginIp = ipAddress;
      user.lastLoginAt = new Date();
      user.loginAttempts = 0;
      await this.userRepository.save(user);

      // Generate enhanced JWT token
      const token = this.generateToken(user);

      // Log successful login
      await this.auditLogger.log({
        action: 'LOGIN',
        userId: user.id,
        ipAddress,
        status: 'SUCCESS'
      });

      return {
        accessToken: token,
        user: this.sanitizeUser(user),
        expiresIn: auth0Config.tokenExpiresIn,
        tokenType: 'Bearer'
      };
    } catch (error) {
      // Handle failed login attempt
      await this.handleFailedLogin(email, ipAddress);
      throw error;
    }
  }

  /**
   * Validates token with enhanced security checks
   */
  public async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Check token blacklist
      const isBlacklisted = await this.tokenBlacklist.isBlacklisted(token);
      if (isBlacklisted) {
        return { isValid: false, error: 'Token has been revoked' };
      }

      // Verify token signature and expiration
      const decoded = verify(token, auth0Config.clientSecret, {
        algorithms: [auth0Config.tokenSigningAlg]
      });

      // Get user from database
      const user = await this.userRepository.findOne({
        where: { id: decoded.sub }
      });

      if (!user || !user.isActive) {
        return { isValid: false, error: 'User not found or inactive' };
      }

      return { isValid: true, user };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Sets up Multi-Factor Authentication for a user
   */
  public async setupMFA(userId: string): Promise<MFASetupResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const mfaResponse = await this.auth0Client.createAuthenticator({
      user_id: user.auth0Id
    });

    user.mfaEnabled = true;
    await this.userRepository.save(user);

    return {
      secret: mfaResponse.secret,
      qrCodeUrl: mfaResponse.barcode_uri,
      recoveryCodes: mfaResponse.recovery_codes
    };
  }

  /**
   * Verifies MFA token for authenticated user
   */
  public async verifyMFA(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaEnabled) {
      throw new Error('MFA not enabled for user');
    }

    return this.auth0Client.verifyOTP({
      user_id: user.auth0Id,
      otp: token
    });
  }

  /**
   * Refreshes access token
   */
  public async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await this.auth0Client.refreshToken({
      refresh_token: refreshToken
    });

    const user = await this.userRepository.findOne({
      where: { auth0Id: response.user_id }
    });

    return {
      accessToken: response.access_token,
      user: this.sanitizeUser(user),
      expiresIn: auth0Config.tokenExpiresIn,
      tokenType: 'Bearer'
    };
  }

  /**
   * Handles failed login attempts and implements account lockout
   */
  private async handleFailedLogin(email: string, ipAddress: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        user.isActive = false;
        // Schedule account unlock
        setTimeout(async () => {
          user.isActive = true;
          user.loginAttempts = 0;
          await this.userRepository.save(user);
        }, this.LOCKOUT_DURATION);
      }
      await this.userRepository.save(user);
    }

    await this.auditLogger.log({
      action: 'LOGIN_FAILED',
      userId: user?.id,
      ipAddress,
      status: 'FAILURE'
    });
  }

  /**
   * Generates enhanced JWT token with user claims
   */
  private generateToken(user: User): string {
    return sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        mfa_enabled: user.mfaEnabled
      },
      auth0Config.clientSecret,
      {
        algorithm: auth0Config.tokenSigningAlg as 'HS256' | 'RS256',
        expiresIn: auth0Config.tokenExpiresIn
      }
    );
  }

  /**
   * Removes sensitive information from user object
   */
  private sanitizeUser(user: User): Omit<User, 'auth0Id'> {
    const { auth0Id, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}