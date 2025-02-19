/**
 * Core HTTP client service for making type-safe API requests
 * Provides centralized request handling with built-in error handling,
 * retries, authentication, and performance monitoring
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'; // ^1.4.0
import axiosRetry from 'axios-retry'; // ^3.5.0
import { apiConfig, generateRequestId } from '../config/api.config';
import { 
  ApiResponse, 
  ApiError, 
  ResponseStatus,
  isApiError 
} from '../types/api.types';

class HttpClient {
  private instance: AxiosInstance;
  private accessToken: string = '';
  private requestTimings: Map<string, number> = new Map();

  constructor() {
    // Initialize axios instance with base configuration
    this.instance = axios.create({
      baseURL: apiConfig.baseURL,
      timeout: apiConfig.timeout,
      headers: { ...apiConfig.defaultHeaders },
      withCredentials: apiConfig.withCredentials,
      validateStatus: apiConfig.validateStatus,
    });

    // Configure automatic retry with exponential backoff
    axiosRetry(this.instance, {
      retries: apiConfig.retryAttempts,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        const status = error.response?.status;
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               status === 429 || 
               status! >= 500;
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.warn(
          `Retrying request (${retryCount}/${apiConfig.retryAttempts}):`,
          requestConfig.url,
          error.message
        );
      }
    });

    // Request interceptor for auth and tracking
    this.instance.interceptors.request.use(
      (config) => {
        const requestId = generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        
        if (this.accessToken) {
          config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        // Start performance tracking
        this.requestTimings.set(requestId, performance.now());
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and performance tracking
    this.instance.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers['X-Request-ID'];
        const startTime = this.requestTimings.get(requestId);
        
        if (startTime) {
          const duration = performance.now() - startTime;
          this.requestTimings.delete(requestId);
          
          // Log if response time exceeds threshold
          if (duration > 200) {
            console.warn(`Slow API call to ${response.config.url}: ${duration}ms`);
          }
        }

        return response;
      },
      (error: AxiosError) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        this.requestTimings.delete(requestId as string);

        if (error.response?.status === 401) {
          // Handle token expiration
          this.handleAuthError();
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * Updates the authentication token used for requests
   * @param token - JWT token for API authentication
   */
  public setAuthToken(token: string): void {
    if (!token || token.split('.').length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    this.accessToken = token;
    this.instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Makes a type-safe GET request
   * @param url - API endpoint URL
   * @param params - Query parameters
   * @returns Promise with typed response
   */
  public async get<T>(
    url: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.get<ApiResponse<T>>(url, { params });
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Makes a type-safe POST request
   * @param url - API endpoint URL
   * @param data - Request payload
   * @param params - Query parameters
   * @returns Promise with typed response
   */
  public async post<T>(
    url: string,
    data: unknown,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.post<ApiResponse<T>>(url, data, { params });
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Makes a type-safe PUT request
   * @param url - API endpoint URL
   * @param data - Request payload
   * @param params - Query parameters
   * @returns Promise with typed response
   */
  public async put<T>(
    url: string,
    data: unknown,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.put<ApiResponse<T>>(url, data, { params });
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Makes a type-safe DELETE request
   * @param url - API endpoint URL
   * @param params - Query parameters
   * @returns Promise with typed response
   */
  public async delete<T>(
    url: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.delete<ApiResponse<T>>(url, { params });
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Handles successful API responses
   * @param response - Axios response object
   * @returns Normalized API response
   */
  private handleResponse<T>(
    response: AxiosResponse<ApiResponse<T>>
  ): ApiResponse<T> {
    return {
      data: response.data.data,
      status: ResponseStatus.SUCCESS,
      message: response.data.message || 'Success',
      timestamp: new Date().toISOString(),
      requestId: response.config.headers['X-Request-ID'] as string
    };
  }

  /**
   * Normalizes API errors into a consistent format
   * @param error - Error object from axios
   * @returns Normalized API error
   */
  private normalizeError(error: unknown): ApiError {
    if (error instanceof AxiosError) {
      const response = error.response?.data;
      
      if (isApiError(response)) {
        return response;
      }

      return {
        code: `HTTP_${error.response?.status || 500}`,
        message: error.message,
        details: {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase()
        },
        status: error.response?.status || 500,
        timestamp: new Date().toISOString(),
        path: error.config?.url || '',
        requestId: error.config?.headers?.['X-Request-ID'] as string
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: {},
      status: 500,
      timestamp: new Date().toISOString(),
      path: '',
      requestId: ''
    };
  }

  /**
   * Handles authentication errors and token refresh
   */
  private handleAuthError(): void {
    // Clear invalid token
    this.accessToken = '';
    this.instance.defaults.headers.common['Authorization'] = '';
    
    // Emit auth error event for app-level handling
    window.dispatchEvent(new CustomEvent('auth:error', {
      detail: { message: 'Authentication token expired' }
    }));
  }
}

// Export singleton instance
export const httpClient = new HttpClient();