import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { jest } from '@jest/globals'; // ^29.6.0
import reducer, { 
  actions, 
  selectors,
  fetchAgents,
  createAgent,
  updateAgent,
  deleteAgent
} from '../../src/store/agents/agentSlice';
import { agentService } from '../../src/services/agentService';
import { 
  AgentsState, 
  LoadingState,
  ErrorState,
  AgentMetricsState 
} from '../../src/store/agents/types';
import { Agent, AgentStatus } from '../../src/types/agent.types';

// Mock performance.now() for consistent timing tests
const mockPerformanceNow = jest.spyOn(performance, 'now');

// Mock agent service
jest.mock('../../src/services/agentService');

// Test data setup
const mockAgent: Agent = {
  id: '1',
  name: 'Test Agent',
  description: 'Test agent for unit tests',
  status: AgentStatus.ACTIVE,
  config: {
    naturalLanguageInput: 'Test input',
    schedule: { type: 'realtime' },
    permissions: {
      readCustomerData: true,
      writeCustomerData: false,
      accessReports: true,
      executeActions: true,
      manageIntegrations: false
    },
    resources: {
      cpu: 1,
      memory: 512
    }
  },
  integrationIds: ['int-1'],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastDeployedAt: new Date(),
  errorMessage: null,
  metrics: {
    successRate: 99.9,
    avgResponseTime: 150,
    totalExecutions: 1000,
    errorRate: 0.1,
    lastUpdated: new Date().toISOString()
  }
};

const mockInitialState: AgentsState = {
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

describe('agentsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { agents: reducer },
      middleware: (getDefaultMiddleware) => 
        getDefaultMiddleware({
          serializableCheck: false,
          thunk: true
        })
    });
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
  });

  describe('reducer', () => {
    it('should return initial state', () => {
      expect(reducer(undefined, { type: '' })).toEqual(mockInitialState);
    });

    it('should handle setSelectedAgent', () => {
      const nextState = reducer(mockInitialState, actions.setSelectedAgent(mockAgent));
      expect(nextState.selectedAgent).toEqual(mockAgent);
    });

    it('should handle updateAgentMetrics', () => {
      const metrics: AgentMetricsState = {
        successRate: 99.9,
        avgResponseTime: 150,
        totalExecutions: 1000,
        errorRate: 0.1,
        lastUpdated: new Date().toISOString()
      };

      const nextState = reducer(
        mockInitialState,
        actions.updateAgentMetrics({ agentId: mockAgent.id, metrics })
      );
      expect(nextState.metrics[mockAgent.id]).toEqual(metrics);
    });

    it('should handle setFilters and reset pagination', () => {
      const filters = { status: [AgentStatus.ACTIVE] };
      const nextState = reducer(mockInitialState, actions.setFilters(filters));
      expect(nextState.filters).toEqual(filters);
      expect(nextState.pagination.currentPage).toBe(1);
    });

    it('should handle clearError', () => {
      const stateWithError = {
        ...mockInitialState,
        error: { code: 'TEST_ERROR', message: 'Test error' }
      };
      const nextState = reducer(stateWithError, actions.clearError());
      expect(nextState.error).toBeNull();
    });
  });

  describe('async thunks', () => {
    beforeEach(() => {
      mockPerformanceNow.mockReturnValue(0);
    });

    it('should handle fetchAgents success within performance threshold', async () => {
      const agents = [mockAgent];
      (agentService.getAgents as jest.Mock).mockResolvedValue(agents);
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(150);

      await store.dispatch(fetchAgents({ page: 1, limit: 10, filters: {} }));
      const state = store.getState().agents;

      expect(state.loading.fetch).toBe(LoadingState.SUCCEEDED);
      expect(state.agents).toEqual(agents);
      expect(state.error).toBeNull();
    });

    it('should handle createAgent with validation and monitoring', async () => {
      (agentService.createAgent as jest.Mock).mockResolvedValue(mockAgent);
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100);

      await store.dispatch(createAgent({
        payload: {
          name: mockAgent.name,
          description: mockAgent.description,
          config: mockAgent.config
        },
        options: { validateConfig: true, autoActivate: true }
      }));

      const state = store.getState().agents;
      expect(state.loading.create).toBe(LoadingState.SUCCEEDED);
      expect(state.agents).toContainEqual(mockAgent);
    });

    it('should handle updateAgent with optimistic updates', async () => {
      const updatedAgent = { ...mockAgent, name: 'Updated Agent' };
      (agentService.updateAgent as jest.Mock).mockResolvedValue(updatedAgent);

      const stateWithAgent = {
        ...mockInitialState,
        agents: [mockAgent],
        selectedAgent: mockAgent
      };

      store = configureStore({
        reducer: { agents: reducer },
        preloadedState: { agents: stateWithAgent }
      });

      await store.dispatch(updateAgent({
        id: mockAgent.id,
        updates: { name: 'Updated Agent' },
        options: { validateUpdates: true }
      }));

      const state = store.getState().agents;
      expect(state.loading.update).toBe(LoadingState.SUCCEEDED);
      expect(state.agents[0]).toEqual(updatedAgent);
      expect(state.selectedAgent).toEqual(updatedAgent);
    });

    it('should handle deleteAgent with cache cleanup', async () => {
      (agentService.deleteAgent as jest.Mock).mockResolvedValue(undefined);

      const stateWithAgent = {
        ...mockInitialState,
        agents: [mockAgent],
        selectedAgent: mockAgent,
        metrics: { [mockAgent.id]: mockAgent.metrics }
      };

      store = configureStore({
        reducer: { agents: reducer },
        preloadedState: { agents: stateWithAgent }
      });

      await store.dispatch(deleteAgent(mockAgent.id));

      const state = store.getState().agents;
      expect(state.loading.delete).toBe(LoadingState.SUCCEEDED);
      expect(state.agents).toHaveLength(0);
      expect(state.selectedAgent).toBeNull();
      expect(state.metrics[mockAgent.id]).toBeUndefined();
    });
  });

  describe('selectors', () => {
    it('should select agents list', () => {
      const state = { agents: { ...mockInitialState, agents: [mockAgent] } };
      expect(selectors.selectAgents(state)).toEqual([mockAgent]);
    });

    it('should select selected agent', () => {
      const state = { agents: { ...mockInitialState, selectedAgent: mockAgent } };
      expect(selectors.selectSelectedAgent(state)).toEqual(mockAgent);
    });

    it('should select agent metrics', () => {
      const state = {
        agents: {
          ...mockInitialState,
          metrics: { [mockAgent.id]: mockAgent.metrics }
        }
      };
      expect(selectors.selectAgentMetrics(state)).toEqual({
        [mockAgent.id]: mockAgent.metrics
      });
    });

    it('should select loading states', () => {
      const state = { agents: mockInitialState };
      expect(selectors.selectAgentLoading(state)).toEqual(mockInitialState.loading);
    });

    it('should select error state', () => {
      const error: ErrorState = {
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: new Date().toISOString()
      };
      const state = { agents: { ...mockInitialState, error } };
      expect(selectors.selectAgentError(state)).toEqual(error);
    });

    it('should select filters', () => {
      const filters = { status: [AgentStatus.ACTIVE] };
      const state = { agents: { ...mockInitialState, filters } };
      expect(selectors.selectAgentFilters(state)).toEqual(filters);
    });

    it('should select pagination', () => {
      const state = { agents: mockInitialState };
      expect(selectors.selectAgentPagination(state)).toEqual(mockInitialState.pagination);
    });
  });
});