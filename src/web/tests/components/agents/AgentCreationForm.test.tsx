import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Provider } from 'react-redux';
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import AgentCreationForm from '../../../src/components/agents/AgentCreationForm';
import { useAgent } from '../../../src/hooks/useAgent';
import { AgentStatus } from '../../../src/types/agent.types';
import { IntegrationServiceType } from '../../../src/types/integration.types';
import { AGENT_ERRORS } from '../../../src/constants/errorMessages';
import { createStore } from '../../../src/store';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAgent hook
jest.mock('../../../src/hooks/useAgent', () => ({
  useAgent: jest.fn()
}));

// Configure axe for accessibility testing
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: true },
    'label': { enabled: true },
    'aria-required-attr': { enabled: true }
  }
});

describe('AgentCreationForm', () => {
  // Test data
  const validFormData = {
    name: 'Test Agent',
    description: 'Test agent description',
    config: {
      naturalLanguageInput: 'Create an agent that processes customer orders',
      schedule: {
        type: 'realtime'
      },
      permissions: {
        readCustomerData: true,
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
        endpoint: 'https://api.zoho.com',
        authType: 'apiKey',
        credentials: {}
      }
    }
  };

  // Mock functions
  const mockCreateAgent = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();
  const mockOnValidationError = jest.fn();

  // Store setup
  let store: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Configure mock store
    store = createStore();

    // Configure useAgent mock
    (useAgent as jest.Mock).mockReturnValue({
      createAgent: mockCreateAgent,
      loading: { create: false },
      error: { create: null }
    });
  });

  it('renders all form fields correctly', () => {
    render(
      <Provider store={store}>
        <AgentCreationForm />
      </Provider>
    );

    // Verify essential form fields
    expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/natural language requirements/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/execution schedule/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpu allocation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/memory allocation/i)).toBeInTheDocument();
  });

  it('handles form submission with valid data', async () => {
    mockCreateAgent.mockResolvedValueOnce({
      id: '123',
      ...validFormData,
      status: AgentStatus.DRAFT
    });

    render(
      <Provider store={store}>
        <AgentCreationForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    // Fill form fields
    fireEvent.change(screen.getByLabelText(/agent name/i), {
      target: { value: validFormData.name }
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: validFormData.description }
    });
    fireEvent.change(screen.getByLabelText(/natural language requirements/i), {
      target: { value: validFormData.config.naturalLanguageInput }
    });

    // Submit form
    fireEvent.click(screen.getByText(/create agent/i));

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({
        name: validFormData.name,
        description: validFormData.description
      }));
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('validates required fields', async () => {
    render(
      <Provider store={store}>
        <AgentCreationForm onValidationError={mockOnValidationError} />
      </Provider>
    );

    // Submit empty form
    fireEvent.click(screen.getByText(/create agent/i));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      expect(mockOnValidationError).toHaveBeenCalled();
    });
  });

  it('handles form submission errors', async () => {
    const error = new Error(AGENT_ERRORS.CREATION_FAILED);
    mockCreateAgent.mockRejectedValueOnce(error);

    render(
      <Provider store={store}>
        <AgentCreationForm
          onError={mockOnError}
          initialData={validFormData}
        />
      </Provider>
    );

    fireEvent.click(screen.getByText(/create agent/i));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(error);
    });
  });

  it('validates accessibility requirements', async () => {
    const { container } = render(
      <Provider store={store}>
        <AgentCreationForm />
      </Provider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('measures performance metrics', async () => {
    const startTime = performance.now();

    render(
      <Provider store={store}>
        <AgentCreationForm initialData={validFormData} />
      </Provider>
    );

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(200); // 200ms threshold

    // Test form interaction performance
    const interactionStart = performance.now();
    fireEvent.change(screen.getByLabelText(/agent name/i), {
      target: { value: 'Test' }
    });
    const interactionTime = performance.now() - interactionStart;
    expect(interactionTime).toBeLessThan(100); // 100ms threshold
  });

  it('handles conditional field rendering', async () => {
    render(
      <Provider store={store}>
        <AgentCreationForm />
      </Provider>
    );

    // Test scheduled type selection
    const scheduleSelect = screen.getByLabelText(/execution schedule/i);
    fireEvent.change(scheduleSelect, { target: { value: 'scheduled' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/interval/i)).toBeInTheDocument();
    });
  });

  it('validates resource allocation limits', async () => {
    render(
      <Provider store={store}>
        <AgentCreationForm onValidationError={mockOnValidationError} />
      </Provider>
    );

    // Test CPU limits
    fireEvent.change(screen.getByLabelText(/cpu allocation/i), {
      target: { value: '5.0' } // Exceeds maximum
    });

    await waitFor(() => {
      expect(screen.getByText(/cpu cannot exceed 4.0 cores/i)).toBeInTheDocument();
    });

    // Test memory limits
    fireEvent.change(screen.getByLabelText(/memory allocation/i), {
      target: { value: '5000' } // Exceeds maximum
    });

    await waitFor(() => {
      expect(screen.getByText(/memory cannot exceed 4096mb/i)).toBeInTheDocument();
    });
  });
});