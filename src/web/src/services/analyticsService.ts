/**
 * Analytics Service
 * Handles fetching and managing analytics data including system metrics, 
 * agent performance, integration status, and real-time updates
 * @version 1.0.0
 */

import { LRUCache } from 'lru-cache'; // ^10.0.1
import dayjs from 'dayjs'; // ^1.11.9
import retry from 'retry'; // ^0.13.1
import WebSocket from 'ws'; // ^8.13.0

import { httpClient } from './httpClient';
import { METRICS_ENDPOINTS } from '../constants/apiEndpoints';
import { 
  MetricType,
  SystemHealthMetrics,
  AgentMetrics,
  MetricsWebSocketEvent,
  isMetricType,
  isUnixTimestamp,
  METRICS_CONSTANTS
} from '../types/metrics.types';
import { LoadingState } from '../types/common.types';
import { ApiResponse, ApiError } from '../types/api.types';

// Cache configuration type
interface CacheOptions {
  maxSize: number;
  ttl: number;
}

// Default cache settings
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  maxSize: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
};

class AnalyticsService {
  private readonly baseUrl: string;
  private readonly metricsCache: LRUCache<string, any>;
  private wsConnection: WebSocket | null = null;
  private readonly retryOptions = {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 5000
  };

  constructor(cacheOptions: CacheOptions = DEFAULT_CACHE_OPTIONS) {
    this.baseUrl = METRICS_ENDPOINTS.BASE;
    this.metricsCache = new LRUCache({
      max: cacheOptions.maxSize,
      ttl: cacheOptions.ttl
    });
    this.setupWebSocket();
  }

  /**
   * Fetches current system health metrics with caching
   */
  public async getSystemHealth(): Promise<ApiResponse<SystemHealthMetrics>> {
    const cacheKey = 'system_health';
    const cachedData = this.metricsCache.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const operation = retry.operation(this.retryOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const response = await httpClient.get<SystemHealthMetrics>(
            METRICS_ENDPOINTS.SYSTEM_HEALTH
          );

          if (this.validateSystemHealthMetrics(response.data)) {
            this.metricsCache.set(cacheKey, response);
            resolve(response);
          } else {
            throw new Error('Invalid system health metrics data');
          }
        } catch (error) {
          if (operation.retry(error as Error)) {
            return;
          }
          reject(operation.mainError());
        }
      });
    });
  }

  /**
   * Fetches performance metrics for a specific agent
   */
  public async getAgentMetrics(agentId: string): Promise<ApiResponse<AgentMetrics>> {
    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    const cacheKey = `agent_metrics_${agentId}`;
    const cachedData = this.metricsCache.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const operation = retry.operation(this.retryOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const response = await httpClient.get<AgentMetrics>(
            `${METRICS_ENDPOINTS.PERFORMANCE}/${agentId}`
          );

          if (this.validateAgentMetrics(response.data)) {
            this.metricsCache.set(cacheKey, response);
            resolve(response);
          } else {
            throw new Error('Invalid agent metrics data');
          }
        } catch (error) {
          if (operation.retry(error as Error)) {
            return;
          }
          reject(operation.mainError());
        }
      });
    });
  }

  /**
   * Establishes real-time subscription for metric updates
   */
  public async subscribeToMetrics(
    metricType: MetricType,
    callback: (data: MetricsWebSocketEvent) => void
  ): Promise<void> {
    if (!isMetricType(metricType)) {
      throw new Error('Invalid metric type');
    }

    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      await this.setupWebSocket();
    }

    this.wsConnection?.send(JSON.stringify({
      action: 'subscribe',
      metricType
    }));

    this.wsConnection?.on('message', (data: WebSocket.Data) => {
      try {
        const event: MetricsWebSocketEvent = JSON.parse(data.toString());
        if (event.type === metricType && isUnixTimestamp(event.timestamp)) {
          callback(event);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
  }

  /**
   * Fetches current status of system integrations
   */
  public async getIntegrationStatus(integrationId: string): Promise<ApiResponse<any>> {
    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    const cacheKey = `integration_status_${integrationId}`;
    const cachedData = this.metricsCache.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const operation = retry.operation(this.retryOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const response = await httpClient.get(
            `${METRICS_ENDPOINTS.BASE}/integrations/${integrationId}/status`
          );
          this.metricsCache.set(cacheKey, response);
          resolve(response);
        } catch (error) {
          if (operation.retry(error as Error)) {
            return;
          }
          reject(operation.mainError());
        }
      });
    });
  }

  /**
   * Validates system health metrics data
   */
  private validateSystemHealthMetrics(metrics: SystemHealthMetrics): boolean {
    return (
      metrics &&
      typeof metrics.cpuUsage === 'number' &&
      typeof metrics.memoryUsage === 'number' &&
      typeof metrics.uptime === 'number' &&
      typeof metrics.activeAgents === 'number' &&
      metrics.cpuUsage >= 0 &&
      metrics.cpuUsage <= 100 &&
      metrics.memoryUsage >= 0 &&
      metrics.memoryUsage <= 100 &&
      metrics.uptime >= 0 &&
      metrics.activeAgents >= 0
    );
  }

  /**
   * Validates agent metrics data
   */
  private validateAgentMetrics(metrics: AgentMetrics): boolean {
    return (
      metrics &&
      typeof metrics.successRate === 'number' &&
      typeof metrics.responseTime === 'number' &&
      typeof metrics.requestCount === 'number' &&
      typeof metrics.errorCount === 'number' &&
      typeof metrics.deploymentTime === 'number' &&
      metrics.successRate >= 0 &&
      metrics.successRate <= 100 &&
      metrics.responseTime >= 0 &&
      metrics.requestCount >= 0 &&
      metrics.errorCount >= 0 &&
      metrics.deploymentTime >= 0
    );
  }

  /**
   * Sets up WebSocket connection for real-time metrics
   */
  private async setupWebSocket(): Promise<void> {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.wsConnection = new WebSocket(
        `${process.env.VITE_WS_URL}/metrics`
      );

      this.wsConnection.on('open', () => {
        console.log('WebSocket connection established');
        resolve();
      });

      this.wsConnection.on('error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.wsConnection.on('close', () => {
        console.log('WebSocket connection closed');
        setTimeout(() => this.setupWebSocket(), 5000); // Reconnect after 5 seconds
      });
    });
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();