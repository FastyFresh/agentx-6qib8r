/**
 * @packageDocumentation
 * Comprehensive validation schemas for AI agent lifecycle management
 * Implements type-safe validation using Zod with enhanced security and resource constraints
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { AgentStatus } from '../types/agent.types';
import { AGENT_ERRORS } from '../constants/errorMessages';

/**
 * Validates agent resource allocation values against system constraints
 * @param resources - Resource allocation object to validate
 * @returns boolean indicating if resource values are within acceptable ranges
 */
const validateAgentResources = (resources: { cpu: number; memory: number }): boolean => {
  // CPU must be between 0.1 and 4.0 cores with max 2 decimal places
  const validCpu = resources.cpu >= 0.1 && 
                   resources.cpu <= 4.0 && 
                   Number(resources.cpu.toFixed(2)) === resources.cpu;

  // Memory must be between 128MB and 4096MB in 128MB increments
  const validMemory = resources.memory >= 128 && 
                     resources.memory <= 4096 && 
                     resources.memory % 128 === 0;

  return validCpu && validMemory;
};

/**
 * Schema for validating agent resource allocation
 */
export const agentResourcesSchema = z.object({
  cpu: z.number()
    .min(0.1, { message: 'CPU must be at least 0.1 cores' })
    .max(4.0, { message: 'CPU cannot exceed 4.0 cores' })
    .refine(val => Number(val.toFixed(2)) === val, {
      message: 'CPU value must have maximum 2 decimal places'
    }),
  memory: z.number()
    .min(128, { message: 'Memory must be at least 128MB' })
    .max(4096, { message: 'Memory cannot exceed 4096MB' })
    .refine(val => val % 128 === 0, {
      message: 'Memory must be allocated in 128MB increments'
    })
}).refine(validateAgentResources, {
  message: AGENT_ERRORS.INVALID_RESOURCES
});

/**
 * Schema for validating agent security permissions
 */
export const agentPermissionsSchema = z.object({
  readCustomerData: z.boolean(),
  writeCustomerData: z.boolean(),
  accessReports: z.boolean(),
  executeActions: z.boolean()
}).refine(
  data => !(data.writeCustomerData && !data.readCustomerData), {
    message: AGENT_ERRORS.INVALID_PERMISSIONS,
    path: ['writeCustomerData']
  }
);

/**
 * Schema for validating agent execution schedule
 */
export const agentScheduleSchema = z.object({
  type: z.enum(['realtime', 'scheduled']),
  interval: z.number()
    .min(1)
    .max(1440)
    .optional(),
  timezone: z.string()
    .regex(/^[A-Za-z]+\/[A-Za-z_]+$/)
    .optional(),
  executionWindow: z.object({
    start: z.string()
      .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    end: z.string()
      .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
  }).optional()
}).refine(
  data => !(data.type === 'scheduled' && !data.interval), {
    message: 'Interval is required for scheduled agents',
    path: ['interval']
  }
);

/**
 * Schema for validating complete agent configuration
 */
export const agentConfigSchema = z.object({
  naturalLanguageInput: z.string()
    .min(10, { message: 'Description must be at least 10 characters' })
    .max(1000, { message: 'Description cannot exceed 1000 characters' }),
  schedule: agentScheduleSchema,
  permissions: agentPermissionsSchema,
  resources: agentResourcesSchema,
  integrations: z.array(z.string().uuid())
    .min(1, { message: 'At least one integration is required' })
});

/**
 * Schema for validating agent creation requests
 */
export const createAgentSchema = z.object({
  name: z.string()
    .min(3, { message: 'Name must be at least 3 characters' })
    .max(50, { message: 'Name cannot exceed 50 characters' })
    .regex(/^[a-zA-Z0-9-_\s]+$/, { 
      message: 'Name can only contain letters, numbers, spaces, hyphens and underscores' 
    }),
  description: z.string()
    .min(10, { message: 'Description must be at least 10 characters' })
    .max(200, { message: 'Description cannot exceed 200 characters' }),
  config: agentConfigSchema
});

/**
 * Schema for validating agent update requests
 */
export const updateAgentSchema = z.object({
  name: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9-_\s]+$/)
    .optional(),
  description: z.string()
    .min(10)
    .max(200)
    .optional(),
  config: agentConfigSchema.partial(),
  status: z.enum([
    AgentStatus.DRAFT,
    AgentStatus.DEPLOYING,
    AgentStatus.ACTIVE,
    AgentStatus.PAUSED,
    AgentStatus.ERROR
  ]).optional()
}).refine(
  data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  }
);