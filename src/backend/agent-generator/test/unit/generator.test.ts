// External dependencies
import { jest } from '@jest/globals'; // v29.6.0
import { Repository } from 'typeorm'; // v0.3.17
import { GenericContainer, StartedTestContainer } from 'testcontainers'; // v9.8.0
import now from 'performance-now'; // v2.1.0

// Internal imports
import { GeneratorService } from '../../src/services/generator.service';
import { 
  Agent, 
  AgentType, 
  AgentStatus, 
  AgentHealth,
  AgentMetrics 
} from '../../src/models/Agent';

describe('GeneratorService', () => {
  let generatorService: GeneratorService;
  let mockRepository: jest.Mocked<Repository<Agent>>;
  let mockDockerService: jest.Mock;
  let mockMetricsCollector: jest.Mock;
  let mockSecurityValidator: jest.Mock;
  let testContainer: StartedTestContainer;

  const testAgentId = '550e8400-e29b-41d4-a716-446655440000';
  const testCreatorId = '550e8400-e29b-41d4-a716-446655440001';

  beforeAll(async () => {
    // Initialize mocks
    mockRepository = {
      save: jest.fn(),
      findOneOrFail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockDockerService = jest.fn().mockImplementation(() => ({
      createContainer: jest.fn(),
      startContainer: jest.fn(),
      stopContainer: jest.fn(),
      removeContainer: jest.fn(),
      getContainerStats: jest.fn(),
    }));

    mockMetricsCollector = jest.fn().mockImplementation(() => ({
      recordMetric: jest.fn(),
      getMetrics: jest.fn(),
    }));

    mockSecurityValidator = jest.fn().mockImplementation(() => ({
      validateConfig: jest.fn(),
      validateDeployment: jest.fn(),
    }));

    // Initialize test container
    testContainer = await new GenericContainer('node:20-alpine')
      .withExposedPorts(3000)
      .start();

    // Initialize service
    generatorService = new GeneratorService(
      mockRepository,
      mockDockerService(),
      mockMetricsCollector(),
      mockSecurityValidator()
    );
  });

  afterAll(async () => {
    await testContainer.stop();
  });

  describe('Agent Generation', () => {
    const validAgentRequirements = {
      name: 'TestAgent',
      description: 'Test agent for unit tests',
      type: AgentType.INTEGRATION,
      capabilities: {
        integration: {
          type: 'zoho',
          endpoints: ['contacts', 'leads']
        }
      },
      integrations: [{
        name: 'zoho',
        params: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret'
        },
        returnType: 'Promise<ZohoResponse>'
      }]
    };

    it('should successfully generate a new agent', async () => {
      const startTime = now();
      mockRepository.save.mockResolvedValueOnce({
        id: testAgentId,
        ...validAgentRequirements,
        status: AgentStatus.INACTIVE
      } as Agent);

      const result = await generatorService.generateAgent(
        validAgentRequirements,
        testCreatorId
      );

      const executionTime = now() - startTime;
      
      expect(result).toBeDefined();
      expect(result.id).toBe(testAgentId);
      expect(result.status).toBe(AgentStatus.INACTIVE);
      expect(executionTime).toBeLessThan(5000); // 5 second SLA
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should validate security requirements during generation', async () => {
      const insecureRequirements = {
        ...validAgentRequirements,
        capabilities: {
          integration: {
            type: 'unsupported-service',
            endpoints: ['unsafe-endpoint']
          }
        }
      };

      await expect(
        generatorService.generateAgent(insecureRequirements, testCreatorId)
      ).rejects.toThrow('Unsupported integration type');
    });

    it('should maintain error rate below 0.1%', async () => {
      const totalAttempts = 1000;
      let errorCount = 0;

      for (let i = 0; i < totalAttempts; i++) {
        try {
          await generatorService.generateAgent(validAgentRequirements, testCreatorId);
        } catch (error) {
          errorCount++;
        }
      }

      const errorRate = (errorCount / totalAttempts) * 100;
      expect(errorRate).toBeLessThan(0.1);
    });
  });

  describe('Agent Deployment', () => {
    beforeEach(() => {
      mockRepository.findOneOrFail.mockResolvedValue({
        id: testAgentId,
        status: AgentStatus.INACTIVE
      } as Agent);
    });

    it('should successfully deploy an agent', async () => {
      const startTime = now();
      
      const result = await generatorService.deployAgent(testAgentId);
      const deploymentTime = now() - startTime;

      expect(result.status).toBe(AgentStatus.ACTIVE);
      expect(deploymentTime).toBeLessThan(300000); // 5 minute SLA
      expect(mockDockerService().createContainer).toHaveBeenCalled();
      expect(mockDockerService().startContainer).toHaveBeenCalled();
    });

    it('should validate container health after deployment', async () => {
      mockDockerService().getContainerStats.mockResolvedValue({
        cpu_usage: 5,
        memory_usage: 100000000,
        network_rx_bytes: 1024,
        network_tx_bytes: 1024
      });

      const result = await generatorService.validateAgentHealth(testAgentId);

      expect(result.health.status).toBe('healthy');
      expect(result.resources.cpu).toBeLessThan(80);
      expect(result.resources.memory).toBeLessThan(80);
    });

    it('should handle deployment failures gracefully', async () => {
      mockDockerService().startContainer.mockRejectedValue(
        new Error('Container startup failed')
      );

      await expect(
        generatorService.deployAgent(testAgentId)
      ).rejects.toThrow('Container startup failed');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testAgentId,
          status: AgentStatus.ERROR
        })
      );
    });
  });

  describe('Performance Validation', () => {
    it('should measure and record performance metrics', async () => {
      const metrics = await generatorService.measurePerformance(testAgentId);

      expect(metrics).toBeDefined();
      expect(metrics.responseTime).toBeLessThan(200); // 200ms SLA
      expect(metrics.resourceUtilization.cpu).toBeLessThan(80);
      expect(metrics.resourceUtilization.memory).toBeLessThan(80);
      expect(mockMetricsCollector().recordMetric).toHaveBeenCalled();
    });

    it('should maintain performance SLAs under load', async () => {
      const concurrentRequests = 100;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        generatorService.generateAgent(
          {
            name: 'LoadTestAgent',
            type: AgentType.TASK,
            capabilities: {}
          },
          testCreatorId
        )
      );

      const startTime = now();
      await Promise.all(requests);
      const totalTime = now() - startTime;

      const averageResponseTime = totalTime / concurrentRequests;
      expect(averageResponseTime).toBeLessThan(5000); // 5 second SLA
    });
  });

  describe('Security Compliance', () => {
    it('should enforce security configurations', async () => {
      const insecureAgent = {
        name: 'InsecureAgent',
        type: AgentType.INTEGRATION,
        capabilities: {
          unsafeOperation: true
        }
      };

      await expect(
        generatorService.generateAgent(insecureAgent, testCreatorId)
      ).rejects.toThrow();
      
      expect(mockSecurityValidator().validateConfig).toHaveBeenCalled();
    });

    it('should validate deployment security requirements', async () => {
      mockSecurityValidator().validateDeployment.mockRejectedValue(
        new Error('Invalid security configuration')
      );

      await expect(
        generatorService.deployAgent(testAgentId)
      ).rejects.toThrow('Invalid security configuration');
    });

    it('should maintain secure configurations during updates', async () => {
      const updateRequest = {
        capabilities: {
          integration: {
            credentials: 'unsafe-plain-text'
          }
        }
      };

      await expect(
        generatorService.updateAgent(testAgentId, updateRequest)
      ).rejects.toThrow('Insecure configuration detected');
    });
  });
});