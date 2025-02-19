import React, { useCallback, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form'; // ^7.45.0
import { zodResolver } from '@hookform/resolvers/zod'; // ^3.2.0
import FormField from '../common/FormField';
import { useAgent } from '../../hooks/useAgent';
import { createAgentSchema } from '../../validation/agentSchema';
import { IntegrationServiceType } from '../../types/integration.types';
import { AgentStatus } from '../../types/agent.types';
import { AGENT_ERRORS } from '../../constants/errorMessages';

// Enhanced props interface with comprehensive callback handling
interface AgentCreationFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onValidationError?: (errors: any) => void;
  className?: string;
  initialData?: Partial<AgentFormData>;
}

// Comprehensive form data interface
interface AgentFormData {
  name: string;
  description: string;
  config: {
    naturalLanguageInput: string;
    schedule: {
      type: 'realtime' | 'scheduled';
      interval?: number;
      timezone?: string;
    };
    permissions: {
      readCustomerData: boolean;
      writeCustomerData: boolean;
      accessReports: boolean;
      manageIntegrations: boolean;
    };
    resources: {
      cpu: number;
      memory: number;
      storage?: number;
    };
    integrations: {
      serviceType: IntegrationServiceType;
      endpoint: string;
      authType: 'apiKey' | 'oauth';
      credentials: Record<string, string>;
    };
  };
}

/**
 * Enhanced form component for creating AI agents with comprehensive validation
 * Implements Material Design 3.0 guidelines with accessibility support
 * @version 1.0.0
 */
const AgentCreationForm: React.FC<AgentCreationFormProps> = React.memo(({
  onSuccess,
  onError,
  onValidationError,
  className,
  initialData
}) => {
  // Performance optimization for form rendering
  const formRef = useRef<HTMLFormElement>(null);
  const { createAgent } = useAgent();

  // Initialize form with enhanced validation
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch
  } = useForm<AgentFormData>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      config: {
        naturalLanguageInput: '',
        schedule: { type: 'realtime' },
        permissions: {
          readCustomerData: false,
          writeCustomerData: false,
          accessReports: false,
          manageIntegrations: false
        },
        resources: {
          cpu: 0.5,
          memory: 512
        },
        integrations: {
          serviceType: IntegrationServiceType.ZOHO_CRM,
          endpoint: '',
          authType: 'apiKey',
          credentials: {}
        }
      }
    }
  });

  // Watch for real-time validation of dependent fields
  const watchWritePermission = watch('config.permissions.writeCustomerData');
  const watchScheduleType = watch('config.schedule.type');

  // Memoized validation rules for dependent fields
  const permissionRules = useMemo(() => ({
    readCustomerData: {
      required: watchWritePermission,
      message: 'Read permission is required when write permission is enabled'
    }
  }), [watchWritePermission]);

  // Enhanced form submission handler with error handling
  const onSubmit = useCallback(async (data: AgentFormData) => {
    try {
      const agent = await createAgent({
        name: data.name,
        description: data.description,
        config: {
          ...data.config,
          status: AgentStatus.DRAFT
        }
      });

      reset();
      onSuccess?.();
      return agent;
    } catch (error) {
      onError?.(error as Error);
      console.error('Agent creation failed:', error);
    }
  }, [createAgent, onSuccess, onError, reset]);

  // Handle validation errors
  const handleValidationError = useCallback((errors: any) => {
    onValidationError?.(errors);
    console.warn('Validation errors:', errors);
  }, [onValidationError]);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit, handleValidationError)}
      className={className}
      noValidate
    >
      {/* Agent Name */}
      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <FormField
            label="Agent Name"
            error={errors.name?.message}
            required
          >
            <input
              {...field}
              type="text"
              className="form-input"
              placeholder="Enter agent name"
              aria-label="Agent name"
            />
          </FormField>
        )}
      />

      {/* Agent Description */}
      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <FormField
            label="Description"
            error={errors.description?.message}
            required
          >
            <textarea
              {...field}
              className="form-textarea"
              placeholder="Describe the agent's purpose"
              rows={3}
              aria-label="Agent description"
            />
          </FormField>
        )}
      />

      {/* Natural Language Input */}
      <Controller
        name="config.naturalLanguageInput"
        control={control}
        render={({ field }) => (
          <FormField
            label="Natural Language Requirements"
            error={errors.config?.naturalLanguageInput?.message}
            helperText="Describe what you want your agent to do"
            required
          >
            <textarea
              {...field}
              className="form-textarea"
              placeholder="Example: Create an agent that processes customer orders and updates inventory"
              rows={5}
              aria-label="Natural language requirements"
            />
          </FormField>
        )}
      />

      {/* Schedule Configuration */}
      <Controller
        name="config.schedule.type"
        control={control}
        render={({ field }) => (
          <FormField
            label="Execution Schedule"
            error={errors.config?.schedule?.type?.message}
            required
          >
            <select
              {...field}
              className="form-select"
              aria-label="Schedule type"
            >
              <option value="realtime">Real-time</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </FormField>
        )}
      />

      {/* Conditional Interval Input */}
      {watchScheduleType === 'scheduled' && (
        <Controller
          name="config.schedule.interval"
          control={control}
          render={({ field }) => (
            <FormField
              label="Interval (minutes)"
              error={errors.config?.schedule?.interval?.message}
              required
            >
              <input
                {...field}
                type="number"
                min={1}
                max={1440}
                className="form-input"
                aria-label="Schedule interval"
              />
            </FormField>
          )}
        />
      )}

      {/* Resource Allocation */}
      <div className="resource-allocation">
        <Controller
          name="config.resources.cpu"
          control={control}
          render={({ field }) => (
            <FormField
              label="CPU Units"
              error={errors.config?.resources?.cpu?.message}
              required
            >
              <input
                {...field}
                type="number"
                step={0.1}
                min={0.1}
                max={4.0}
                className="form-input"
                aria-label="CPU allocation"
              />
            </FormField>
          )}
        />

        <Controller
          name="config.resources.memory"
          control={control}
          render={({ field }) => (
            <FormField
              label="Memory (MB)"
              error={errors.config?.resources?.memory?.message}
              required
            >
              <input
                {...field}
                type="number"
                step={128}
                min={128}
                max={4096}
                className="form-input"
                aria-label="Memory allocation"
              />
            </FormField>
          )}
        />
      </div>

      {/* Permissions */}
      <div className="permissions-section">
        <h3 className="section-title">Permissions</h3>
        
        <Controller
          name="config.permissions.readCustomerData"
          control={control}
          render={({ field }) => (
            <FormField
              label="Read Customer Data"
              error={errors.config?.permissions?.readCustomerData?.message}
            >
              <input
                {...field}
                type="checkbox"
                className="form-checkbox"
                aria-label="Permission to read customer data"
              />
            </FormField>
          )}
        />

        <Controller
          name="config.permissions.writeCustomerData"
          control={control}
          render={({ field }) => (
            <FormField
              label="Write Customer Data"
              error={errors.config?.permissions?.writeCustomerData?.message}
            >
              <input
                {...field}
                type="checkbox"
                className="form-checkbox"
                aria-label="Permission to write customer data"
              />
            </FormField>
          )}
        />
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-secondary"
          disabled={isSubmitting}
        >
          Reset
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Agent'}
        </button>
      </div>
    </form>
  );
});

AgentCreationForm.displayName = 'AgentCreationForm';

export default AgentCreationForm;