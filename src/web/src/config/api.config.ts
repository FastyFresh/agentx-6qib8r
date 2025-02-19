/**
 * API Configuration
 * Defines global API settings, security headers, and retry policies
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { API_VERSION } from 'constants/apiEndpoints';
import { ApiRequestConfig } from 'types/api.types';
import { randomBytes } from 'crypto-js'; // ^4.1.1

// Validation schema for API configuration
const apiConfigSchema = z.object({
  baseURL: z.string().url(),
  version: z.string(),
  timeout: z.number().min(50).max(200),
  retryAttempts: z.number().min(0).max(5),
  retryDelay: z.number().min(100).max(5000),
  maxRetryDelay: z.number().min(1000).max(30000),
  defaultHeaders: z.record(z.string())
});

/**
 * Validates the completeness and correctness of API configuration
 * @throws {ZodError} If configuration is invalid
 */
export const validateApiConfig = (): void => {
  try {
    // Validate environment variables
    if (!process.env.VITE_API_BASE_URL) {
      throw new Error('API base URL is not defined');
    }

    // Validate configuration against schema
    apiConfigSchema.parse({
      baseURL: process.env.VITE_API_BASE_URL,
      version: API_VERSION,
      timeout: Number(process.env.VITE_API_TIMEOUT) || 200,
      retryAttempts: Number(process.env.VITE_API_MAX_RETRIES) || 3,
      retryDelay: Number(process.env.VITE_API_RETRY_DELAY) || 1000,
      maxRetryDelay: 30000,
      defaultHeaders: apiConfig.defaultHeaders
    });
  } catch (error) {
    console.error('API configuration validation failed:', error);
    throw error;
  }
};

/**
 * Generates a unique request ID for API call tracking
 * Format: timestamp-randomhex
 */
export const generateRequestId = (): string => {
  const timestamp = Date.now().toString(16);
  const random = randomBytes(8).toString('hex');
  return `${timestamp}-${random}`;
};

/**
 * Global API configuration object
 * Contains all settings for API communication
 */
export const apiConfig: ApiRequestConfig = {
  // Base configuration
  baseURL: process.env.VITE_API_BASE_URL || '',
  version: API_VERSION,
  timeout: Number(process.env.VITE_API_TIMEOUT) || 200,
  retryAttempts: Number(process.env.VITE_API_MAX_RETRIES) || 3,
  retryDelay: Number(process.env.VITE_API_RETRY_DELAY) || 1000,
  maxRetryDelay: 30000,

  // Security headers
  defaultHeaders: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Request-ID': generateRequestId(),
    'X-API-Version': API_VERSION,
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  },

  // Request configuration
  withCredentials: true,
  validateStatus: (status: number) => status >= 200 && status < 300,

  // Retry configuration
  retryConfig: {
    attempts: Number(process.env.VITE_API_MAX_RETRIES) || 3,
    delay: Number(process.env.VITE_API_RETRY_DELAY) || 1000,
    shouldRetry: (error: any) => {
      const status = error?.response?.status;
      return status === 429 || status >= 500;
    },
    onRetry: (retryCount: number, error: any) => {
      console.warn(
        `API request retry attempt ${retryCount} due to error:`,
        error
      );
    }
  },

  // Rate limiting configuration
  rateLimitConfig: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    delayAfterExceeding: 1000
  }
} as const;

// Validate configuration on import
validateApiConfig();

// Freeze configuration to prevent runtime modifications
Object.freeze(apiConfig);
Object.freeze(apiConfig.defaultHeaders);
Object.freeze(apiConfig.retryConfig);
Object.freeze(apiConfig.rateLimitConfig);