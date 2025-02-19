/**
 * @packageDocumentation
 * Type definitions for the agents Redux store slice
 * Provides comprehensive type safety for agent management and monitoring
 * @version 1.0.0
 */

import { PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { Agent, CreateAgentRequest, UpdateAgentRequest } from '../../types/agent.types';

/**
 * Loading states for async operations
 */
export enum LoadingState {
  IDLE = 'idle',
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed'
}

/**
 * Enhanced error state tracking
 */
export interface ErrorState {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Agent metrics state interface
 */
export interface AgentMetricsState {
  successRate: number;
  avgResponseTime: number;
  totalExecutions: number;
  errorRate: number;
  lastUpdated: string;
}

/**
 * Filtering options for agent queries
 */
export interface AgentFilters {
  status?: string[];
  integrationIds?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
}

/**
 * Main state interface for the agents slice
 */
export interface AgentsState {
  agents: Agent[];
  selectedAgent: Agent | null;
  loading: {
    fetch: LoadingState;
    create: LoadingState;
    update: LoadingState;
    delete: LoadingState;
  };
  error: ErrorState | null;
  metrics: {
    [agentId: string]: AgentMetricsState;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
  filters: AgentFilters;
}

/**
 * Payload type for fetching agents with pagination and filtering
 */
export interface FetchAgentsPayload {
  page: number;
  limit: number;
  filters: AgentFilters;
}

/**
 * Options for agent creation
 */
export interface CreateAgentOptions {
  validateConfig?: boolean;
  autoActivate?: boolean;
  skipIntegrationCheck?: boolean;
}

/**
 * Options for agent updates
 */
export interface UpdateAgentOptions {
  validateUpdates?: boolean;
  forceUpdate?: boolean;
  updateIntegrations?: boolean;
}

/**
 * Enhanced payload type for create agent thunk
 */
export type CreateAgentThunkPayload = {
  payload: CreateAgentRequest;
  options: CreateAgentOptions;
};

/**
 * Enhanced payload type for update agent thunk
 */
export type UpdateAgentThunkPayload = {
  id: string;
  updates: UpdateAgentRequest;
  options: UpdateAgentOptions;
};

/**
 * Type definitions for agent-related actions
 */
export type AgentActionTypes = {
  setSelectedAgent: PayloadAction<Agent | null>;
  setAgents: PayloadAction<Agent[]>;
  updateAgent: PayloadAction<Agent>;
  removeAgent: PayloadAction<string>;
  setLoading: PayloadAction<{ type: keyof AgentsState['loading']; state: LoadingState }>;
  setError: PayloadAction<ErrorState | null>;
  updateMetrics: PayloadAction<{ agentId: string; metrics: AgentMetricsState }>;
  setPagination: PayloadAction<Partial<AgentsState['pagination']>>;
  setFilters: PayloadAction<Partial<AgentFilters>>;
};

/**
 * Type for batch operations on agents
 */
export interface BatchAgentOperation {
  agentIds: string[];
  operation: 'activate' | 'deactivate' | 'delete';
  options?: {
    force?: boolean;
    cascade?: boolean;
  };
}

/**
 * Type for agent metrics update payload
 */
export interface MetricsUpdatePayload {
  agentId: string;
  metrics: Partial<AgentMetricsState>;
  timestamp: string;
}

/**
 * Type for agent state subscription options
 */
export interface AgentStateSubscription {
  agentId: string;
  events: ('status' | 'metrics' | 'config' | 'error')[];
  throttleMs?: number;
}