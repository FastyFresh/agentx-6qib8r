import { 
  handleApiResponse, 
  handleApiError, 
  isSuccessStatus, 
  formatErrorMessage, 
  validateResponseStructure, 
  retryHandler 
} from '../../src/utils/apiUtils';
import { 
  ApiResponse, 
  ApiError, 
  ResponseStatus 
} from '../../src/types/api.types';
import { API_ERRORS } from '../../src/constants/errorMessages';

// jest.mock for monitoring functions
jest.mock('../../src/utils/apiUtils', () => {
  const originalModule = jest.requireActual('../../src/utils/apiUtils');
  return {
    ...originalModule,
    logResponseMetrics: jest.fn(),
    logErrorMetrics: jest.fn(),
    logRetryMetrics: jest.fn(),
  };
});

describe('handleApiResponse', () => {
  const mockValidResponse: ApiResponse<{ data: string }> = {
    data: { data: 'test' },
    status: ResponseStatus.SUCCESS,
    message: 'Success',
    timestamp: new Date().toISOString(),
    requestId: 'test-123'
  };

  it('should successfully handle valid response', () => {
    const result = handleApiResponse(mockValidResponse);
    expect(result).toEqual({ data: 'test' });
  });

  it('should validate response structure', () => {
    const invalidResponse = { ...mockValidResponse, requestId: undefined };
    expect(() => handleApiResponse(invalidResponse)).toThrow(API_ERRORS.INVALID_INPUT);
  });

  it('should validate security headers', () => {
    const responseWithInvalidId = {
      ...mockValidResponse,
      requestId: 'invalid@id!'
    };
    expect(() => handleApiResponse(responseWithInvalidId)).toThrow();
  });

  it('should handle empty response data', () => {
    const emptyResponse = {
      ...mockValidResponse,
      data: null
    };
    expect(() => handleApiResponse(emptyResponse)).not.toThrow();
  });

  it('should handle rate limited response', () => {
    const rateLimitedResponse = {
      ...mockValidResponse,
      status: ResponseStatus.RATE_LIMITED
    };
    expect(() => handleApiResponse(rateLimitedResponse)).toThrow();
  });
});

describe('handleApiError', () => {
  const mockApiError: ApiError = {
    code: 'TEST_ERROR',
    message: 'Test error',
    details: {},
    status: 400,
    timestamp: new Date().toISOString(),
    path: '/test',
    requestId: 'error-123'
  };

  it('should handle network errors', () => {
    const networkError = new Error('Network Error');
    const result = handleApiError(networkError);
    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.status).toBe(500);
  });

  it('should handle rate limit errors', () => {
    const rateLimitError = {
      ...mockApiError,
      code: 'RATE_LIMITED',
      status: 429
    };
    const result = handleApiError(new Error('Rate Limited'));
    expect(result.code).toBe('UNKNOWN_ERROR');
  });

  it('should preserve error correlation ID', () => {
    const correlatedError = {
      ...mockApiError,
      requestId: 'correlated-123'
    };
    const result = handleApiError(new Error('Correlated Error'));
    expect(result.requestId).toBeDefined();
  });

  it('should handle security related errors', () => {
    const securityError = {
      ...mockApiError,
      code: 'UNAUTHORIZED',
      status: 401
    };
    const result = handleApiError(new Error('Security Error'));
    expect(result.status).toBe(500);
  });
});

describe('validateResponseStructure', () => {
  const validResponse: ApiResponse<unknown> = {
    data: {},
    status: ResponseStatus.SUCCESS,
    message: 'Success',
    timestamp: new Date().toISOString(),
    requestId: 'valid-123'
  };

  it('should validate required fields', () => {
    expect(validateResponseStructure(validResponse)).toBe(true);
  });

  it('should reject invalid request IDs', () => {
    const invalidResponse = {
      ...validResponse,
      requestId: 'invalid@id!'
    };
    expect(validateResponseStructure(invalidResponse)).toBe(false);
  });

  it('should validate response status enum', () => {
    const invalidStatus = {
      ...validResponse,
      status: 'INVALID_STATUS'
    };
    expect(validateResponseStructure(invalidStatus)).toBe(false);
  });

  it('should validate nested object structure', () => {
    const nestedResponse = {
      ...validResponse,
      data: {
        nested: {
          field: 'value'
        }
      }
    };
    expect(validateResponseStructure(nestedResponse)).toBe(true);
  });
});

describe('retryHandler', () => {
  const mockOperation = jest.fn();
  const mockConfig = {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    shouldRetry: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOperation.mockReset();
    mockConfig.shouldRetry.mockReset();
  });

  it('should retry failed operations', async () => {
    mockOperation
      .mockRejectedValueOnce(new Error('Retry Error'))
      .mockResolvedValueOnce('success');
    mockConfig.shouldRetry.mockReturnValue(true);

    const result = await retryHandler(mockOperation, mockConfig);
    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(2);
  });

  it('should respect maximum retry attempts', async () => {
    mockOperation.mockRejectedValue(new Error('Persistent Error'));
    mockConfig.shouldRetry.mockReturnValue(true);

    await expect(retryHandler(mockOperation, mockConfig))
      .rejects
      .toThrow('Persistent Error');
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should implement exponential backoff', async () => {
    mockOperation.mockRejectedValue(new Error('Backoff Error'));
    mockConfig.shouldRetry.mockReturnValue(true);

    const startTime = Date.now();
    await expect(retryHandler(mockOperation, mockConfig)).rejects.toThrow();
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(300); // Sum of delays
  });

  it('should abort retry on non-retryable errors', async () => {
    mockOperation.mockRejectedValue(new Error('Non-retryable'));
    mockConfig.shouldRetry.mockReturnValue(false);

    await expect(retryHandler(mockOperation, mockConfig))
      .rejects
      .toThrow('Non-retryable');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });
});