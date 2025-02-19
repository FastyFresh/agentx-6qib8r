/**
 * @packageDocumentation
 * Type definitions for the integrations Redux store slice
 * @version 1.0.0
 */

import { PayloadAction } from '@reduxjs/toolkit';
import { Integration, IntegrationStatus, IntegrationError } from '../../types/integration.types';

/**
 * Redux state interface for the integrations slice
 */
export interface IntegrationsState {
  /** Map of integration objects indexed by ID */
  readonly items: Readonly<Record<string, Integration>>;
  
  /** Loading state indicator */
  loading: boolean;
  
  /** Error message if present */
  error: string | null;
  
  /** Currently selected integration ID */
  selectedIntegrationId: string | null;
  
  /** Map of last sync timestamps by integration ID */
  lastSync: Record<string, string>;
  
  /** State version for migration handling */
  version: string;
}

/**
 * Initial state for the integrations slice
 */
export const INITIAL_STATE: IntegrationsState = {
  items: {},
  loading: false,
  error: null,
  selectedIntegrationId: null,
  lastSync: {},
  version: '1.0.0'
};

/**
 * Payload type for fetching integrations
 */
export interface FetchIntegrationsPayload {
  /** Agent ID to fetch integrations for */
  agentId: string;
  
  /** Whether to include inactive integrations */
  includeInactive: boolean;
}

/**
 * Payload type for updating integration status
 */
export interface UpdateIntegrationStatusPayload {
  /** ID of the integration to update */
  integrationId: string;
  
  /** New status to set */
  status: IntegrationStatus;
  
  /** Error details if status is ERROR */
  errorDetails: IntegrationError | null;
}

/**
 * Payload type for setting the selected integration
 */
export interface SetSelectedIntegrationPayload {
  /** ID of the integration to select, or null to clear selection */
  integrationId: string | null;
}

/**
 * Type for integration creation action payload
 */
export interface CreateIntegrationPayload {
  /** Integration data for creation */
  integration: Omit<Integration, 'id' | 'createdAt' | 'updatedAt'>;
}

/**
 * Type for integration update action payload
 */
export interface UpdateIntegrationPayload {
  /** ID of the integration to update */
  integrationId: string;
  
  /** Updated integration data */
  updates: Partial<Omit<Integration, 'id' | 'createdAt' | 'updatedAt'>>;
}

/**
 * Type for integration deletion action payload
 */
export interface DeleteIntegrationPayload {
  /** ID of the integration to delete */
  integrationId: string;
}

/**
 * Type for integration sync action payload
 */
export interface SyncIntegrationPayload {
  /** ID of the integration to sync */
  integrationId: string;
  
  /** Timestamp of the sync */
  syncTime: string;
}

/**
 * Type for bulk integration update action payload
 */
export interface BulkUpdateIntegrationsPayload {
  /** Map of integration IDs to their updates */
  updates: Record<string, Partial<Omit<Integration, 'id' | 'createdAt' | 'updatedAt'>>>;
}

/**
 * Type for setting error state action payload
 */
export interface SetErrorPayload {
  /** Error message */
  error: string | null;
}

/**
 * Redux action types with typed payloads
 */
export type IntegrationsAction =
  | PayloadAction<FetchIntegrationsPayload>
  | PayloadAction<UpdateIntegrationStatusPayload>
  | PayloadAction<SetSelectedIntegrationPayload>
  | PayloadAction<CreateIntegrationPayload>
  | PayloadAction<UpdateIntegrationPayload>
  | PayloadAction<DeleteIntegrationPayload>
  | PayloadAction<SyncIntegrationPayload>
  | PayloadAction<BulkUpdateIntegrationsPayload>
  | PayloadAction<SetErrorPayload>;