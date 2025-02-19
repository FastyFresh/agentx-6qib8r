// External dependencies
import { Injectable } from '@nestjs/common'; // v9.0.0
import { Repository } from 'typeorm'; // v0.3.17
import { Logger } from 'winston'; // v3.10.0
import { Compose } from 'docker-compose'; // v0.24.0
import { Registry, Counter, Histogram } from 'prom-client'; // v14.2.0
import { trace, Tracer, SpanStatusCode } from '@opentelemetry/api'; // v1.4.0

// Internal imports
import { Agent, AgentType, AgentStatus, AgentErrorType } from '../models/Agent';
import { AgentTemplate, TEMPLATE_VERSION } from '../templates/agent.template';
import { config } from '../config/config';

// Monitoring decorator for tracing
function Monitored() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('generator-service');
      const span = tracer.startSpan(`GeneratorService.${propertyKey}`);
      try {
        const result = await originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    };
    return descriptor;
  };
}

@Injectable()
export class GeneratorService {
  private readonly tracer: Tracer;
  private readonly metrics: {
    agentCreations: Counter;
    deploymentDuration: Histogram;
    failedDeployments: Counter;
    healthChecks: Counter;
  };

  constructor(
    private readonly agentRepository: Repository<Agent>,
    private readonly agentTemplate: AgentTemplate,
    private readonly logger: Logger,
    private readonly metricsRegistry: Registry,
    private readonly dockerCompose: Compose
  ) {
    this.tracer = trace.getTracer('generator-service');
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics = {
      agentCreations: new Counter({
        name: 'agent_creations_total',
        help: 'Total number of agent creation attempts',
        labelNames: ['status']
      }),
      deploymentDuration: new Histogram({
        name: 'agent_deployment_duration_seconds',
        help: 'Duration of agent deployments',
        buckets: [1, 5, 10, 30, 60, 120]
      }),
      failedDeployments: new Counter({
        name: 'agent_deployment_failures_total',
        help: 'Total number of failed deployments',
        labelNames: ['error_type']
      }),
      healthChecks: new Counter({
        name: 'agent_health_checks_total',
        help: 'Total number of agent health checks',
        labelNames: ['status']
      })
    };

    Object.values(this.metrics).forEach(metric => 
      this.metricsRegistry.registerMetric(metric)
    );
  }

  @Monitored()
  public async generateAgent(
    requirements: {
      name: string;
      description: string;
      type: AgentType;
      capabilities: Record<string, any>;
      integrations?: Array<{
        name: string;
        params: Record<string, any>;
        returnType: string;
      }>;
    },
    creatorId: string
  ): Promise<Agent> {
    const span = this.tracer.startSpan('generateAgent');
    try {
      this.metrics.agentCreations.inc({ status: 'started' });

      // Generate agent class code
      const agentCode = this.agentTemplate.generateAgentClass({
        className: `${requirements.name}Agent`,
        name: requirements.name,
        type: requirements.type,
        capabilities: requirements.capabilities
      }, {
        encryption: config.auth.jwtSecret,
        authentication: true,
        authorization: true
      });

      // Generate integration methods if needed
      let integrationMethods = '';
      if (requirements.integrations) {
        integrationMethods = this.agentTemplate.generateIntegrationMethods(
          requirements.integrations,
          { encryption: config.auth.jwtSecret }
        );
      }

      // Create agent runtime configuration
      const runtimeConfig = this.agentTemplate.generateRuntimeConfig(
        requirements,
        {
          version: TEMPLATE_VERSION,
          monitoring: config.monitoring,
          performance: config.monitoring.performanceThresholds
        },
        { encryption: config.auth.jwtSecret }
      );

      // Create and save agent entity
      const agent = new Agent({
        creatorId,
        name: requirements.name,
        description: requirements.description,
        type: requirements.type,
        status: AgentStatus.INACTIVE,
        config: JSON.parse(runtimeConfig),
        capabilities: requirements.capabilities
      });

      await this.agentRepository.save(agent);
      
      this.metrics.agentCreations.inc({ status: 'success' });
      this.logger.info(`Agent generated successfully: ${agent.id}`);
      
      span.setStatus({ code: SpanStatusCode.OK });
      return agent;
    } catch (error) {
      this.metrics.agentCreations.inc({ status: 'failed' });
      this.logger.error(`Agent generation failed: ${error.message}`, { error });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }

  @Monitored()
  public async deployAgent(agentId: string): Promise<Agent> {
    const deploymentTimer = this.metrics.deploymentDuration.startTimer();
    const span = this.tracer.startSpan('deployAgent');
    
    try {
      const agent = await this.agentRepository.findOneOrFail({ where: { id: agentId } });
      agent.status = AgentStatus.DEPLOYING;
      await this.agentRepository.save(agent);

      // Prepare container configuration
      const containerConfig = {
        version: '3.8',
        services: {
          [`agent-${agent.id}`]: {
            build: {
              context: '.',
              dockerfile: 'Dockerfile',
              args: {
                AGENT_ID: agent.id,
                AGENT_CONFIG: JSON.stringify(agent.config)
              }
            },
            environment: {
              NODE_ENV: config.server.nodeEnv,
              MONITORING_ENDPOINT: config.monitoring.prometheusEndpoint
            },
            healthcheck: {
              test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
              interval: '30s',
              timeout: '10s',
              retries: 3
            },
            restart: 'unless-stopped',
            logging: {
              driver: 'json-file',
              options: {
                'max-size': '10m',
                'max-file': '3'
              }
            }
          }
        }
      };

      // Deploy container
      await this.dockerCompose.upOne(`agent-${agent.id}`, {
        config: containerConfig,
        log: true
      });

      // Update agent status
      agent.status = AgentStatus.ACTIVE;
      agent.runtimeState.health.status = 'healthy';
      agent.runtimeState.health.lastCheck = new Date();
      
      await this.agentRepository.save(agent);

      const duration = deploymentTimer();
      this.logger.info(`Agent deployed successfully: ${agent.id}`, { duration });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return agent;
    } catch (error) {
      this.metrics.failedDeployments.inc({
        error_type: error.name || 'UnknownError'
      });
      
      this.logger.error(`Agent deployment failed: ${error.message}`, { error });
      
      // Attempt recovery
      await this.handleDeploymentFailure(agentId, error);
      
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }

  @Monitored()
  public async monitorAgentHealth(agentId: string): Promise<void> {
    const span = this.tracer.startSpan('monitorAgentHealth');
    
    try {
      const agent = await this.agentRepository.findOneOrFail({ where: { id: agentId } });
      this.metrics.healthChecks.inc({ status: 'started' });

      // Check container health
      const containerStatus = await this.dockerCompose.ps(`agent-${agent.id}`);
      const isHealthy = containerStatus[0]?.state === 'running';

      // Update agent health status
      agent.runtimeState.health.status = isHealthy ? 'healthy' : 'unhealthy';
      agent.runtimeState.health.lastCheck = new Date();

      // Check resource utilization
      const stats = await this.dockerCompose.stats(`agent-${agent.id}`, { no_stream: true });
      agent.runtimeState.resources = {
        cpu: parseFloat(stats[0]?.cpu_stats?.cpu_usage?.total_usage || '0'),
        memory: parseFloat(stats[0]?.memory_stats?.usage || '0'),
        connections: parseInt(stats[0]?.networks?.eth0?.rx_bytes || '0', 10)
      };

      // Check performance thresholds
      if (agent.runtimeState.resources.cpu > config.monitoring.performanceThresholds.cpu ||
          agent.runtimeState.resources.memory > config.monitoring.performanceThresholds.memory) {
        agent.status = AgentStatus.MAINTENANCE;
        this.logger.warn(`Agent ${agent.id} exceeded performance thresholds`);
      }

      await this.agentRepository.save(agent);
      this.metrics.healthChecks.inc({ status: 'completed' });
      
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      this.metrics.healthChecks.inc({ status: 'failed' });
      this.logger.error(`Health check failed for agent ${agentId}: ${error.message}`, { error });
      
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }

  @Monitored()
  private async handleDeploymentFailure(
    agentId: string,
    error: Error
  ): Promise<void> {
    const span = this.tracer.startSpan('handleDeploymentFailure');
    
    try {
      const agent = await this.agentRepository.findOneOrFail({ where: { id: agentId } });

      // Update agent error state
      agent.status = AgentStatus.ERROR;
      agent.runtimeState.lastError = {
        type: AgentErrorType.RUNTIME,
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      };
      agent.errorCount++;

      // Attempt cleanup
      await this.dockerCompose.down(`agent-${agent.id}`, {
        removeOrphans: true,
        volumes: true
      });

      await this.agentRepository.save(agent);
      
      this.logger.error(`Deployment failure handled for agent ${agentId}`, {
        error,
        recovery: 'cleanup_completed'
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      this.logger.error(`Failed to handle deployment failure for agent ${agentId}`, { error });
      
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }
}