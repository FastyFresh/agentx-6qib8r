import React, { useEffect, useState, useCallback } from 'react'; // ^18.2.0
import { useForm } from 'react-hook-form'; // ^7.45.0
import { zodResolver } from '@hookform/resolvers/zod'; // ^3.2.0
import { useDebounce } from 'use-debounce'; // ^9.0.0

import FormField from '../common/FormField';
import { useIntegration } from '../../hooks/useIntegration';
import { Integration, IntegrationServiceType } from '../../types/integration.types';
import { createIntegrationSchema } from '../../validation/integrationSchema';
import { INTEGRATION_ERRORS } from '../../constants/errorMessages';

interface IntegrationFormProps {
  initialData?: Integration;
  onSubmit: (data: Integration) => Promise<void>;
  onCancel: () => void;
  isSecure?: boolean;
  healthCheckConfig?: {
    interval: number;
    enabled: boolean;
  };
}

const IntegrationForm: React.FC<IntegrationFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSecure = true,
  healthCheckConfig = { interval: 30000, enabled: true }
}) => {
  // Form state management with enhanced validation
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setValue,
    reset
  } = useForm({
    resolver: zodResolver(createIntegrationSchema),
    defaultValues: initialData || {
      name: '',
      serviceType: IntegrationServiceType.ZOHO_CRM,
      config: {
        apiEndpoint: '',
        apiKey: ''
      }
    }
  });

  // Integration service hooks
  const {
    createIntegration,
    updateIntegration,
    monitorHealth,
    trackPerformance
  } = useIntegration();

  // Local state for health monitoring
  const [healthStatus, setHealthStatus] = useState<string>('unknown');
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

  // Watch for service type changes
  const serviceType = watch('serviceType');
  const [debouncedServiceType] = useDebounce(serviceType, 300);

  // Health monitoring setup
  useEffect(() => {
    let healthCheckInterval: NodeJS.Timeout;

    if (healthCheckConfig.enabled && initialData?.id) {
      const checkHealth = async () => {
        try {
          const status = await monitorHealth(initialData.id);
          setHealthStatus(status.status);
          setLastHealthCheck(new Date());
        } catch (error) {
          setHealthStatus('error');
          console.error('Health check failed:', error);
        }
      };

      // Initial health check
      checkHealth();

      // Set up interval for continuous monitoring
      healthCheckInterval = setInterval(checkHealth, healthCheckConfig.interval);
    }

    return () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
    };
  }, [initialData?.id, healthCheckConfig.enabled, healthCheckConfig.interval]);

  // Handle service type changes
  useEffect(() => {
    if (debouncedServiceType) {
      // Reset config fields based on service type
      setValue('config', {
        apiEndpoint: '',
        apiKey: '',
        ...(debouncedServiceType === IntegrationServiceType.ZOHO_CRM
          ? {
              clientId: '',
              clientSecret: '',
              environment: 'production'
            }
          : {
              storeId: '',
              locationId: '',
              features: {
                orderSync: true,
                inventorySync: false
              }
            })
      });
    }
  }, [debouncedServiceType, setValue]);

  // Enhanced form submission handler
  const onFormSubmit = async (data: any) => {
    try {
      const startTime = performance.now();

      // Create or update integration
      const result = await (initialData
        ? updateIntegration(initialData.id, data)
        : createIntegration(data));

      // Track performance
      trackPerformance('formSubmission', startTime);

      // Invoke success callback
      await onSubmit(result);
    } catch (error) {
      console.error('Integration form submission failed:', error);
      throw new Error(INTEGRATION_ERRORS.INVALID_CONFIGURATION);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="integration-form">
      {/* Basic Information */}
      <div className="form-section">
        <FormField
          label="Integration Name"
          error={errors.name?.message}
          required
        >
          <input
            type="text"
            {...register('name')}
            className="form-input"
            data-testid="integration-name-input"
          />
        </FormField>

        <FormField
          label="Service Type"
          error={errors.serviceType?.message}
          required
        >
          <select
            {...register('serviceType')}
            className="form-select"
            data-testid="service-type-select"
          >
            <option value={IntegrationServiceType.ZOHO_CRM}>Zoho CRM</option>
            <option value={IntegrationServiceType.RMS}>
              Restaurant Management System
            </option>
          </select>
        </FormField>
      </div>

      {/* Service-specific Configuration */}
      <div className="form-section">
        {serviceType === IntegrationServiceType.ZOHO_CRM ? (
          <>
            <FormField
              label="Client ID"
              error={errors.config?.clientId?.message}
              required
            >
              <input
                type="text"
                {...register('config.clientId')}
                className="form-input"
                data-testid="client-id-input"
              />
            </FormField>

            <FormField
              label="Client Secret"
              error={errors.config?.clientSecret?.message}
              required
            >
              <input
                type="password"
                {...register('config.clientSecret')}
                className="form-input"
                autoComplete="new-password"
                data-testid="client-secret-input"
              />
            </FormField>

            <FormField
              label="Environment"
              error={errors.config?.environment?.message}
              required
            >
              <select
                {...register('config.environment')}
                className="form-select"
                data-testid="environment-select"
              >
                <option value="production">Production</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </FormField>
          </>
        ) : (
          <>
            <FormField
              label="Store ID"
              error={errors.config?.storeId?.message}
              required
            >
              <input
                type="text"
                {...register('config.storeId')}
                className="form-input"
                data-testid="store-id-input"
              />
            </FormField>

            <FormField
              label="Location ID"
              error={errors.config?.locationId?.message}
              required
            >
              <input
                type="text"
                {...register('config.locationId')}
                className="form-input"
                data-testid="location-id-input"
              />
            </FormField>

            <FormField
              label="Features"
              error={errors.config?.features?.message}
            >
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...register('config.features.orderSync')}
                    data-testid="order-sync-checkbox"
                  />
                  Order Synchronization
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...register('config.features.inventorySync')}
                    data-testid="inventory-sync-checkbox"
                  />
                  Inventory Synchronization
                </label>
              </div>
            </FormField>
          </>
        )}

        <FormField
          label="API Endpoint"
          error={errors.config?.apiEndpoint?.message}
          required
        >
          <input
            type="url"
            {...register('config.apiEndpoint')}
            className="form-input"
            data-testid="api-endpoint-input"
          />
        </FormField>
      </div>

      {/* Health Status Indicator */}
      {initialData && healthCheckConfig.enabled && (
        <div className="health-status">
          <span className={`status-indicator status-${healthStatus}`} />
          Status: {healthStatus}
          {lastHealthCheck && (
            <span className="last-check">
              Last checked: {lastHealthCheck.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Form Actions */}
      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          data-testid="cancel-button"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
          data-testid="submit-button"
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

export default IntegrationForm;