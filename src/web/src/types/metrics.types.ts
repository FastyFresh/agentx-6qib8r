/**
 * TypeScript type definitions for system metrics, performance monitoring, and analytics data
 * Provides comprehensive type safety and validation for metrics throughout the frontend application
 * @version 1.0.0
 */

import { LoadingState } from './common.types';

/**
 * Enum defining different types of metrics with string literal types for type safety
 */
export enum MetricType {
  SYSTEM_HEALTH = 'system_health',
  AGENT_PERFORMANCE = 'agent_performance',
  API_RESPONSE_TIME = 'api_response_time',
  INTEGRATION_STATUS = 'integration_status'
}

/**
 * Branded type for Unix timestamps to ensure type safety
 */
type UnixTimestamp = number & { readonly __brand: 'UnixTimestamp' };

/**
 * Branded type for finite numbers to prevent NaN/Infinity
 */
type FiniteNumber = number & { readonly __finite: true };

/**
 * Interface for individual metric data points with branded types for validation
 */
export interface MetricValue {
  timestamp: UnixTimestamp;
  value: FiniteNumber;
}

/**
 * Interface for system health monitoring metrics with range validation
 */
export interface SystemHealthMetrics {
  cpuUsage: number & { readonly __range: '0-100' };
  memoryUsage: number & { readonly __range: '0-100' };
  uptime: number & { readonly __unit: 'milliseconds' };
  activeAgents: number & { readonly __type: 'nonNegativeInteger' };
}

/**
 * Interface for individual agent performance metrics with deployment time tracking
 */
export interface AgentMetrics {
  successRate: number & { readonly __range: '0-100' };
  responseTime: number & { readonly __unit: 'milliseconds' };
  requestCount: number & { readonly __type: 'nonNegativeInteger' };
  errorCount: number & { readonly __type: 'nonNegativeInteger' };
  deploymentTime: number & { readonly __unit: 'milliseconds' };
}

/**
 * Type definition for real-time metric WebSocket events
 */
export type MetricsWebSocketEvent = {
  type: MetricType;
  data: MetricValue;
  timestamp: UnixTimestamp;
};

/**
 * Interface for filtering metrics data queries with branded types
 */
export interface MetricsFilter {
  metricType: MetricType;
  startTime: UnixTimestamp;
  endTime: UnixTimestamp;
  interval: string & { readonly __unit: 'timeInterval' };
}

/**
 * Type guard to validate Unix timestamps
 */
export function isUnixTimestamp(value: number): value is UnixTimestamp {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Type guard to validate finite numbers
 */
export function isFiniteNumber(value: number): value is FiniteNumber {
  return Number.isFinite(value);
}

/**
 * Type guard to validate percentage ranges (0-100)
 */
export function isPercentage(value: number): value is number & { __range: '0-100' } {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Type guard to validate non-negative integers
 */
export function isNonNegativeInteger(value: number): value is number & { __type: 'nonNegativeInteger' } {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Type guard to validate metric types
 */
export function isMetricType(value: unknown): value is MetricType {
  return Object.values(MetricType).includes(value as MetricType);
}

// Freeze enum to prevent modification
Object.freeze(MetricType);

/**
 * Interface for metrics state management
 */
export interface MetricsState {
  systemHealth: SystemHealthMetrics | null;
  agentMetrics: Record<string, AgentMetrics>;
  loadingState: LoadingState;
  error: Error | null;
  lastUpdated: UnixTimestamp | null;
}

/**
 * Constants for metrics thresholds and limits
 */
export const METRICS_CONSTANTS = {
  MAX_RETENTION_DAYS: 90,
  DEFAULT_INTERVAL: '5m',
  PERFORMANCE_THRESHOLDS: {
    CPU_WARNING: 80,
    MEMORY_WARNING: 80,
    RESPONSE_TIME_WARNING: 200, // milliseconds
    SUCCESS_RATE_WARNING: 95 // percentage
  }
} as const;