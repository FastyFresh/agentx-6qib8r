import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { agentService } from '../../src/services/agentService';
import { httpClient } from '../../src/services/httpClient';
import { Agent, AgentStatus, AgentConfig } from '../../src/types/agent.types';
import { AGENT_ENDPOINTS } from '../../src/constants/apiEndpoints';
import { ApiError, ResponseStatus } from '../../src/types/api.types';

// Mock the httpClient
jest.mock('../../src/services/httpClient');

describe('AgentService', () => {
  // Mock data
  const mockAgent: Agent = {
    id: '123',
    name: 'Test Agent',
    description: 'Test Description',
    status: AgentStatus.ACTIVE,
    config: {
      naturalLanguageInput: 'Create a sales automation agent',
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
        memory: 1024
      }
    },
    integrationIds: ['integration1'],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastDeployedAt: new Date(),
    errorMessage: null,
    metrics: {
      successRate: 98.5,
      avgResponseTime: 150,
      lastExecutionTime: new Date()
    }
  };

  const mockApiError: ApiError = {
    code: 'AGENT_NOT_FOUND',
    message: 'Agent not found',
    details: {},
    status: 404,
    timestamp: new Date().toISOString(),
    path: AGENT_ENDPOINTS.GET_BY_ID,
    requestId: 'test-request-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset httpClient mock implementation
    (httpClient.get as jest.Mock).mockReset();
    (httpClient.post as jest.Mock).mockReset();
    (httpClient.put as jest.Mock).mockReset();
    (httpClient.delete as jest.Mock).mockReset();
  });

  describe('getAgents', () => {
    it('should retrieve agents list with performance validation', async () => {
      const startTime = performance.now();
      
      (httpClient.get as jest.Mock).mockResolvedValue({
        data: [mockAgent],
        status: ResponseStatus.SUCCESS,
        message: 'Success',
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
      });

      const agents = await agentService.getAgents();
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual(mockAgent);
      expect(responseTime).toBeLessThan(200); // Performance requirement
      expect(httpClient.get).toHaveBeenCalledWith(AGENT_ENDPOINTS.BASE);
    });

    it('should handle network errors with retry', async () => {
      (httpClient.get as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: [mockAgent],
          status: ResponseStatus.SUCCESS
        });

      const agents = await agentService.getAgents();
      
      expect(agents).toHaveLength(1);
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAgentById', () => {
    it('should retrieve a specific agent', async () => {
      (httpClient.get as jest.Mock).mockResolvedValue({
        data: mockAgent,
        status: ResponseStatus.SUCCESS
      });

      const agent = await agentService.getAgentById('123');
      
      expect(agent).toEqual(mockAgent);
      expect(httpClient.get).toHaveBeenCalledWith(
        AGENT_ENDPOINTS.GET_BY_ID.replace(':id', '123')
      );
    });

    it('should handle agent not found error', async () => {
      (httpClient.get as jest.Mock).mockRejectedValue(mockApiError);

      await expect(agentService.getAgentById('invalid-id'))
        .rejects.toEqual(mockApiError);
    });
  });

  describe('createAgent', () => {
    const createRequest = {
      name: 'New Agent',
      description: 'New Description',
      config: mockAgent.config
    };

    it('should create a new agent', async () => {
      (httpClient.post as jest.Mock).mockResolvedValue({
        data: { ...mockAgent, ...createRequest },
        status: ResponseStatus.SUCCESS
      });

      const newAgent = await agentService.createAgent(createRequest);
      
      expect(newAgent.name).toBe(createRequest.name);
      expect(httpClient.post).toHaveBeenCalledWith(
        AGENT_ENDPOINTS.CREATE,
        createRequest
      );
    });

    it('should validate agent configuration', async () => {
      const invalidConfig = {
        ...createRequest,
        config: { invalidField: true }
      };

      await expect(agentService.createAgent(invalidConfig))
        .rejects.toThrow();
    });
  });

  describe('updateAgent', () => {
    const updateRequest = {
      name: 'Updated Agent',
      status: AgentStatus.PAUSED
    };

    it('should update an existing agent', async () => {
      (httpClient.put as jest.Mock).mockResolvedValue({
        data: { ...mockAgent, ...updateRequest },
        status: ResponseStatus.SUCCESS
      });

      const updatedAgent = await agentService.updateAgent('123', updateRequest);
      
      expect(updatedAgent.name).toBe(updateRequest.name);
      expect(updatedAgent.status).toBe(updateRequest.status);
      expect(httpClient.put).toHaveBeenCalledWith(
        AGENT_ENDPOINTS.UPDATE.replace(':id', '123'),
        updateRequest
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { name: 'Partial Update' };
      
      (httpClient.put as jest.Mock).mockResolvedValue({
        data: { ...mockAgent, ...partialUpdate },
        status: ResponseStatus.SUCCESS
      });

      const updatedAgent = await agentService.updateAgent('123', partialUpdate);
      
      expect(updatedAgent.name).toBe(partialUpdate.name);
      expect(updatedAgent.status).toBe(mockAgent.status);
    });
  });

  describe('deleteAgent', () => {
    it('should delete an agent', async () => {
      (httpClient.delete as jest.Mock).mockResolvedValue({
        status: ResponseStatus.SUCCESS
      });

      await agentService.deleteAgent('123');
      
      expect(httpClient.delete).toHaveBeenCalledWith(
        AGENT_ENDPOINTS.DELETE.replace(':id', '123')
      );
    });

    it('should handle deletion of non-existent agent', async () => {
      (httpClient.delete as jest.Mock).mockRejectedValue(mockApiError);

      await expect(agentService.deleteAgent('invalid-id'))
        .rejects.toEqual(mockApiError);
    });
  });

  describe('getAgentMetrics', () => {
    it('should retrieve agent metrics', async () => {
      (httpClient.get as jest.Mock).mockResolvedValue({
        data: mockAgent.metrics,
        status: ResponseStatus.SUCCESS
      });

      const metrics = await agentService.getAgentMetrics('123');
      
      expect(metrics).toEqual(mockAgent.metrics);
      expect(httpClient.get).toHaveBeenCalledWith(
        AGENT_ENDPOINTS.METRICS.replace(':id', '123')
      );
    });

    it('should handle metrics retrieval performance', async () => {
      const startTime = performance.now();
      
      (httpClient.get as jest.Mock).mockResolvedValue({
        data: mockAgent.metrics,
        status: ResponseStatus.SUCCESS
      });

      await agentService.getAgentMetrics('123');
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('getAgentStatus', () => {
    it('should retrieve agent status', async () => {
      (httpClient.get as jest.Mock).mockResolvedValue({
        data: { status: AgentStatus.ACTIVE },
        status: ResponseStatus.SUCCESS
      });

      const status = await agentService.getAgentStatus('123');
      
      expect(status).toBe(AgentStatus.ACTIVE);
      expect(httpClient.get).toHaveBeenCalledWith(
        AGENT_ENDPOINTS.STATUS.replace(':id', '123')
      );
    });

    it('should handle status changes', async () => {
      (httpClient.get as jest.Mock)
        .mockResolvedValueOnce({
          data: { status: AgentStatus.DEPLOYING },
          status: ResponseStatus.SUCCESS
        })
        .mockResolvedValueOnce({
          data: { status: AgentStatus.ACTIVE },
          status: ResponseStatus.SUCCESS
        });

      const deployingStatus = await agentService.getAgentStatus('123');
      expect(deployingStatus).toBe(AgentStatus.DEPLOYING);

      const activeStatus = await agentService.getAgentStatus('123');
      expect(activeStatus).toBe(AgentStatus.ACTIVE);
    });
  });
});