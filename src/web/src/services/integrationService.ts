/**
 * Integration Service
 * Handles all integration-related operations with external services including
 * Zoho CRM and Restaurant Management Systems with enhanced security and monitoring
 * @version 1.0.0
 */

import { httpClient } from '../services/httpClient';
import { INTEGRATION_ENDPOINTS } from '../constants/apiEndpoints';
import {
  Integration,
  IntegrationConfig,
  IntegrationStatus,
  IntegrationServiceType,
  isZohoCRMConfig,
  isRMSConfig
} from '../types/integration.types';
import { ApiResponse, ResponseStatus } from '../types/api.types';

// Logger configuration for integration service
const LOGGER_CONFIG = {
  service: 'IntegrationService',
  version: '1.0.0'
};

// Performance thresholds in milliseconds
const PERFORMANCE_THRESHOLDS = {
  WARNING: 150,
  CRITICAL: 200
};

class IntegrationService {
  private readonly cache: Map<string, Integration> = new Map();
  private readonly performanceMetrics: Map<string, number[]> = new Map();

  /**
   * Retrieves all integrations for the current user with caching
   * @returns Promise resolving to array of integrations
   */
  public async getIntegrations(): Promise<Integration[]> {
    try {
      const startTime = performance.now();
      const response = await httpClient.get<Integration[]>(INTEGRATION_ENDPOINTS.BASE);
      
      this.trackPerformance('getIntegrations', startTime);

      if (response.status === ResponseStatus.SUCCESS) {
        // Update cache with fresh data
        response.data.forEach(integration => {
          this.cache.set(integration.id, integration);
        });
        return response.data;
      }
      
      throw new Error('Failed to fetch integrations');
    } catch (error) {
      console.error('IntegrationService.getIntegrations error:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific integration by ID with caching
   * @param id - Integration identifier
   * @returns Promise resolving to integration details
   */
  public async getIntegrationById(id: string): Promise<Integration> {
    try {
      // Check cache first
      const cached = this.cache.get(id);
      if (cached) {
        return cached;
      }

      const startTime = performance.now();
      const endpoint = INTEGRATION_ENDPOINTS.GET_BY_ID.replace(':id', id);
      const response = await httpClient.get<Integration>(endpoint);
      
      this.trackPerformance('getIntegrationById', startTime);

      if (response.status === ResponseStatus.SUCCESS) {
        this.cache.set(id, response.data);
        return response.data;
      }

      throw new Error(`Integration not found: ${id}`);
    } catch (error) {
      console.error(`IntegrationService.getIntegrationById error for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new integration with validation
   * @param data - Integration configuration data
   * @returns Promise resolving to created integration
   */
  public async createIntegration(data: Partial<Integration>): Promise<Integration> {
    try {
      this.validateIntegrationData(data);
      
      const startTime = performance.now();
      const response = await httpClient.post<Integration>(
        INTEGRATION_ENDPOINTS.CREATE,
        data
      );
      
      this.trackPerformance('createIntegration', startTime);

      if (response.status === ResponseStatus.SUCCESS) {
        this.cache.set(response.data.id, response.data);
        return response.data;
      }

      throw new Error('Failed to create integration');
    } catch (error) {
      console.error('IntegrationService.createIntegration error:', error);
      throw error;
    }
  }

  /**
   * Updates an existing integration
   * @param id - Integration identifier
   * @param data - Updated integration data
   * @returns Promise resolving to updated integration
   */
  public async updateIntegration(
    id: string,
    data: Partial<Integration>
  ): Promise<Integration> {
    try {
      this.validateIntegrationData(data);
      
      const startTime = performance.now();
      const endpoint = INTEGRATION_ENDPOINTS.UPDATE.replace(':id', id);
      const response = await httpClient.put<Integration>(endpoint, data);
      
      this.trackPerformance('updateIntegration', startTime);

      if (response.status === ResponseStatus.SUCCESS) {
        this.cache.set(id, response.data);
        return response.data;
      }

      throw new Error(`Failed to update integration: ${id}`);
    } catch (error) {
      console.error(`IntegrationService.updateIntegration error for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Deletes an integration and cleans up resources
   * @param id - Integration identifier
   */
  public async deleteIntegration(id: string): Promise<void> {
    try {
      const startTime = performance.now();
      const endpoint = INTEGRATION_ENDPOINTS.DELETE.replace(':id', id);
      const response = await httpClient.delete<void>(endpoint);
      
      this.trackPerformance('deleteIntegration', startTime);

      if (response.status === ResponseStatus.SUCCESS) {
        this.cache.delete(id);
        return;
      }

      throw new Error(`Failed to delete integration: ${id}`);
    } catch (error) {
      console.error(`IntegrationService.deleteIntegration error for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Verifies integration connection and credentials
   * @param id - Integration identifier
   * @returns Promise resolving to health status
   */
  public async verifyIntegration(id: string): Promise<ApiResponse<boolean>> {
    try {
      const startTime = performance.now();
      const endpoint = INTEGRATION_ENDPOINTS.VERIFY.replace(':id', id);
      const response = await httpClient.get<boolean>(endpoint);
      
      this.trackPerformance('verifyIntegration', startTime);

      return response;
    } catch (error) {
      console.error(`IntegrationService.verifyIntegration error for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Validates integration configuration data
   * @param data - Integration data to validate
   * @throws Error if validation fails
   */
  private validateIntegrationData(data: Partial<Integration>): void {
    if (!data.serviceType || !Object.values(IntegrationServiceType).includes(data.serviceType)) {
      throw new Error('Invalid integration service type');
    }

    if (data.config) {
      if (data.serviceType === IntegrationServiceType.ZOHO_CRM && !isZohoCRMConfig(data.config)) {
        throw new Error('Invalid Zoho CRM configuration');
      }
      if (data.serviceType === IntegrationServiceType.RMS && !isRMSConfig(data.config)) {
        throw new Error('Invalid RMS configuration');
      }
    }
  }

  /**
   * Tracks operation performance metrics
   * @param operation - Name of the operation
   * @param startTime - Operation start timestamp
   */
  private trackPerformance(operation: string, startTime: number): void {
    const duration = performance.now() - startTime;
    
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    if (duration > PERFORMANCE_THRESHOLDS.CRITICAL) {
      console.warn(`Critical performance in ${operation}: ${duration}ms`);
    } else if (duration > PERFORMANCE_THRESHOLDS.WARNING) {
      console.info(`Slow operation in ${operation}: ${duration}ms`);
    }
  }
}

// Export singleton instance
export const integrationService = new IntegrationService();