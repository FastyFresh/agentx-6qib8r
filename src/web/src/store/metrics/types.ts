/**
 * TypeScript type definitions for Redux store metrics state management
 * Provides comprehensive type safety for metrics data, loading states, and action payloads
 * @version 1.0.0
 */

import { 
  MetricType, 
  MetricSeries, 
  SystemHealthMetrics, 
  AgentMetrics, 
  MetricsFilter 
} from '../../types/metrics.types';
import { LoadingState } from '../../types/common.types';

/**
 * Interface defining the shape of metrics state in Redux store
 * Manages system health, agent metrics, and loading states
 */
export interface MetricsState {
  // Current system health metrics
  systemHealth: SystemHealthMetrics | null;
  // Map of agent IDs to their respective metrics
  agentMetrics: Record<string, AgentMetrics>;
  // Array of time-series metric data
  metricsSeries: MetricSeries[];
  // Current loading state of metrics data
  loadingState: LoadingState;
  // Error message if metrics fetch fails
  error: string | null;
}

/**
 * Interface for metrics fetch action payload
 * Supports filtering and time range selection
 */
export interface FetchMetricsPayload {
  // Metrics filtering criteria
  filter: MetricsFilter;
  // Time range for metrics query
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Interface for metrics update action payload
 * Handles real-time metric updates via WebSocket
 */
export interface UpdateMetricsPayload {
  // Array of updated metric series data
  metrics: MetricSeries[];
}

/**
 * Interface for system health update action payload
 * Manages real-time system health monitoring
 */
export interface UpdateSystemHealthPayload {
  // Updated system health metrics
  systemHealth: SystemHealthMetrics;
}

/**
 * Interface for agent metrics update action payload
 * Handles individual agent performance updates
 */
export interface UpdateAgentMetricsPayload {
  // ID of the agent being updated
  agentId: string;
  // Updated metrics for the specified agent
  metrics: AgentMetrics;
  // Timestamp of the metrics update
  timestamp: Date;
}

/**
 * Type guard to validate metrics state shape
 * @param state - State object to validate
 */
export function isMetricsState(state: unknown): state is MetricsState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'systemHealth' in state &&
    'agentMetrics' in state &&
    'metricsSeries' in state &&
    'loadingState' in state &&
    'error' in state
  );
}

/**
 * Type guard to validate metrics payload
 * @param payload - Payload object to validate
 */
export function isMetricsPayload(payload: unknown): payload is UpdateMetricsPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'metrics' in payload &&
    Array.isArray((payload as UpdateMetricsPayload).metrics)
  );
}