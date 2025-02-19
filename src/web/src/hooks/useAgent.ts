/**
 * Custom React hook for managing AI agent operations and state
 * Provides a unified interface for agent CRUD operations, status management,
 * metrics tracking, and error handling with performance optimizations
 * @version 1.0.0
 */

import { useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Agent, 
  AgentConfig, 
  CreateAgentRequest, 
  UpdateAgentRequest,
  AgentStatus 
} from '../types/agent.types';
import { agentService } from '../services/agentService';
import { ApiError } from '../types/api.types';

// Operation types for granular loading states
type OperationType = 
  | 'fetch'
  | 'create'
  | 'update'
  | 'delete'
  | 'metrics'
  | 'status'
  | 'batch';

interface UseAgentReturn {
  // State
  agents: Agent[];
  loading: Record<OperationType, boolean>;
  error: Record<OperationType, ApiError | null>;
  
  // Operations
  fetchAgents: () => Promise<void>;
  getAgentById: (id: string) => Promise<Agent | null>;
  createAgent: (request: CreateAgentRequest) => Promise<Agent>;
  updateAgent: (id: string, request: UpdateAgentRequest) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  getAgentMetrics: (id: string) => Promise<Agent['metrics']>;
  getAgentStatus: (id: string) => Promise<AgentStatus>;
  batchUpdateAgents: (updates: Array<{ id: string; request: UpdateAgentRequest }>) => Promise<void>;
  
  // Error handling
  retryOperation: (operation: OperationType) => Promise<void>;
  clearError: (operation: OperationType) => void;
}

/**
 * Hook for managing agent operations with optimized performance and error handling
 */
export const useAgent = (): UseAgentReturn => {
  // Redux state management
  const dispatch = useDispatch();
  const agents = useSelector((state: any) => state.agents.items);
  
  // Local state for loading and errors
  const [loading, setLoading] = useState<Record<OperationType, boolean>>({
    fetch: false,
    create: false,
    update: false,
    delete: false,
    metrics: false,
    status: false,
    batch: false
  });
  
  const [error, setError] = useState<Record<OperationType, ApiError | null>>({
    fetch: null,
    create: null,
    update: null,
    delete: null,
    metrics: null,
    status: null,
    batch: null
  });

  // Cache for optimizing frequent operations
  const cache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_TTL = 60000; // 1 minute

  // Helper to update loading state
  const setOperationLoading = useCallback((operation: OperationType, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [operation]: isLoading }));
  }, []);

  // Helper to update error state
  const setOperationError = useCallback((operation: OperationType, err: ApiError | null) => {
    setError(prev => ({ ...prev, [operation]: err }));
  }, []);

  // Fetch all agents
  const fetchAgents = useCallback(async () => {
    setOperationLoading('fetch', true);
    try {
      const response = await agentService.getAgents();
      dispatch({ type: 'agents/setAgents', payload: response });
      setOperationError('fetch', null);
    } catch (err) {
      setOperationError('fetch', err as ApiError);
    } finally {
      setOperationLoading('fetch', false);
    }
  }, [dispatch]);

  // Get agent by ID with caching
  const getAgentById = useCallback(async (id: string): Promise<Agent | null> => {
    const cacheKey = `agent_${id}`;
    const cached = cache.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const agent = await agentService.getAgentById(id);
      cache.current.set(cacheKey, { data: agent, timestamp: Date.now() });
      return agent;
    } catch (err) {
      console.error('Failed to fetch agent:', err);
      return null;
    }
  }, []);

  // Create new agent
  const createAgent = useCallback(async (request: CreateAgentRequest): Promise<Agent> => {
    setOperationLoading('create', true);
    try {
      const agent = await agentService.createAgent(request);
      dispatch({ type: 'agents/addAgent', payload: agent });
      setOperationError('create', null);
      return agent;
    } catch (err) {
      setOperationError('create', err as ApiError);
      throw err;
    } finally {
      setOperationLoading('create', false);
    }
  }, [dispatch]);

  // Update existing agent
  const updateAgent = useCallback(async (id: string, request: UpdateAgentRequest): Promise<Agent> => {
    setOperationLoading('update', true);
    try {
      const agent = await agentService.updateAgent(id, request);
      dispatch({ type: 'agents/updateAgent', payload: { id, updates: agent } });
      cache.current.delete(`agent_${id}`);
      setOperationError('update', null);
      return agent;
    } catch (err) {
      setOperationError('update', err as ApiError);
      throw err;
    } finally {
      setOperationLoading('update', false);
    }
  }, [dispatch]);

  // Delete agent
  const deleteAgent = useCallback(async (id: string): Promise<void> => {
    setOperationLoading('delete', true);
    try {
      await agentService.deleteAgent(id);
      dispatch({ type: 'agents/removeAgent', payload: id });
      cache.current.delete(`agent_${id}`);
      setOperationError('delete', null);
    } catch (err) {
      setOperationError('delete', err as ApiError);
      throw err;
    } finally {
      setOperationLoading('delete', false);
    }
  }, [dispatch]);

  // Get agent metrics
  const getAgentMetrics = useCallback(async (id: string): Promise<Agent['metrics']> => {
    setOperationLoading('metrics', true);
    try {
      const metrics = await agentService.getAgentMetrics(id);
      setOperationError('metrics', null);
      return metrics;
    } catch (err) {
      setOperationError('metrics', err as ApiError);
      throw err;
    } finally {
      setOperationLoading('metrics', false);
    }
  }, []);

  // Get agent status
  const getAgentStatus = useCallback(async (id: string): Promise<AgentStatus> => {
    setOperationLoading('status', true);
    try {
      const status = await agentService.getAgentStatus(id);
      setOperationError('status', null);
      return status;
    } catch (err) {
      setOperationError('status', err as ApiError);
      throw err;
    } finally {
      setOperationLoading('status', false);
    }
  }, []);

  // Batch update agents
  const batchUpdateAgents = useCallback(async (
    updates: Array<{ id: string; request: UpdateAgentRequest }>
  ): Promise<void> => {
    setOperationLoading('batch', true);
    try {
      await Promise.all(
        updates.map(({ id, request }) => updateAgent(id, request))
      );
      setOperationError('batch', null);
    } catch (err) {
      setOperationError('batch', err as ApiError);
      throw err;
    } finally {
      setOperationLoading('batch', false);
    }
  }, [updateAgent]);

  // Retry failed operation
  const retryOperation = useCallback(async (operation: OperationType): Promise<void> => {
    const retryMap: Record<OperationType, () => Promise<void>> = {
      fetch: fetchAgents,
      create: async () => { /* Requires original request */ },
      update: async () => { /* Requires original id and request */ },
      delete: async () => { /* Requires original id */ },
      metrics: async () => { /* Requires original id */ },
      status: async () => { /* Requires original id */ },
      batch: async () => { /* Requires original updates */ }
    };

    if (retryMap[operation]) {
      await retryMap[operation]();
    }
  }, [fetchAgents]);

  // Clear error for operation
  const clearError = useCallback((operation: OperationType): void => {
    setOperationError(operation, null);
  }, []);

  return {
    agents,
    loading,
    error,
    fetchAgents,
    getAgentById,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgentMetrics,
    getAgentStatus,
    batchUpdateAgents,
    retryOperation,
    clearError
  };
};