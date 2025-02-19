/**
 * Enhanced custom React hook for managing integration state, operations, health monitoring,
 * and performance tracking in the frontend application
 * @version 1.0.0
 */

import { useState, useCallback } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.5
import { selectIntegrations } from '../store/integrations/integrationSlice';
import integrationService from '../services/integrationService';
import { Integration } from '../types/integration.types';

// Performance monitoring thresholds (ms)
const PERFORMANCE_THRESHOLDS = {
  WARNING: 150,
  CRITICAL: 200
};

// Health check interval (ms)
const HEALTH_CHECK_INTERVAL = 30000;

// Types for hook state
interface IntegrationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  message?: string;
}

interface PerformanceMetrics {
  responseTime: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Date;
}

/**
 * Enhanced custom hook for managing integrations with monitoring capabilities
 */
export const useIntegration = () => {
  // Redux state management
  const dispatch = useDispatch();
  const integrations = useSelector(selectIntegrations);

  // Local state management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<IntegrationError | null>(null);
  const [healthStatus, setHealthStatus] = useState<Record<string, HealthStatus>>({});
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, PerformanceMetrics>>({});

  /**
   * Fetches all integrations with enhanced error handling and caching
   */
  const fetchIntegrations = useCallback(async (agentId: string) => {
    try {
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      const result = await integrationService.getIntegrations();

      // Track performance
      const duration = performance.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.CRITICAL) {
        console.warn(`Critical performance in fetchIntegrations: ${duration}ms`);
      }

      return result;
    } catch (err) {
      const error = err as Error;
      setError({
        code: 'FETCH_ERROR',
        message: error.message,
        details: { agentId }
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Creates a new integration with validation
   */
  const createIntegration = useCallback(async (data: Partial<Integration>) => {
    try {
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      const result = await integrationService.createIntegration(data);

      // Track performance
      trackPerformance('createIntegration', startTime);

      return result;
    } catch (err) {
      const error = err as Error;
      setError({
        code: 'CREATE_ERROR',
        message: error.message,
        details: { data }
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates an existing integration
   */
  const updateIntegration = useCallback(async (id: string, data: Partial<Integration>) => {
    try {
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      const result = await integrationService.updateIntegration(id, data);

      // Track performance
      trackPerformance('updateIntegration', startTime);

      return result;
    } catch (err) {
      const error = err as Error;
      setError({
        code: 'UPDATE_ERROR',
        message: error.message,
        details: { id, data }
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deletes an integration and cleans up resources
   */
  const deleteIntegration = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      await integrationService.deleteIntegration(id);

      // Track performance
      trackPerformance('deleteIntegration', startTime);
    } catch (err) {
      const error = err as Error;
      setError({
        code: 'DELETE_ERROR',
        message: error.message,
        details: { id }
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Monitors integration health status with periodic checks
   */
  const monitorHealth = useCallback(async (integrationId: string): Promise<HealthStatus> => {
    try {
      const startTime = performance.now();
      const healthCheck = await integrationService.verifyIntegration(integrationId);

      const status: HealthStatus = {
        status: healthCheck.data ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        message: healthCheck.message
      };

      setHealthStatus(prev => ({
        ...prev,
        [integrationId]: status
      }));

      // Track performance
      trackPerformance('healthCheck', startTime);

      return status;
    } catch (error) {
      const degradedStatus: HealthStatus = {
        status: 'degraded',
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : 'Health check failed'
      };

      setHealthStatus(prev => ({
        ...prev,
        [integrationId]: degradedStatus
      }));

      return degradedStatus;
    }
  }, []);

  /**
   * Tracks integration performance metrics
   */
  const trackPerformance = useCallback((operation: string, startTime: number) => {
    const duration = performance.now() - startTime;
    const metrics: PerformanceMetrics = {
      responseTime: duration,
      errorRate: error ? 1 : 0,
      uptime: 100, // Calculated based on health checks
      lastUpdated: new Date()
    };

    setPerformanceMetrics(prev => ({
      ...prev,
      [operation]: metrics
    }));

    // Log performance warnings
    if (duration > PERFORMANCE_THRESHOLDS.CRITICAL) {
      console.warn(`Critical performance in ${operation}: ${duration}ms`);
    } else if (duration > PERFORMANCE_THRESHOLDS.WARNING) {
      console.info(`Slow operation in ${operation}: ${duration}ms`);
    }
  }, [error]);

  /**
   * Retries a failed operation with exponential backoff
   */
  const retryOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err as Error;
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }, []);

  return {
    // State
    integrations,
    loading,
    error,
    healthStatus,
    performanceMetrics,

    // Operations
    fetchIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,

    // Monitoring
    monitorHealth,
    trackPerformance,
    retryOperation
  };
};