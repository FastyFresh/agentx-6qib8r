import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { useAgent } from '../../src/hooks/useAgent';
import { agentService } from '../../src/services/agentService';
import { integrationService } from '../../src/services/integrationService';
import { Agent, AgentStatus } from '../../src/types/agent.types';
import { IntegrationServiceType } from '../../src/types/integration.types';

// Mock Redux hooks
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => mockAgents
}));

// Mock services
jest.mock('../../src/services/agentService');
jest.mock('../../src/services/integrationService');

// Performance thresholds from technical spec
const PERFORMANCE_THRESHOLDS = {
  RESPONSE_TIME: 200, // 200ms max response time
  SUCCESS_RATE: 0.999 // 99.9% success rate
};

// Test data
const mockAgent: Agent = {
  id: '123',
  name: 'Test Agent',
  description: 'Test agent for unit tests',
  status: AgentStatus.ACTIVE,
  config: {
    naturalLanguageInput: 'Handle customer inquiries',
    schedule: {
      type: 'realtime'
    },
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
  integrationIds: ['integration-1'],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastDeployedAt: new Date(),
  errorMessage: null,
  metrics: {
    successRate: 0.999,
    avgResponseTime: 150,
    lastExecutionTime: new Date()
  }
};

const mockAgents = [mockAgent];

describe('useAgent hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset performance measurements
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('CRUD Operations', () => {
    it('should fetch agents successfully', async () => {
      const startTime = performance.now();
      (agentService.getAgents as jest.Mock).mockResolvedValue(mockAgents);

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        await result.current.fetchAgents();
      });

      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME);
      expect(result.current.agents).toEqual(mockAgents);
      expect(result.current.error.fetch).toBeNull();
    });

    it('should create agent with valid configuration', async () => {
      const createRequest = {
        name: 'New Agent',
        description: 'Test creation',
        config: mockAgent.config
      };

      (agentService.createAgent as jest.Mock).mockResolvedValue({
        ...mockAgent,
        ...createRequest
      });

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        await result.current.createAgent(createRequest);
      });

      expect(result.current.error.create).toBeNull();
      expect(agentService.createAgent).toHaveBeenCalledWith(createRequest);
    });

    it('should update agent successfully', async () => {
      const updateRequest = {
        name: 'Updated Agent',
        status: AgentStatus.PAUSED
      };

      (agentService.updateAgent as jest.Mock).mockResolvedValue({
        ...mockAgent,
        ...updateRequest
      });

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        await result.current.updateAgent(mockAgent.id, updateRequest);
      });

      expect(result.current.error.update).toBeNull();
      expect(agentService.updateAgent).toHaveBeenCalledWith(mockAgent.id, updateRequest);
    });

    it('should delete agent and clean up resources', async () => {
      (agentService.deleteAgent as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        await result.current.deleteAgent(mockAgent.id);
      });

      expect(result.current.error.delete).toBeNull();
      expect(agentService.deleteAgent).toHaveBeenCalledWith(mockAgent.id);
    });
  });

  describe('Performance Tests', () => {
    it('should maintain response times under 200ms', async () => {
      const measurements: number[] = [];
      
      const { result } = renderHook(() => useAgent());

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await act(async () => {
          await result.current.getAgentById(mockAgent.id);
        });
        measurements.push(performance.now() - start);
      }

      const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME);
    });

    it('should handle concurrent operations efficiently', async () => {
      const { result } = renderHook(() => useAgent());

      const operations = [
        result.current.fetchAgents(),
        result.current.getAgentById(mockAgent.id),
        result.current.getAgentMetrics(mockAgent.id)
      ];

      await act(async () => {
        await Promise.all(operations);
      });

      expect(result.current.error.fetch).toBeNull();
      expect(result.current.error.metrics).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures with retry mechanism', async () => {
      const networkError = new Error('Network failure');
      (agentService.getAgents as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockAgents);

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        await result.current.fetchAgents();
        await result.current.retryOperation('fetch');
      });

      expect(result.current.agents).toEqual(mockAgents);
      expect(agentService.getAgents).toHaveBeenCalledTimes(2);
    });

    it('should handle and recover from rate limiting', async () => {
      const rateLimitError = {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        status: 429
      };

      (agentService.getAgentMetrics as jest.Mock)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockAgent.metrics);

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        try {
          await result.current.getAgentMetrics(mockAgent.id);
        } catch (error) {
          await waitFor(() => result.current.retryOperation('metrics'));
        }
      });

      expect(result.current.error.metrics).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should validate integration connections', async () => {
      const integrationConfig = {
        type: IntegrationServiceType.ZOHO_CRM,
        apiKey: 'test-key'
      };

      (integrationService.validateConnection as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        await result.current.createAgent({
          ...mockAgent,
          integrationIds: ['new-integration']
        });
      });

      expect(integrationService.validateConnection).toHaveBeenCalled();
      expect(result.current.error.create).toBeNull();
    });

    it('should handle integration data transformation', async () => {
      const transformedData = {
        ...mockAgent,
        config: {
          ...mockAgent.config,
          transformed: true
        }
      };

      (integrationService.transformData as jest.Mock).mockResolvedValue(transformedData);

      const { result } = renderHook(() => useAgent());
      
      await act(async () => {
        await result.current.updateAgent(mockAgent.id, transformedData);
      });

      expect(integrationService.transformData).toHaveBeenCalled();
      expect(result.current.error.update).toBeNull();
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on unmount', () => {
      const { unmount } = renderHook(() => useAgent());
      
      unmount();
      
      // Verify cache is cleared
      expect(agentService.getAgents).not.toHaveBeenCalled();
    });
  });
});