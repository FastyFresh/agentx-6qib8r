/**
 * Enhanced API Utility Functions
 * Provides secure API communication, comprehensive error handling, and response validation
 * @version 1.0.0
 */

import { AxiosError } from 'axios'; // ^1.4.0
import { 
  ApiResponse, 
  ApiError, 
  ResponseStatus,
  isApiError 
} from '../types/api.types';
import { API_ERRORS } from '../constants/errorMessages';

/**
 * Configuration interface for retry mechanism
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry: (error: Error) => boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  shouldRetry: (error: Error) => {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      return status === 429 || (status >= 500 && status <= 599);
    }
    return false;
  }
};

/**
 * Enhanced response handler with security validation and structure verification
 * @param response - The API response to process
 * @returns Validated and sanitized response data
 * @throws ApiError if validation fails
 */
export function handleApiResponse<T>(response: ApiResponse<T>): T {
  if (!validateResponseStructure(response)) {
    throw new Error(API_ERRORS.INVALID_INPUT);
  }

  if (response.status !== ResponseStatus.SUCCESS) {
    throw new Error(API_ERRORS.SERVER_ERROR);
  }

  // Security: Sanitize response data before returning
  const sanitizedData = sanitizeResponseData(response.data);
  
  // Log successful response metrics
  logResponseMetrics({
    requestId: response.requestId,
    status: response.status,
    timestamp: new Date().toISOString()
  });

  return sanitizedData;
}

/**
 * Comprehensive error handler with retry logic and detailed error tracking
 * @param error - The error to handle
 * @param retryConfig - Configuration for retry mechanism
 * @returns Standardized error object
 */
export function handleApiError(
  error: AxiosError | Error,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): ApiError {
  const standardError: ApiError = {
    code: 'UNKNOWN_ERROR',
    message: error.message,
    details: {},
    status: 500,
    timestamp: new Date().toISOString(),
    path: '',
    requestId: ''
  };

  if (error instanceof AxiosError) {
    const errorResponse = error.response?.data;
    
    if (isApiError(errorResponse)) {
      standardError.code = errorResponse.code;
      standardError.message = errorResponse.message;
      standardError.details = errorResponse.details;
      standardError.status = error.response?.status || 500;
      standardError.requestId = errorResponse.requestId;
      standardError.path = error.config?.url || '';
    }
  }

  // Log error with security context
  logErrorMetrics({
    errorCode: standardError.code,
    requestId: standardError.requestId,
    timestamp: standardError.timestamp,
    path: standardError.path
  });

  return standardError;
}

/**
 * Deep validation of API response structure with security checks
 * @param response - Response to validate
 * @returns boolean indicating validation result
 */
export function validateResponseStructure(response: unknown): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const requiredFields = ['data', 'status', 'requestId'];
  const hasRequiredFields = requiredFields.every(
    field => field in (response as Record<string, unknown>)
  );

  if (!hasRequiredFields) {
    return false;
  }

  // Additional security validations
  const apiResponse = response as ApiResponse<unknown>;
  
  // Verify request ID format
  const requestIdPattern = /^[a-zA-Z0-9-]+$/;
  if (!requestIdPattern.test(apiResponse.requestId)) {
    return false;
  }

  // Validate status enum
  if (!Object.values(ResponseStatus).includes(apiResponse.status)) {
    return false;
  }

  return true;
}

/**
 * Implements configurable retry logic with exponential backoff
 * @param operation - Async operation to retry
 * @param config - Retry configuration
 * @returns Promise resolving to operation result
 */
export async function retryHandler<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (!config.shouldRetry(lastError) || attempt === config.maxAttempts) {
        throw lastError;
      }

      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt - 1),
        config.maxDelay
      );

      // Log retry attempt
      logRetryMetrics({
        attempt,
        delay,
        errorCode: lastError instanceof AxiosError ? 
          lastError.response?.status?.toString() : 'UNKNOWN'
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Sanitizes response data to prevent XSS and injection attacks
 * @param data - Data to sanitize
 * @returns Sanitized data
 */
function sanitizeResponseData<T>(data: T): T {
  if (typeof data === 'string') {
    return data.replace(/<[^>]*>/g, '') as unknown as T;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponseData(item)) as unknown as T;
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeResponseData(value);
    }
    return sanitized as T;
  }

  return data;
}

/**
 * Logs response metrics for monitoring
 * @param metrics - Metrics to log
 */
function logResponseMetrics(metrics: {
  requestId: string;
  status: ResponseStatus;
  timestamp: string;
}): void {
  // Implementation would connect to monitoring system
  console.info('Response metrics:', metrics);
}

/**
 * Logs error metrics for monitoring and analysis
 * @param metrics - Error metrics to log
 */
function logErrorMetrics(metrics: {
  errorCode: string;
  requestId: string;
  timestamp: string;
  path: string;
}): void {
  // Implementation would connect to monitoring system
  console.error('Error metrics:', metrics);
}

/**
 * Logs retry metrics for monitoring
 * @param metrics - Retry metrics to log
 */
function logRetryMetrics(metrics: {
  attempt: number;
  delay: number;
  errorCode: string;
}): void {
  // Implementation would connect to monitoring system
  console.warn('Retry metrics:', metrics);
}