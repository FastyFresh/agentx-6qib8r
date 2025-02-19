// @auth0/auth0-spa-js v2.1.0
import { User as Auth0User } from '@auth0/auth0-spa-js';

/**
 * Enum defining available user roles in the system with corresponding access levels
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  AGENT_MANAGER = 'AGENT_MANAGER',
  VIEWER = 'VIEWER'
}

/**
 * Extended user interface with additional properties for application-specific user data
 * and security features. Extends the base Auth0 user type.
 */
export interface User extends Auth0User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: UserRole;
  permissions: string[];
  lastLogin: Date;
  mfaEnabled: boolean;
}

/**
 * Comprehensive interface defining the authentication state structure
 * with token management and MFA status
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: AuthError | null;
  accessToken: string | null;
  expiresAt: number | null;
  isMFARequired: boolean;
}

/**
 * Enhanced error interface for authentication-specific errors
 * with detailed information
 */
export interface AuthError {
  code: string;
  message: string;
  originalError: Error | null;
}

/**
 * Interface for login request payload with remember me option
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Interface for MFA verification request payload with device remember option
 */
export interface MFAVerificationData {
  code: string;
  mfaToken: string;
  rememberDevice: boolean;
}