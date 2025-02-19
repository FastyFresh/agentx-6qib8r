import { PayloadAction } from '@reduxjs/toolkit';
import { User, ApiError } from '../../types/auth.types';

/**
 * Comprehensive interface for authentication state management
 * including OAuth 2.0 + OIDC, MFA, and token management
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: ApiError | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  mfaRequired: boolean;
  mfaToken: string | null;
  rememberedDevices: string[];
}

/**
 * Enum defining all possible authentication action types
 * for Redux state management
 */
export enum AuthActionTypes {
  LOGIN_REQUEST = 'auth/loginRequest',
  LOGIN_SUCCESS = 'auth/loginSuccess',
  LOGIN_FAILURE = 'auth/loginFailure',
  LOGOUT = 'auth/logout',
  TOKEN_REFRESH_REQUEST = 'auth/tokenRefreshRequest',
  TOKEN_REFRESH_SUCCESS = 'auth/tokenRefreshSuccess',
  TOKEN_REFRESH_FAILURE = 'auth/tokenRefreshFailure',
  MFA_REQUIRED = 'auth/mfaRequired',
  MFA_VERIFY_REQUEST = 'auth/mfaVerifyRequest',
  MFA_VERIFY_SUCCESS = 'auth/mfaVerifySuccess',
  MFA_VERIFY_FAILURE = 'auth/mfaVerifyFailure',
  REMEMBER_DEVICE_REQUEST = 'auth/rememberDeviceRequest',
  REMEMBER_DEVICE_SUCCESS = 'auth/rememberDeviceSuccess',
  REMEMBER_DEVICE_FAILURE = 'auth/rememberDeviceFailure'
}

/**
 * Interface for login request payload with remember me functionality
 */
export interface LoginPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Interface for MFA verification payload with device remember functionality
 */
export interface MFAPayload {
  code: string;
  mfaToken: string;
  deviceId: string;
  rememberDevice: boolean;
}

/**
 * Interface for token refresh operations
 */
export interface TokenRefreshPayload {
  refreshToken: string;
}

// Type definitions for Redux actions with PayloadAction
export type LoginRequestAction = PayloadAction<LoginPayload>;
export type LoginSuccessAction = PayloadAction<{
  user: User;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}>;
export type LoginFailureAction = PayloadAction<ApiError>;
export type LogoutAction = PayloadAction<void>;
export type TokenRefreshRequestAction = PayloadAction<TokenRefreshPayload>;
export type TokenRefreshSuccessAction = PayloadAction<{
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}>;
export type TokenRefreshFailureAction = PayloadAction<ApiError>;
export type MFARequiredAction = PayloadAction<{
  mfaToken: string;
}>;
export type MFAVerifyRequestAction = PayloadAction<MFAPayload>;
export type MFAVerifySuccessAction = PayloadAction<{
  user: User;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}>;
export type MFAVerifyFailureAction = PayloadAction<ApiError>;
export type RememberDeviceRequestAction = PayloadAction<{
  deviceId: string;
}>;
export type RememberDeviceSuccessAction = PayloadAction<{
  deviceId: string;
}>;
export type RememberDeviceFailureAction = PayloadAction<ApiError>;