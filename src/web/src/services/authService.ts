/**
 * Enhanced Authentication Service
 * Manages authentication operations with Auth0 integration, MFA support, and SSO capabilities
 * @version 1.0.0
 */

import { Auth0Client, createAuth0Client } from '@auth0/auth0-spa-js'; // ^2.1.0
import { httpClient, setAuthToken } from './httpClient';
import { authConfig } from '../config/auth.config';
import { User, AuthError, LoginCredentials, MFAVerificationData, UserRole } from '../types/auth.types';
import { AUTH_ENDPOINTS } from '../constants/apiEndpoints';
import { ApiResponse } from '../types/api.types';

class AuthService {
  private static instance: AuthService;
  private auth0Client: Auth0Client | null = null;
  private currentUser: User | null = null;
  private accessToken: string | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Gets singleton instance of AuthService
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initializes Auth0 client and authentication state
   */
  public async initialize(): Promise<void> {
    try {
      this.auth0Client = await createAuth0Client({
        ...authConfig,
        onRedirectCallback: (appState) => {
          window.history.replaceState(
            {},
            document.title,
            appState?.returnTo || window.location.pathname
          );
        }
      });

      // Handle redirect callback from Auth0
      if (window.location.search.includes('code=')) {
        await this.handleRedirectCallback();
      }

      // Check and restore authentication state
      const isAuthenticated = await this.auth0Client.isAuthenticated();
      if (isAuthenticated) {
        await this.loadUserProfile();
        this.setupTokenRefresh();
      }
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Initiates login process with rate limiting and security checks
   */
  public async login(credentials: LoginCredentials): Promise<void> {
    try {
      if (!this.auth0Client) {
        throw new Error('Auth0 client not initialized');
      }

      // Check rate limiting
      if (this.isLoginRateLimited(credentials.email)) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Detect enterprise domain for SSO
      const domain = credentials.email.split('@')[1];
      const options = {
        ...authConfig.authorizationParams,
        connection: this.getConnectionForDomain(domain),
        prompt: credentials.rememberMe ? 'none' : 'login'
      };

      await this.auth0Client.loginWithRedirect(options);
    } catch (error) {
      this.recordLoginAttempt(credentials.email);
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Verifies MFA code and completes authentication
   */
  public async verifyMFA(verificationData: MFAVerificationData): Promise<void> {
    try {
      if (!this.auth0Client) {
        throw new Error('Auth0 client not initialized');
      }

      const response = await httpClient.post<{ token: string }>(
        AUTH_ENDPOINTS.VERIFY_2FA,
        {
          code: verificationData.code,
          mfaToken: verificationData.mfaToken,
          rememberDevice: verificationData.rememberDevice
        }
      );

      if (response.data.token) {
        await this.handleAuthenticationSuccess(response.data.token);
      }
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Logs out user and cleans up authentication state
   */
  public async logout(): Promise<void> {
    try {
      if (!this.auth0Client) {
        throw new Error('Auth0 client not initialized');
      }

      // Clear local auth state
      this.clearAuthState();

      // Logout from Auth0
      await this.auth0Client.logout({
        logoutParams: {
          returnTo: window.location.origin
        }
      });

      // Notify backend of logout
      await httpClient.post(AUTH_ENDPOINTS.LOGOUT, {});
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Gets current access token
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Gets current authenticated user
   */
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Handles Auth0 redirect callback
   */
  private async handleRedirectCallback(): Promise<void> {
    try {
      if (!this.auth0Client) {
        throw new Error('Auth0 client not initialized');
      }

      const { appState } = await this.auth0Client.handleRedirectCallback();
      const token = await this.auth0Client.getTokenSilently();
      await this.handleAuthenticationSuccess(token);

      // Restore original route if available
      if (appState?.returnTo) {
        window.history.replaceState({}, document.title, appState.returnTo);
      }
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Loads user profile after successful authentication
   */
  private async loadUserProfile(): Promise<void> {
    try {
      if (!this.auth0Client) {
        throw new Error('Auth0 client not initialized');
      }

      const user = await this.auth0Client.getUser();
      if (!user) {
        throw new Error('Failed to load user profile');
      }

      // Extend Auth0 user with application-specific data
      const response = await httpClient.get<User>(`${AUTH_ENDPOINTS.BASE}/profile`);
      this.currentUser = {
        ...user,
        ...response.data,
        role: response.data.role as UserRole
      };
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Sets up automatic token refresh
   */
  private setupTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Refresh token 5 minutes before expiry
    const refreshBuffer = 5 * 60 * 1000;
    const expiresIn = this.getTokenExpiryTime();
    
    if (expiresIn) {
      this.tokenRefreshTimer = setTimeout(
        () => this.refreshToken(),
        expiresIn - refreshBuffer
      );
    }
  }

  /**
   * Refreshes access token
   */
  private async refreshToken(): Promise<void> {
    try {
      if (!this.auth0Client) {
        throw new Error('Auth0 client not initialized');
      }

      const token = await this.auth0Client.getTokenSilently({
        timeoutInSeconds: 10
      });
      await this.handleAuthenticationSuccess(token);
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Handles successful authentication
   */
  private async handleAuthenticationSuccess(token: string): Promise<void> {
    this.accessToken = token;
    setAuthToken(token);
    await this.loadUserProfile();
    this.setupTokenRefresh();
  }

  /**
   * Clears authentication state
   */
  private clearAuthState(): void {
    this.currentUser = null;
    this.accessToken = null;
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    setAuthToken('');
  }

  /**
   * Handles authentication errors
   */
  private handleAuthError(error: Error): void {
    const authError: AuthError = {
      code: 'AUTH_ERROR',
      message: error.message,
      originalError: error
    };
    
    // Emit auth error event
    window.dispatchEvent(new CustomEvent('auth:error', {
      detail: authError
    }));

    throw authError;
  }

  /**
   * Checks if login is rate limited for an email
   */
  private isLoginRateLimited(email: string): boolean {
    const attempts = this.loginAttempts.get(email);
    if (!attempts) return false;

    const now = Date.now();
    if (now - attempts.lastAttempt > this.LOCKOUT_DURATION) {
      this.loginAttempts.delete(email);
      return false;
    }

    return attempts.count >= this.MAX_LOGIN_ATTEMPTS;
  }

  /**
   * Records a failed login attempt
   */
  private recordLoginAttempt(email: string): void {
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
    this.loginAttempts.set(email, {
      count: attempts.count + 1,
      lastAttempt: Date.now()
    });
  }

  /**
   * Gets connection type for email domain
   */
  private getConnectionForDomain(domain: string): string {
    // Add enterprise connection mappings here
    const enterpriseConnections: Record<string, string> = {
      'company.com': 'company-sso'
    };
    return enterpriseConnections[domain] || 'username-password-authentication';
  }

  /**
   * Gets token expiry time in milliseconds
   */
  private getTokenExpiryTime(): number | null {
    if (!this.accessToken) return null;
    
    try {
      const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
      return (payload.exp * 1000) - Date.now();
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();