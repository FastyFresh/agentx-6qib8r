/**
 * Integration Validation Schemas
 * Provides Zod validation schemas for integration-related data structures with enhanced security measures
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { IntegrationServiceType } from '../types/integration.types';
import { validateUrl } from '../utils/validationUtils';
import { INTEGRATION_ERRORS } from '../constants/errorMessages';

/**
 * Base integration schema with common fields for all integration types
 */
export const baseIntegrationSchema = z.object({
  name: z.string()
    .min(1, { message: 'Name is required' })
    .max(100, { message: 'Name must be 100 characters or less' })
    .regex(/^[a-zA-Z0-9-_\s]+$/, { 
      message: 'Name can only contain letters, numbers, spaces, hyphens and underscores' 
    }),
  
  serviceType: z.enum([
    IntegrationServiceType.ZOHO_CRM,
    IntegrationServiceType.RMS
  ], {
    errorMap: () => ({ message: 'Invalid service type' })
  }),
  
  description: z.string()
    .max(500, { message: 'Description must be 500 characters or less' })
    .optional(),
  
  enabled: z.boolean().default(true)
});

/**
 * Zoho CRM specific configuration schema with enhanced security validation
 */
export const zohoCRMConfigSchema = z.object({
  clientId: z.string()
    .min(1, { message: 'Client ID is required' })
    .regex(/^[a-zA-Z0-9-_]+$/, {
      message: 'Client ID can only contain letters, numbers, hyphens and underscores'
    }),
  
  clientSecret: z.string()
    .min(1, { message: 'Client secret is required' })
    .transform(val => val.trim()),
  
  refreshToken: z.string().optional(),
  
  apiEndpoint: z.string()
    .refine(validateUrl, {
      message: 'Invalid API endpoint URL. Must be a secure HTTPS URL'
    }),
  
  environment: z.enum(['production', 'sandbox'], {
    errorMap: () => ({ message: 'Invalid environment. Must be production or sandbox' })
  }),
  
  scopes: z.array(z.string())
    .min(1, { message: 'At least one scope is required' })
    .refine(
      scopes => scopes.every(scope => /^[a-zA-Z0-9._]+$/.test(scope)),
      { message: 'Invalid scope format' }
    )
});

/**
 * RMS specific configuration schema with feature flags
 */
export const rmsConfigSchema = z.object({
  apiKey: z.string()
    .min(1, { message: 'API key is required' })
    .regex(/^[a-zA-Z0-9-_]+$/, {
      message: 'API key can only contain letters, numbers, hyphens and underscores'
    }),
  
  storeId: z.string()
    .min(1, { message: 'Store ID is required' })
    .regex(/^[0-9]+$/, {
      message: 'Store ID must be numeric'
    }),
  
  locationId: z.string()
    .min(1, { message: 'Location ID is required' })
    .regex(/^[0-9]+$/, {
      message: 'Location ID must be numeric'
    }),
  
  apiEndpoint: z.string()
    .refine(validateUrl, {
      message: 'Invalid API endpoint URL. Must be a secure HTTPS URL'
    }),
  
  features: z.object({
    orderSync: z.boolean(),
    inventorySync: z.boolean()
  }).refine(
    data => data.orderSync || data.inventorySync,
    { message: 'At least one feature must be enabled' }
  ),
  
  webhookUrl: z.string()
    .refine(validateUrl, {
      message: 'Invalid webhook URL. Must be a secure HTTPS URL'
    })
    .optional()
});

/**
 * Combined schema for creating new integrations with strict validation
 */
export const createIntegrationSchema = z.object({
  ...baseIntegrationSchema.shape,
  config: z.union([
    zohoCRMConfigSchema,
    rmsConfigSchema
  ]).refine(
    (config): boolean => {
      try {
        if ('clientId' in config) {
          return zohoCRMConfigSchema.safeParse(config).success;
        } else if ('storeId' in config) {
          return rmsConfigSchema.safeParse(config).success;
        }
        return false;
      } catch {
        return false;
      }
    },
    { message: INTEGRATION_ERRORS.INVALID_CONFIGURATION }
  )
});

/**
 * Combined schema for updating existing integrations with partial validation
 */
export const updateIntegrationSchema = z.object({
  ...baseIntegrationSchema.partial().shape,
  config: z.union([
    zohoCRMConfigSchema.partial(),
    rmsConfigSchema.partial()
  ]).refine(
    (config): boolean => {
      try {
        if ('clientId' in config) {
          return zohoCRMConfigSchema.partial().safeParse(config).success;
        } else if ('storeId' in config) {
          return rmsConfigSchema.partial().safeParse(config).success;
        }
        return false;
      } catch {
        return false;
      }
    },
    { message: INTEGRATION_ERRORS.INVALID_CONFIGURATION }
  )
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);