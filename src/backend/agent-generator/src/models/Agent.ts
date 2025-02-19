// External dependencies
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index 
} from 'typeorm'; // v0.3.17
import { 
  IsNotEmpty, 
  IsEnum, 
  IsObject, 
  ValidateNested, 
  Length 
} from 'class-validator'; // v0.14.0

// Internal imports
import { integrations, performanceThresholds } from '../config/config';

// Agent status enum definition
export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  DEPLOYING = 'deploying',
  MAINTENANCE = 'maintenance'
}

// Agent type enum definition
export enum AgentType {
  TASK = 'task',
  INTEGRATION = 'integration',
  SCHEDULED = 'scheduled',
  COMPOSITE = 'composite'
}

// Agent error type enum definition
export enum AgentErrorType {
  CONFIGURATION = 'configuration',
  RUNTIME = 'runtime',
  INTEGRATION = 'integration',
  PERFORMANCE = 'performance'
}

@Entity('agents')
@Index(['creatorId', 'status'])
@Index(['type', 'status'])
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty()
  creatorId: string;

  @Column()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @Column()
  @Length(0, 500)
  description: string;

  @Column({ type: 'enum', enum: AgentType })
  @IsEnum(AgentType)
  type: AgentType;

  @Column({ type: 'enum', enum: AgentStatus })
  @IsEnum(AgentStatus)
  status: AgentStatus;

  @Column('jsonb')
  @IsObject()
  @ValidateNested()
  config: Record<string, any>;

  @Column('jsonb')
  @IsObject()
  @ValidateNested()
  capabilities: Record<string, any>;

  @Column('jsonb')
  runtimeState: {
    health: {
      status: string;
      lastCheck: Date;
      errors: Array<{
        type: AgentErrorType;
        message: string;
        timestamp: Date;
      }>;
    };
    resources: {
      cpu: number;
      memory: number;
      connections: number;
    };
    lastError?: {
      type: AgentErrorType;
      message: string;
      stack?: string;
      timestamp: Date;
    };
  };

  @Column('jsonb')
  performanceMetrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    resourceUtilization: {
      cpu: number;
      memory: number;
    };
    lastUpdated: Date;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastExecutionAt: Date;

  @Column({ default: 0 })
  executionCount: number;

  @Column({ default: 0 })
  errorCount: number;

  constructor(data?: Partial<Agent>) {
    if (data) {
      Object.assign(this, data);
    }

    // Initialize default values
    this.id = this.id || uuidv4();
    this.status = this.status || AgentStatus.INACTIVE;
    this.config = this.config || {};
    this.capabilities = this.capabilities || {};
    
    // Initialize runtime state
    this.runtimeState = this.runtimeState || {
      health: {
        status: 'initializing',
        lastCheck: new Date(),
        errors: []
      },
      resources: {
        cpu: 0,
        memory: 0,
        connections: 0
      }
    };

    // Initialize performance metrics
    this.performanceMetrics = this.performanceMetrics || {
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0
      },
      lastUpdated: new Date()
    };

    // Validate integration configuration if applicable
    if (this.type === AgentType.INTEGRATION) {
      this.validateIntegrationConfig();
    }
  }

  private validateIntegrationConfig(): void {
    if (!this.config.integration || !this.config.integration.type) {
      throw new Error('Integration configuration is required for integration agents');
    }

    const integrationType = this.config.integration.type;
    if (!integrations[integrationType]) {
      throw new Error(`Unsupported integration type: ${integrationType}`);
    }
  }

  public isActive(): boolean {
    if (this.status !== AgentStatus.ACTIVE) {
      return false;
    }

    // Check performance thresholds
    const { cpu, memory } = this.performanceMetrics.resourceUtilization;
    if (cpu > performanceThresholds.cpu || memory > performanceThresholds.memory) {
      return false;
    }

    // Check health status
    return this.runtimeState.health.status === 'healthy';
  }

  public hasError(errorType?: AgentErrorType): boolean {
    if (this.status === AgentStatus.ERROR) {
      if (!errorType) {
        return true;
      }
      return this.runtimeState.lastError?.type === errorType;
    }
    return false;
  }

  public async updateRuntimeState(newState: Partial<typeof this.runtimeState>): Promise<void> {
    // Merge new state with existing state
    this.runtimeState = {
      ...this.runtimeState,
      ...newState,
      health: {
        ...this.runtimeState.health,
        ...newState.health,
        lastCheck: new Date()
      }
    };

    // Update performance metrics
    this.performanceMetrics = {
      ...this.performanceMetrics,
      resourceUtilization: {
        cpu: this.runtimeState.resources.cpu,
        memory: this.runtimeState.resources.memory
      },
      lastUpdated: new Date()
    };

    // Update execution metrics
    this.lastExecutionAt = new Date();
    this.executionCount++;

    // Check for errors and update status
    if (this.runtimeState.lastError) {
      this.status = AgentStatus.ERROR;
      this.errorCount++;
    }

    // Validate against performance thresholds
    if (this.runtimeState.resources.cpu > performanceThresholds.cpu ||
        this.runtimeState.resources.memory > performanceThresholds.memory) {
      this.status = AgentStatus.MAINTENANCE;
    }
  }
}