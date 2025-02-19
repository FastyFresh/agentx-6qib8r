/**
 * Core TypeScript type definitions for API-related interfaces
 * Provides type safety for API communications throughout the frontend application
 * @version 1.0.0
 */

import { AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import { API_VERSION } from '../constants/apiEndpoints';

/**
 * Standardized API response status values
 */
export enum ResponseStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  PENDING = 'PENDING',
  RATE_LIMITED = 'RATE_LIMITED'
}

/**
 * Generic interface for standardized API responses with enhanced tracking
 * @template T - The type of data contained in the response
 */
export interface ApiResponse<T = unknown> {
  data: T;
  status: ResponseStatus;
  message: string;
  timestamp: string;
  requestId: string;
}

/**
 * Enhanced interface for API error responses with detailed tracking information
 */
export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  status: number;
  timestamp: string;
  path: string;
  requestId: string;
}

/**
 * Extended interface for API request configuration with retry and rate limiting
 * Extends the base Axios request config with additional platform-specific options
 */
export interface ApiRequestConfig extends AxiosRequestConfig {
  headers: Record<string, string>;
  timeout: number;
  params: Record<string, unknown>;
  withCredentials: boolean;
  retryConfig: {
    attempts: number;
    delay: number;
  };
  rateLimitConfig: {
    maxRequests: number;
    windowMs: number;
  };
}

/**
 * Enhanced generic interface for paginated API responses with navigation helpers
 * @template T - The type of items being paginated
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Comprehensive enum of all available API endpoints in the system
 * Paths are prefixed with the current API version
 */
export enum ApiEndpoint {
  AGENTS = `${API_VERSION}/agents`,
  INTEGRATIONS = `${API_VERSION}/integrations`,
  METRICS = `${API_VERSION}/metrics`,
  AUTH = `${API_VERSION}/auth`,
  USERS = `${API_VERSION}/users`,
  SYSTEM = `${API_VERSION}/system`
}

/**
 * Type guard to check if a response is an API error
 * @param response - The response to check
 */
export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    'status' in response
  );
}

/**
 * Type guard to check if a response is paginated
 * @param response - The response to check
 */
export function isPaginatedResponse<T>(
  response: unknown
): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'items' in response &&
    'total' in response &&
    'page' in response
  );
}

/**
 * Helper type for API response handlers
 */
export type ApiResponseHandler<T> = (
  response: AxiosResponse<ApiResponse<T>>
) => void;

/**
 * Helper type for API error handlers
 */
export type ApiErrorHandler = (error: ApiError) => void;