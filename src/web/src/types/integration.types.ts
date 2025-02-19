/**
 * @packageDocumentation
 * Type definitions for external service integrations
 * @version 1.0.0
 */

// @types/uuid v9.0.2
import { v4 as uuid } from 'uuid';

/**
 * Supported integration service types
 */
export const IntegrationServiceType = {
  ZOHO_CRM: 'zoho_crm',
  RMS: 'rms'
} as const;

export type IntegrationServiceType = typeof IntegrationServiceType[keyof typeof IntegrationServiceType];

/**
 * Integration status enumeration
 */
export const IntegrationStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error'
} as const;

export type IntegrationStatus = typeof IntegrationStatus[keyof typeof IntegrationStatus];

/**
 * Core integration interface defining the base structure for all integrations
 */
export interface Integration {
  /** Unique identifier for the integration */
  id: string;
  
  /** Reference to the parent agent */
  agentId: string;
  
  /** Human-readable name of the integration */
  name: string;
  
  /** Type of external service */
  serviceType: IntegrationServiceType;
  
  /** Current integration status */
  status: IntegrationStatus;
  
  /** Integration-specific configuration */
  config: IntegrationConfig;
  
  /** Timestamp of last successful synchronization */
  lastSyncAt: Date | null;
  
  /** Latest error message if status is ERROR */
  errorMessage: string | null;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Configuration version for tracking changes */
  version: number;
}

/**
 * Base configuration interface for all integration types
 */
export interface IntegrationConfig {
  /** Service type identifier */
  type: IntegrationServiceType;
  
  /** API authentication key */
  apiKey: string;
  
  /** Base API endpoint URL */
  apiEndpoint: string;
  
  /** Additional service-specific settings */
  settings: Record<string, unknown>;
  
  /** Request timeout in milliseconds */
  timeout: number;
  
  /** Retry configuration for failed requests */
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}

/**
 * Zoho CRM specific configuration interface
 */
export interface ZohoCRMConfig extends Omit<IntegrationConfig, 'type'> {
  /** Fixed service type for Zoho CRM */
  type: typeof IntegrationServiceType.ZOHO_CRM;
  
  /** OAuth client identifier */
  clientId: string;
  
  /** OAuth client secret */
  clientSecret: string;
  
  /** OAuth refresh token */
  refreshToken: string;
  
  /** OAuth permission scopes */
  scope: string[];
  
  /** Target environment selection */
  environment: 'production' | 'sandbox';
}

/**
 * Restaurant Management System specific configuration interface
 */
export interface RMSConfig extends Omit<IntegrationConfig, 'type'> {
  /** Fixed service type for RMS */
  type: typeof IntegrationServiceType.RMS;
  
  /** API authentication key */
  apiKey: string;
  
  /** Store identifier */
  storeId: string;
  
  /** Location identifier */
  locationId: string;
  
  /** Webhook endpoint for real-time updates */
  webhookUrl: string;
  
  /** Feature flags for RMS capabilities */
  features: {
    orders: boolean;
    inventory: boolean;
    menu: boolean;
  };
}

/**
 * Type guard to check if config is ZohoCRMConfig
 */
export const isZohoCRMConfig = (config: IntegrationConfig): config is ZohoCRMConfig => {
  return config.type === IntegrationServiceType.ZOHO_CRM;
};

/**
 * Type guard to check if config is RMSConfig
 */
export const isRMSConfig = (config: IntegrationConfig): config is RMSConfig => {
  return config.type === IntegrationServiceType.RMS;
};

/**
 * Union type of all possible integration configurations
 */
export type IntegrationConfigType = ZohoCRMConfig | RMSConfig;