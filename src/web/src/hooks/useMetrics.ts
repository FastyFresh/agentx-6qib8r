/**
 * Enhanced custom React hook for managing system metrics, performance monitoring,
 * and real-time analytics data with comprehensive error handling and optimizations
 * @version 1.0.0
 */

import { useEffect, useCallback, useState, useRef } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { debounce } from 'lodash'; // ^4.17.21
import { metricsService } from '../services/metricsService';
import { 
  fetchMetrics, 
  fetchSystemHealth, 
  fetchAgentMetrics 
} from '../store/metrics/metricsSlice';
import { 
  MetricType, 
  MetricsFilter, 
  SystemHealthMetrics, 
  AgentMetrics, 
  MetricsResponse, 
  MetricsError 
} from '../types/metrics.types';

// Interface for refresh options configuration
interface RefreshOptions {
  interval?: number;
  debounceMs?: number;
  retryAttempts?: number;
}

// Default refresh configuration
const DEFAULT_REFRESH_OPTIONS: Required<RefreshOptions> = {
  interval: 30000, // 30 seconds
  debounceMs: 500,
  retryAttempts: 3
};

/**
 * Enhanced metrics management hook with real-time updates and error handling
 * @param filter - Metrics filtering criteria
 * @param options - Refresh and update configuration
 */
export const useMetrics = (
  filter: MetricsFilter,
  options: RefreshOptions = {}
) => {
  const dispatch = useDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);

  // Merge provided options with defaults
  const refreshOptions = {
    ...DEFAULT_REFRESH_OPTIONS,
    ...options
  };

  // Granular loading states for different metric types
  const [loading, setLoading] = useState({
    metrics: false,
    systemHealth: false,
    agentMetrics: false
  });

  // WebSocket connection status
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [error, setError] = useState<MetricsError | null>(null);

  // Memoized selectors for Redux state
  const metrics = useSelector((state: any) => state.metrics.metricsSeries);
  const systemHealth = useSelector((state: any) => state.metrics.systemHealth);
  const agentMetrics = useSelector((state: any) => state.metrics.agentMetrics);

  /**
   * Debounced refresh function for metrics data
   */
  const debouncedRefresh = useCallback(
    debounce(async () => {
      try {
        setLoading(prev => ({ ...prev, metrics: true }));
        await dispatch(fetchMetrics({ filter }));
      } catch (err) {
        setError({
          code: 'REFRESH_ERROR',
          message: err instanceof Error ? err.message : 'Failed to refresh metrics',
          timestamp: new Date().toISOString()
        });
      } finally {
        setLoading(prev => ({ ...prev, metrics: false }));
      }
    }, refreshOptions.debounceMs),
    [dispatch, filter, refreshOptions.debounceMs]
  );

  /**
   * Initialize WebSocket connection with automatic reconnection
   */
  const initializeWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(process.env.VITE_WS_METRICS_URL || '');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWebSocketConnected(true);
      retryCountRef.current = 0;
      ws.send(JSON.stringify({ type: 'subscribe', filter }));
    };

    ws.onclose = () => {
      setIsWebSocketConnected(false);
      if (retryCountRef.current < refreshOptions.retryAttempts) {
        retryCountRef.current++;
        setTimeout(initializeWebSocket, 1000 * retryCountRef.current);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError({
        code: 'WEBSOCKET_ERROR',
        message: 'WebSocket connection error',
        timestamp: new Date().toISOString()
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (metricsService.validateMetricsData(data)) {
          switch (data.type) {
            case MetricType.SYSTEM_HEALTH:
              dispatch(fetchSystemHealth());
              break;
            case MetricType.AGENT_PERFORMANCE:
              if (data.agentId) {
                dispatch(fetchAgentMetrics(data.agentId));
              }
              break;
            default:
              debouncedRefresh();
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    };
  }, [dispatch, filter, refreshOptions.retryAttempts]);

  /**
   * Manual refresh function for metrics data
   */
  const refreshMetrics = async () => {
    try {
      setLoading({
        metrics: true,
        systemHealth: true,
        agentMetrics: true
      });

      await Promise.all([
        dispatch(fetchMetrics({ filter })),
        dispatch(fetchSystemHealth()),
        Object.keys(agentMetrics).map(agentId => 
          dispatch(fetchAgentMetrics(agentId))
        )
      ]);
    } catch (err) {
      setError({
        code: 'REFRESH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to refresh metrics',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading({
        metrics: false,
        systemHealth: false,
        agentMetrics: false
      });
    }
  };

  // Initialize WebSocket connection and periodic refresh
  useEffect(() => {
    initializeWebSocket();
    refreshMetrics();

    const refreshInterval = setInterval(refreshMetrics, refreshOptions.interval);

    return () => {
      clearInterval(refreshInterval);
      debouncedRefresh.cancel();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [initializeWebSocket, refreshOptions.interval]);

  return {
    metrics,
    systemHealth,
    agentMetrics,
    loading,
    error,
    refreshMetrics,
    isWebSocketConnected
  };
};