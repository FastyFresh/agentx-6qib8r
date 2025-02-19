/**
 * Metrics Service
 * Handles fetching and managing system metrics, performance data, and analytics
 * with enhanced type safety and real-time capabilities
 * @version 1.0.0
 */

import { httpClient } from './httpClient';
import { METRICS_ENDPOINTS } from '../constants/apiEndpoints';
import { 
  MetricType,
  MetricsFilter,
  SystemHealthMetrics,
  AgentMetrics,
  TimeSeriesMetrics,
  isUnixTimestamp,
  isFiniteNumber,
  isPercentage,
  isNonNegativeInteger,
  METRICS_CONSTANTS
} from '../types/metrics.types';
import { ApiResponse, ApiError } from '../types/api.types';

/**
 * Validates metric values against expected ranges and types
 * @param metrics - Raw metrics data to validate
 * @throws {Error} If metrics fail validation
 */
const validateMetrics = <T extends Record<string, number>>(metrics: T): void => {
  Object.entries(metrics).forEach(([key, value]) => {
    if (!isFiniteNumber(value)) {
      throw new Error(`Invalid metric value for ${key}: must be a finite number`);
    }

    if (key.includes('Usage') && !isPercentage(value)) {
      throw new Error(`Invalid usage value for ${key}: must be between 0-100`);
    }

    if (key.includes('Count') && !isNonNegativeInteger(value)) {
      throw new Error(`Invalid count for ${key}: must be a non-negative integer`);
    }
  });
};

/**
 * Service for managing system metrics and performance data
 */
const metricsService = {
  /**
   * Fetches current system health metrics
   * @returns Promise with validated system health metrics
   * @throws {ApiError} On API or validation failure
   */
  async getSystemHealth(): Promise<ApiResponse<SystemHealthMetrics>> {
    try {
      const response = await httpClient.get<SystemHealthMetrics>(
        METRICS_ENDPOINTS.SYSTEM_HEALTH
      );

      validateMetrics(response.data);

      // Apply warning thresholds
      if (response.data.cpuUsage > METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.CPU_WARNING) {
        console.warn(`High CPU usage detected: ${response.data.cpuUsage}%`);
      }

      if (response.data.memoryUsage > METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.MEMORY_WARNING) {
        console.warn(`High memory usage detected: ${response.data.memoryUsage}%`);
      }

      return response;
    } catch (error) {
      console.error('Failed to fetch system health metrics:', error);
      throw error;
    }
  },

  /**
   * Retrieves time series metrics data with filtering
   * @param filter - Metrics filter parameters
   * @returns Promise with validated time series data
   * @throws {ApiError} On API or validation failure
   */
  async getMetricsSeries(filter: MetricsFilter): Promise<ApiResponse<TimeSeriesMetrics>> {
    if (!isUnixTimestamp(filter.startTime) || !isUnixTimestamp(filter.endTime)) {
      throw new Error('Invalid timestamp in filter');
    }

    if (filter.endTime - filter.startTime > METRICS_CONSTANTS.MAX_RETENTION_DAYS * 86400000) {
      throw new Error(`Time range exceeds maximum retention of ${METRICS_CONSTANTS.MAX_RETENTION_DAYS} days`);
    }

    try {
      const response = await httpClient.get<TimeSeriesMetrics>(
        METRICS_ENDPOINTS.TIME_SERIES,
        { params: filter }
      );

      // Validate each data point in the time series
      response.data.dataPoints.forEach(point => {
        if (!isUnixTimestamp(point.timestamp) || !isFiniteNumber(point.value)) {
          throw new Error('Invalid data point in time series');
        }
      });

      return response;
    } catch (error) {
      console.error('Failed to fetch metrics time series:', error);
      throw error;
    }
  },

  /**
   * Fetches performance metrics for a specific agent
   * @param agentId - Unique identifier of the agent
   * @param filter - Metrics filter parameters
   * @returns Promise with validated agent metrics
   * @throws {ApiError} On API or validation failure
   */
  async getAgentMetrics(
    agentId: string,
    filter: MetricsFilter
  ): Promise<ApiResponse<AgentMetrics>> {
    if (!agentId.trim()) {
      throw new Error('Agent ID is required');
    }

    try {
      const response = await httpClient.get<AgentMetrics>(
        `${METRICS_ENDPOINTS.AGENT_METRICS}/${agentId}`,
        { params: filter }
      );

      validateMetrics(response.data);

      // Check performance thresholds
      if (response.data.successRate < METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.SUCCESS_RATE_WARNING) {
        console.warn(`Low success rate for agent ${agentId}: ${response.data.successRate}%`);
      }

      if (response.data.responseTime > METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_WARNING) {
        console.warn(`High response time for agent ${agentId}: ${response.data.responseTime}ms`);
      }

      return response;
    } catch (error) {
      console.error(`Failed to fetch metrics for agent ${agentId}:`, error);
      throw error;
    }
  },

  /**
   * Retrieves system-wide performance metrics
   * @param filter - Metrics filter parameters
   * @returns Promise with validated performance metrics
   * @throws {ApiError} On API or validation failure
   */
  async getPerformanceMetrics(
    filter: MetricsFilter
  ): Promise<ApiResponse<SystemPerformanceMetrics>> {
    try {
      const response = await httpClient.get<SystemPerformanceMetrics>(
        METRICS_ENDPOINTS.PERFORMANCE,
        { params: filter }
      );

      validateMetrics(response.data);

      // Calculate and validate derived metrics
      const derivedMetrics = {
        errorRate: (response.data.errorCount / response.data.totalRequests) * 100,
        averageResponseTime: response.data.totalResponseTime / response.data.totalRequests
      };

      if (!isPercentage(derivedMetrics.errorRate)) {
        throw new Error('Invalid error rate calculation');
      }

      if (!isFiniteNumber(derivedMetrics.averageResponseTime)) {
        throw new Error('Invalid average response time calculation');
      }

      return {
        ...response,
        data: {
          ...response.data,
          ...derivedMetrics
        }
      };
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      throw error;
    }
  }
};

// Freeze service to prevent modifications
Object.freeze(metricsService);

export { metricsService };