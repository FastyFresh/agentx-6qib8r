/**
 * @packageDocumentation
 * TypeScript type definitions for AI agent-related data structures
 * Provides type safety for agent management and configuration
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { ApiResponse } from './api.types';
import { Integration } from './integration.types';

/**
 * Enumeration of possible agent statuses
 */
export enum AgentStatus {
  DRAFT = 'DRAFT',
  DEPLOYING = 'DEPLOYING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}

/**
 * Schedule configuration for agent execution
 */
export interface AgentSchedule {
  type: 'realtime' | 'scheduled';
  interval?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  timezone?: string;
  startDate?: Date;
  endDate?: Date | null;
}

/**
 * Agent permission configuration
 */
export interface AgentPermissions {
  readCustomerData: boolean;
  writeCustomerData: boolean;
  accessReports: boolean;
  executeActions: boolean;
  manageIntegrations: boolean;
}

/**
 * Container resource requirements for agent deployment
 */
export interface AgentResources {
  cpu: number; // CPU units (1 = 1 vCPU)
  memory: number; // Memory in MB
  storage?: number; // Storage in MB (optional)
  gpu?: boolean; // GPU requirement flag
}

/**
 * Comprehensive agent configuration interface
 */
export interface AgentConfig {
  naturalLanguageInput: string;
  schedule: AgentSchedule;
  permissions: AgentPermissions;
  resources: AgentResources;
  version?: number;
  environment?: 'production' | 'staging' | 'development';
  timeout?: number; // Operation timeout in milliseconds
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * Core agent interface representing an AI agent instance
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  config: AgentConfig;
  integrationIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastDeployedAt: Date | null;
  errorMessage: string | null;
  metrics?: {
    successRate: number;
    avgResponseTime: number;
    lastExecutionTime: Date | null;
  };
}

/**
 * Interface for creating a new agent
 */
export interface CreateAgentRequest {
  name: string;
  description: string;
  config: AgentConfig;
  integrationIds?: string[];
}

/**
 * Interface for updating an existing agent
 */
export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  config?: Partial<AgentConfig>;
  status?: AgentStatus;
  integrationIds?: string[];
}

/**
 * Zod schema for runtime validation of agent configuration
 */
export const agentConfigSchema = z.object({
  naturalLanguageInput: z.string().min(10),
  schedule: z.object({
    type: z.enum(['realtime', 'scheduled']),
    interval: z.object({
      value: z.number().positive(),
      unit: z.enum(['minutes', 'hours', 'days'])
    }).optional(),
    timezone: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().nullable().optional()
  }),
  permissions: z.object({
    readCustomerData: z.boolean(),
    writeCustomerData: z.boolean(),
    accessReports: z.boolean(),
    executeActions: z.boolean(),
    manageIntegrations: z.boolean()
  }),
  resources: z.object({
    cpu: z.number().min(0.1).max(8),
    memory: z.number().min(128).max(16384),
    storage: z.number().optional(),
    gpu: z.boolean().optional()
  })
});

/**
 * Type for agent API responses
 */
export type AgentResponse = ApiResponse<Agent>;
export type AgentListResponse = ApiResponse<Agent[]>;

/**
 * Type guard to check if an agent is in an error state
 */
export const isAgentError = (agent: Agent): boolean => {
  return agent.status === AgentStatus.ERROR && agent.errorMessage !== null;
};

/**
 * Type guard to check if an agent is deployable
 */
export const isAgentDeployable = (agent: Agent): boolean => {
  return (
    agent.status === AgentStatus.DRAFT &&
    agent.integrationIds.length > 0 &&
    !!agent.config.naturalLanguageInput
  );
};