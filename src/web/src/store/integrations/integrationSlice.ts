/**
 * Redux slice for managing external service integrations state
 * Handles Zoho CRM and Restaurant Management System integrations with enhanced monitoring
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { IntegrationsState, Integration, IntegrationError } from './types';
import { integrationService } from '../../services/integrationService';

// Initial state with version tracking and health monitoring
const initialState: IntegrationsState = {
  items: {},
  loading: false,
  error: null,
  selectedIntegrationId: null,
  version: 1,
  lastSync: {}
};

/**
 * Redux slice for integration state management
 */
const integrationsSlice = createSlice({
  name: 'integrations',
  initialState,
  reducers: {
    setIntegrations: (state, action: PayloadAction<Record<string, Integration>>) => {
      state.items = action.payload;
      state.version += 1;
    },

    addIntegration: (state, action: PayloadAction<Integration>) => {
      state.items[action.payload.id] = action.payload;
      state.version += 1;
    },

    updateIntegrationStatus: (
      state,
      action: PayloadAction<{ id: string; status: string; error?: IntegrationError }>
    ) => {
      const integration = state.items[action.payload.id];
      if (integration) {
        integration.status = action.payload.status;
        integration.lastError = action.payload.error || null;
        state.version += 1;
      }
    },

    updateHealthStatus: (
      state,
      action: PayloadAction<{ id: string; healthStatus: string }>
    ) => {
      const integration = state.items[action.payload.id];
      if (integration) {
        integration.healthStatus = action.payload.healthStatus;
        state.version += 1;
      }
    },

    removeIntegration: (state, action: PayloadAction<string>) => {
      delete state.items[action.payload];
      if (state.selectedIntegrationId === action.payload) {
        state.selectedIntegrationId = null;
      }
      delete state.lastSync[action.payload];
      state.version += 1;
    },

    setSelectedIntegration: (state, action: PayloadAction<string | null>) => {
      state.selectedIntegrationId = action.payload;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<IntegrationError | null>) => {
      state.error = action.payload;
    },

    updateVersion: (state) => {
      state.version += 1;
    },

    updateLastSync: (state, action: PayloadAction<{ id: string; timestamp: number }>) => {
      state.lastSync[action.payload.id] = action.payload.timestamp;
    }
  }
});

// Export actions for component usage
export const integrationActions = integrationsSlice.actions;

// Async thunk for fetching integrations with health checks
export const fetchIntegrations = (agentId: string) => async (dispatch: any) => {
  try {
    dispatch(integrationActions.setLoading(true));
    dispatch(integrationActions.setError(null));

    const integrations = await integrationService.getIntegrations();
    const integrationsMap: Record<string, Integration> = {};

    // Perform health checks and map integrations
    for (const integration of integrations) {
      const healthCheck = await integrationService.verifyIntegration(integration.id);
      integrationsMap[integration.id] = {
        ...integration,
        healthStatus: healthCheck.status === 'SUCCESS' ? 'healthy' : 'unhealthy'
      };
      
      // Update last sync timestamp
      dispatch(integrationActions.updateLastSync({
        id: integration.id,
        timestamp: Date.now()
      }));
    }

    dispatch(integrationActions.setIntegrations(integrationsMap));
  } catch (error) {
    dispatch(integrationActions.setError({
      code: 'FETCH_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch integrations',
      details: error
    }));
  } finally {
    dispatch(integrationActions.setLoading(false));
  }
};

// Selectors for accessing integration state
export const selectIntegrations = (state: { integrations: IntegrationsState }) => 
  Object.values(state.integrations.items);

export const selectIntegrationById = (state: { integrations: IntegrationsState }, id: string) => 
  state.integrations.items[id];

export const selectSelectedIntegration = (state: { integrations: IntegrationsState }) => 
  state.integrations.selectedIntegrationId ? 
  state.integrations.items[state.integrations.selectedIntegrationId] : 
  null;

export const selectIntegrationsLoading = (state: { integrations: IntegrationsState }) => 
  state.integrations.loading;

export const selectIntegrationsError = (state: { integrations: IntegrationsState }) => 
  state.integrations.error;

export const selectIntegrationHealth = (state: { integrations: IntegrationsState }, id: string) => 
  state.integrations.items[id]?.healthStatus;

export const selectIntegrationVersion = (state: { integrations: IntegrationsState }) => 
  state.integrations.version;

export const selectLastSync = (state: { integrations: IntegrationsState }, id: string) => 
  state.integrations.lastSync[id];

// Export reducer for store configuration
export default integrationsSlice.reducer;