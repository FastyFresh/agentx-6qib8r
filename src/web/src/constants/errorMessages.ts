/**
 * Error Message Constants
 * Centralized error messages for consistent error handling across the application
 * @version 1.0.0
 */

import { ErrorCode } from '../types/api.types';

/**
 * Form validation error messages
 * User-friendly messages for input validation feedback
 */
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Please enter a valid password',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  INVALID_MFA_CODE: 'Please enter a valid 6-digit authentication code',
  PASSWORD_REQUIREMENTS: 'Password must be at least 8 characters long and contain uppercase, lowercase, number and special characters',
  INVALID_INPUT_LENGTH: 'Input length must be between {min} and {max} characters'
} as const;

/**
 * API error response messages
 * Generic error messages for API communication issues
 */
export const API_ERRORS = {
  INVALID_INPUT: 'The provided input is invalid or incomplete',
  UNAUTHORIZED: 'Please log in to access this resource',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  RATE_LIMITED: 'Too many requests. Please try again later',
  SERVER_ERROR: 'An unexpected error occurred. Please try again',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
  TIMEOUT: 'Request timed out. Please check your connection'
} as const;

/**
 * Integration-specific error messages
 * Error messages for external service integration issues
 */
export const INTEGRATION_ERRORS = {
  CONNECTION_FAILED: 'Failed to connect to the external service',
  INVALID_CREDENTIALS: 'Invalid integration credentials provided',
  SERVICE_UNAVAILABLE: 'External service is currently unavailable',
  RATE_LIMIT_EXCEEDED: 'External service rate limit exceeded',
  INVALID_CONFIGURATION: 'Invalid integration configuration',
  SYNC_FAILED: 'Failed to synchronize with external service'
} as const;

/**
 * Agent-specific error messages
 * Error messages for AI agent operations
 */
export const AGENT_ERRORS = {
  CREATION_FAILED: 'Failed to create the AI agent',
  INVALID_CONFIGURATION: 'Invalid agent configuration provided',
  DEPLOYMENT_FAILED: 'Agent deployment failed',
  RESOURCE_EXCEEDED: 'Agent resource limits exceeded',
  INVALID_NL_INPUT: 'Please provide a clearer description of the agent requirements',
  TRAINING_FAILED: 'Agent training process failed',
  EXECUTION_ERROR: 'Error occurred during agent execution'
} as const;

/**
 * Error metadata for enhanced error handling and tracking
 * Provides additional context and severity levels for errors
 */
export const ERROR_METADATA = {
  SEVERITY_LEVELS: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  },
  ERROR_CODES: {
    VALIDATION: 'VAL',
    API: 'API',
    INTEGRATION: 'INT',
    AGENT: 'AGT',
    SYSTEM: 'SYS'
  },
  RESOLUTION_HINTS: {
    [ErrorCode.INVALID_INPUT]: 'Review the input requirements and try again',
    [ErrorCode.UNAUTHORIZED]: 'Your session may have expired. Please log in again',
    RATE_LIMITED: 'Wait for a few minutes before retrying',
    CONNECTION_ERROR: 'Check your internet connection and try again',
    CONFIGURATION_ERROR: 'Review the configuration settings and try again'
  }
} as const;

// Freeze all error message objects to prevent modifications
Object.freeze(VALIDATION_ERRORS);
Object.freeze(API_ERRORS);
Object.freeze(INTEGRATION_ERRORS);
Object.freeze(AGENT_ERRORS);
Object.freeze(ERROR_METADATA);