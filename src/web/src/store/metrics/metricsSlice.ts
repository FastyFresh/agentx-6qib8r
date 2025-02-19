/**
 * Redux slice for managing system metrics and performance data
 * Provides optimized state updates and enhanced error handling
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.0
import { 
  MetricsState, 
  FetchMetricsPayload, 
  UpdateMetricsPayload, 
  UpdateSystemHealthPayload, 
  UpdateAgentMetricsPayload, 
  MetricsError 
} from './types';
import { metricsService } from '../../services/metricsService';
import { LoadingState } from '../../types/common.types';

// Initial state with type safety
const initialState: MetricsState = {
  systemHealth: null,
  agentMetrics: {},
  metricsSeries: [],
  loadingState: LoadingState.IDLE,
  error: null
};

// Request cancellation map for concurrent requests
const pendingRequests = new Map<string, AbortController>();

/**
 * Async thunk for fetching metrics data with retry logic
 */
export const fetchMetrics = createAsyncThunk<void, FetchMetricsPayload>(
  'metrics/fetchMetrics',
  async (payload, { dispatch, rejectWithValue }) => {
    const requestKey = `metrics-${JSON.stringify(payload.filter)}`;
    
    // Cancel any existing request for the same criteria
    if (pendingRequests.has(requestKey)) {
      pendingRequests.get(requestKey)?.abort();
    }

    const abortController = new AbortController();
    pendingRequests.set(requestKey, abortController);

    try {
      const response = await metricsService.getMetricsSeries(payload.filter);
      dispatch(metricsActions.setMetrics(response.data));
      return response.data;
    } catch (error) {
      return rejectWithValue({
        code: 'FETCH_METRICS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch metrics',
        timestamp: new Date().toISOString()
      } as MetricsError);
    } finally {
      pendingRequests.delete(requestKey);
    }
  }
);

/**
 * Async thunk for fetching system health with debouncing
 */
export const fetchSystemHealth = createAsyncThunk(
  'metrics/fetchSystemHealth',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const response = await metricsService.getSystemHealth();
      dispatch(metricsActions.setSystemHealth(response.data));
      return response.data;
    } catch (error) {
      return rejectWithValue({
        code: 'FETCH_HEALTH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch system health',
        timestamp: new Date().toISOString()
      } as MetricsError);
    }
  }
);

/**
 * Async thunk for fetching agent-specific metrics
 */
export const fetchAgentMetrics = createAsyncThunk(
  'metrics/fetchAgentMetrics',
  async (agentId: string, { dispatch, rejectWithValue }) => {
    const requestKey = `agent-metrics-${agentId}`;
    
    if (pendingRequests.has(requestKey)) {
      pendingRequests.get(requestKey)?.abort();
    }

    const abortController = new AbortController();
    pendingRequests.set(requestKey, abortController);

    try {
      const response = await metricsService.getAgentMetrics(agentId, {
        startTime: Date.now() - 3600000, // Last hour
        endTime: Date.now()
      });
      dispatch(metricsActions.setAgentMetrics({ agentId, metrics: response.data }));
      return response.data;
    } catch (error) {
      return rejectWithValue({
        code: 'FETCH_AGENT_METRICS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch agent metrics',
        timestamp: new Date().toISOString()
      } as MetricsError);
    } finally {
      pendingRequests.delete(requestKey);
    }
  }
);

/**
 * Metrics slice with optimized reducers
 */
const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    setMetrics: (state, action) => {
      state.metricsSeries = action.payload;
      state.error = null;
    },
    setSystemHealth: (state, action) => {
      state.systemHealth = action.payload;
      state.error = null;
    },
    setAgentMetrics: (state, action) => {
      const { agentId, metrics } = action.payload;
      state.agentMetrics[agentId] = metrics;
      state.error = null;
    },
    setLoading: (state, action) => {
      state.loadingState = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loadingState = LoadingState.ERROR;
    },
    clearMetrics: (state) => {
      state.metricsSeries = [];
      state.systemHealth = null;
      state.agentMetrics = {};
      state.error = null;
      state.loadingState = LoadingState.IDLE;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Metrics
      .addCase(fetchMetrics.pending, (state) => {
        state.loadingState = LoadingState.LOADING;
        state.error = null;
      })
      .addCase(fetchMetrics.fulfilled, (state) => {
        state.loadingState = LoadingState.IDLE;
      })
      .addCase(fetchMetrics.rejected, (state, action) => {
        state.loadingState = LoadingState.ERROR;
        state.error = action.payload as MetricsError;
      })
      // Fetch System Health
      .addCase(fetchSystemHealth.pending, (state) => {
        state.loadingState = LoadingState.LOADING;
      })
      .addCase(fetchSystemHealth.fulfilled, (state) => {
        state.loadingState = LoadingState.IDLE;
      })
      .addCase(fetchSystemHealth.rejected, (state, action) => {
        state.loadingState = LoadingState.ERROR;
        state.error = action.payload as MetricsError;
      })
      // Fetch Agent Metrics
      .addCase(fetchAgentMetrics.pending, (state) => {
        state.loadingState = LoadingState.LOADING;
      })
      .addCase(fetchAgentMetrics.fulfilled, (state) => {
        state.loadingState = LoadingState.IDLE;
      })
      .addCase(fetchAgentMetrics.rejected, (state, action) => {
        state.loadingState = LoadingState.ERROR;
        state.error = action.payload as MetricsError;
      });
  }
});

export const metricsActions = metricsSlice.actions;
export const metricsReducer = metricsSlice.reducer;
export const metricsThunks = {
  fetchMetrics,
  fetchSystemHealth,
  fetchAgentMetrics
};