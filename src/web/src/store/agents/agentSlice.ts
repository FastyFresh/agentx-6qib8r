/**
 * Enhanced Redux slice for managing agent state with comprehensive monitoring,
 * error handling, and performance optimization features
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { retry } from 'axios-retry'; // ^3.5.0
import { monitoring } from '@opentelemetry/api'; // ^1.4.0
import { agentService } from '../../services/agentService';
import { 
  AgentsState, 
  FetchAgentsPayload, 
  CreateAgentThunkPayload,
  UpdateAgentThunkPayload,
  LoadingState,
  ErrorState,
  AgentFilters
} from './types';
import { Agent, AgentStatus } from '../../types/agent.types';

// Performance monitoring tracer
const tracer = monitoring.trace.getTracer('agent-slice');

// Initial state with enhanced monitoring and caching
const initialState: AgentsState = {
  agents: [],
  selectedAgent: null,
  loading: {
    fetch: LoadingState.IDLE,
    create: LoadingState.IDLE,
    update: LoadingState.IDLE,
    delete: LoadingState.IDLE
  },
  error: null,
  metrics: {},
  pagination: {
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    totalItems: 0
  },
  filters: {},
  cache: {
    data: {},
    timestamp: {}
  }
};

// Enhanced async thunks with monitoring and error handling
export const fetchAgents = createAsyncThunk(
  'agents/fetchAgents',
  async (payload: FetchAgentsPayload, { rejectWithValue }) => {
    const span = tracer.startSpan('fetchAgents');
    
    try {
      span.setAttribute('page', payload.page);
      span.setAttribute('limit', payload.limit);
      
      const response = await agentService.getAgents();
      
      span.setAttribute('agentsCount', response.length);
      span.setStatus({ code: monitoring.SpanStatusCode.OK });
      
      return response;
    } catch (error) {
      span.setStatus({
        code: monitoring.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return rejectWithValue(error);
    } finally {
      span.end();
    }
  }
);

export const createAgent = createAsyncThunk(
  'agents/createAgent',
  async ({ payload, options }: CreateAgentThunkPayload, { rejectWithValue }) => {
    const span = tracer.startSpan('createAgent');
    
    try {
      span.setAttribute('agentName', payload.name);
      
      const response = await agentService.createAgent(payload);
      
      span.setStatus({ code: monitoring.SpanStatusCode.OK });
      span.setAttribute('agentId', response.id);
      
      return response;
    } catch (error) {
      span.setStatus({
        code: monitoring.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return rejectWithValue(error);
    } finally {
      span.end();
    }
  }
);

export const updateAgent = createAsyncThunk(
  'agents/updateAgent',
  async ({ id, updates, options }: UpdateAgentThunkPayload, { rejectWithValue }) => {
    const span = tracer.startSpan('updateAgent');
    
    try {
      span.setAttribute('agentId', id);
      
      const response = await agentService.updateAgent(id, updates);
      
      span.setStatus({ code: monitoring.SpanStatusCode.OK });
      
      return response;
    } catch (error) {
      span.setStatus({
        code: monitoring.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return rejectWithValue(error);
    } finally {
      span.end();
    }
  }
);

export const deleteAgent = createAsyncThunk(
  'agents/deleteAgent',
  async (id: string, { rejectWithValue }) => {
    const span = tracer.startSpan('deleteAgent');
    
    try {
      span.setAttribute('agentId', id);
      
      await agentService.deleteAgent(id);
      
      span.setStatus({ code: monitoring.SpanStatusCode.OK });
      
      return id;
    } catch (error) {
      span.setStatus({
        code: monitoring.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return rejectWithValue(error);
    } finally {
      span.end();
    }
  }
);

// Enhanced Redux slice with comprehensive state management
const agentsSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    setSelectedAgent: (state, action: PayloadAction<Agent | null>) => {
      state.selectedAgent = action.payload;
    },
    updateAgentMetrics: (state, action: PayloadAction<{ agentId: string, metrics: Agent['metrics'] }>) => {
      const { agentId, metrics } = action.payload;
      if (state.metrics[agentId]) {
        state.metrics[agentId] = { ...state.metrics[agentId], ...metrics };
      } else {
        state.metrics[agentId] = metrics;
      }
    },
    setFilters: (state, action: PayloadAction<AgentFilters>) => {
      state.filters = action.payload;
      state.pagination.currentPage = 1; // Reset pagination when filters change
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Agents
      .addCase(fetchAgents.pending, (state) => {
        state.loading.fetch = LoadingState.PENDING;
        state.error = null;
      })
      .addCase(fetchAgents.fulfilled, (state, action) => {
        state.loading.fetch = LoadingState.SUCCEEDED;
        state.agents = action.payload;
        state.error = null;
      })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.loading.fetch = LoadingState.FAILED;
        state.error = {
          code: 'FETCH_ERROR',
          message: action.error.message || 'Failed to fetch agents',
          timestamp: new Date().toISOString()
        };
      })
      // Create Agent
      .addCase(createAgent.pending, (state) => {
        state.loading.create = LoadingState.PENDING;
        state.error = null;
      })
      .addCase(createAgent.fulfilled, (state, action) => {
        state.loading.create = LoadingState.SUCCEEDED;
        state.agents.push(action.payload);
        state.error = null;
      })
      .addCase(createAgent.rejected, (state, action) => {
        state.loading.create = LoadingState.FAILED;
        state.error = {
          code: 'CREATE_ERROR',
          message: action.error.message || 'Failed to create agent',
          timestamp: new Date().toISOString()
        };
      })
      // Update Agent
      .addCase(updateAgent.pending, (state) => {
        state.loading.update = LoadingState.PENDING;
        state.error = null;
      })
      .addCase(updateAgent.fulfilled, (state, action) => {
        state.loading.update = LoadingState.SUCCEEDED;
        const index = state.agents.findIndex(agent => agent.id === action.payload.id);
        if (index !== -1) {
          state.agents[index] = action.payload;
        }
        if (state.selectedAgent?.id === action.payload.id) {
          state.selectedAgent = action.payload;
        }
        state.error = null;
      })
      .addCase(updateAgent.rejected, (state, action) => {
        state.loading.update = LoadingState.FAILED;
        state.error = {
          code: 'UPDATE_ERROR',
          message: action.error.message || 'Failed to update agent',
          timestamp: new Date().toISOString()
        };
      })
      // Delete Agent
      .addCase(deleteAgent.pending, (state) => {
        state.loading.delete = LoadingState.PENDING;
        state.error = null;
      })
      .addCase(deleteAgent.fulfilled, (state, action) => {
        state.loading.delete = LoadingState.SUCCEEDED;
        state.agents = state.agents.filter(agent => agent.id !== action.payload);
        if (state.selectedAgent?.id === action.payload) {
          state.selectedAgent = null;
        }
        delete state.metrics[action.payload];
        state.error = null;
      })
      .addCase(deleteAgent.rejected, (state, action) => {
        state.loading.delete = LoadingState.FAILED;
        state.error = {
          code: 'DELETE_ERROR',
          message: action.error.message || 'Failed to delete agent',
          timestamp: new Date().toISOString()
        };
      });
  }
});

// Export actions and reducer
export const { 
  setSelectedAgent, 
  updateAgentMetrics, 
  setFilters, 
  clearError 
} = agentsSlice.actions;

export default agentsSlice.reducer;

// Memoized selectors
export const selectAgents = (state: { agents: AgentsState }) => state.agents.agents;
export const selectSelectedAgent = (state: { agents: AgentsState }) => state.agents.selectedAgent;
export const selectAgentMetrics = (state: { agents: AgentsState }) => state.agents.metrics;
export const selectAgentLoading = (state: { agents: AgentsState }) => state.agents.loading;
export const selectAgentError = (state: { agents: AgentsState }) => state.agents.error;
export const selectAgentFilters = (state: { agents: AgentsState }) => state.agents.filters;
export const selectAgentPagination = (state: { agents: AgentsState }) => state.agents.pagination;