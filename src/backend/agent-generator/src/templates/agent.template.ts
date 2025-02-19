// External dependencies
import * as handlebars from 'handlebars'; // v4.7.8
import { trace, Tracer } from '@opentelemetry/api'; // v1.4.1
import { SecurityValidator } from '@types/security-validator'; // v1.0.0

// Internal imports
import { AgentType, AgentStatus, AgentErrorType } from '../models/Agent';

// Template version for compatibility tracking
export const TEMPLATE_VERSION = '1.0.0';

// Base agent template with security hooks
const BASE_AGENT_TEMPLATE = `
import { Agent, AgentType, AgentStatus, AgentErrorType } from '../models/Agent';
import { trace } from '@opentelemetry/api';
import { validateSecurityConfig } from '../security/validator';

export class {{className}} extends Agent {
  private readonly tracer = trace.getTracer('{{className}}');
  private readonly securityConfig: AgentSecurityConfig;

  constructor(config: Record<string, any>, securityConfig: AgentSecurityConfig) {
    super({
      name: '{{name}}',
      type: {{type}},
      status: AgentStatus.INACTIVE,
      config,
      capabilities: {{capabilities}}
    });

    this.securityConfig = validateSecurityConfig(securityConfig);
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    // Initialize performance monitoring
    this.performanceMetrics = {
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0
      },
      lastUpdated: new Date()
    };
  }

  {{integrationMethods}}

  public async start(): Promise<void> {
    const span = this.tracer.startSpan('agent.start');
    try {
      await this.validateConfiguration();
      this.status = AgentStatus.ACTIVE;
      span.end();
    } catch (error) {
      this.handleError(error as Error, AgentErrorType.CONFIGURATION);
      span.end();
      throw error;
    }
  }

  private async validateConfiguration(): Promise<void> {
    // Validate agent configuration
    if (!this.config || Object.keys(this.config).length === 0) {
      throw new Error('Invalid agent configuration');
    }

    // Validate security settings
    if (!this.securityConfig) {
      throw new Error('Missing security configuration');
    }
  }

  private handleError(error: Error, type: AgentErrorType): void {
    this.status = AgentStatus.ERROR;
    this.runtimeState.lastError = {
      type,
      message: error.message,
      stack: error.stack,
      timestamp: new Date()
    };
    this.errorCount++;
  }
}`;

// Integration method template with security validation
const INTEGRATION_METHOD_TEMPLATE = `
  public async {{methodName}}(params: {{paramsType}}): Promise<{{returnType}}> {
    const span = this.tracer.startSpan('{{methodName}}');
    try {
      // Validate input parameters
      this.validateParams(params);

      // Security checks
      await this.securityConfig.validateRequest(params);

      // Execute integration logic
      const result = await this.executeIntegration('{{methodName}}', params);

      // Update performance metrics
      this.updateMetrics(span);

      span.end();
      return result;
    } catch (error) {
      this.handleError(error as Error, AgentErrorType.INTEGRATION);
      span.end();
      throw error;
    }
  }
`;

// Security validation rules
const SECURITY_CHECKS = {
  requiredFields: ['authentication', 'authorization', 'encryption'],
  allowedIntegrations: ['zoho', 'rms'],
  minimumKeyLength: 32,
  requiredEncryption: 'AES-256-GCM'
};

export class AgentTemplate {
  private readonly templates: Map<string, HandlebarsTemplateDelegate>;
  private readonly securityValidator: SecurityValidator;
  private readonly tracer: Tracer;

  constructor(securityValidator: SecurityValidator, tracer: Tracer) {
    this.templates = new Map();
    this.securityValidator = securityValidator;
    this.tracer = tracer;

    // Initialize Handlebars with security settings
    this.initializeHandlebars();
  }

  private initializeHandlebars(): void {
    // Register security helpers
    handlebars.registerHelper('validateSecurity', (config: any) => {
      return this.securityValidator.validate(config, SECURITY_CHECKS);
    });

    // Compile base templates
    this.templates.set('baseAgent', handlebars.compile(BASE_AGENT_TEMPLATE));
    this.templates.set('integrationMethod', handlebars.compile(INTEGRATION_METHOD_TEMPLATE));
  }

  public generateAgentClass(
    agentConfig: {
      className: string;
      name: string;
      type: AgentType;
      capabilities: Record<string, any>;
    },
    securityConfig: Record<string, any>
  ): string {
    const span = this.tracer.startSpan('generateAgentClass');
    try {
      // Validate security configuration
      this.securityValidator.validate(securityConfig, SECURITY_CHECKS);

      // Generate agent class code
      const template = this.templates.get('baseAgent');
      if (!template) {
        throw new Error('Base agent template not found');
      }

      const code = template({
        ...agentConfig,
        type: `AgentType.${agentConfig.type}`,
        capabilities: JSON.stringify(agentConfig.capabilities, null, 2)
      });

      span.end();
      return code;
    } catch (error) {
      span.end();
      throw error;
    }
  }

  public generateIntegrationMethods(
    integrations: Array<{
      name: string;
      params: Record<string, any>;
      returnType: string;
    }>,
    securityConfig: Record<string, any>
  ): string {
    const span = this.tracer.startSpan('generateIntegrationMethods');
    try {
      // Validate integrations against security rules
      integrations.forEach(integration => {
        if (!SECURITY_CHECKS.allowedIntegrations.includes(integration.name)) {
          throw new Error(`Unsupported integration: ${integration.name}`);
        }
      });

      // Generate integration methods
      const template = this.templates.get('integrationMethod');
      if (!template) {
        throw new Error('Integration method template not found');
      }

      const methods = integrations.map(integration => 
        template({
          methodName: integration.name,
          paramsType: JSON.stringify(integration.params),
          returnType: integration.returnType
        })
      ).join('\n');

      span.end();
      return methods;
    } catch (error) {
      span.end();
      throw error;
    }
  }

  public generateRuntimeConfig(
    agentConfig: Record<string, any>,
    runtimeOptions: Record<string, any>,
    securityOptions: Record<string, any>
  ): string {
    const span = this.tracer.startSpan('generateRuntimeConfig');
    try {
      // Validate security options
      this.securityValidator.validate(securityOptions, SECURITY_CHECKS);

      // Generate runtime configuration
      const config = {
        version: TEMPLATE_VERSION,
        agent: agentConfig,
        runtime: runtimeOptions,
        security: securityOptions,
        monitoring: {
          enabled: true,
          interval: 60000,
          metrics: ['cpu', 'memory', 'responseTime', 'errorRate']
        }
      };

      span.end();
      return JSON.stringify(config, null, 2);
    } catch (error) {
      span.end();
      throw error;
    }
  }
}

export { TEMPLATE_VERSION };