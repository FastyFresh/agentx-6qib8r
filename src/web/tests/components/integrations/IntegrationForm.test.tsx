import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.4.3
import { vi } from 'vitest'; // ^0.34.0
import IntegrationForm from '../../../../src/components/integrations/IntegrationForm';
import { IntegrationServiceType } from '../../../../src/types/integration.types';

describe('IntegrationForm', () => {
  // Mock handlers and services
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockHealthCheck = vi.fn();
  const mockTrackPerformance = vi.fn();

  // Test user instance
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    mockHealthCheck.mockResolvedValue({ status: 'healthy' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Form Rendering', () => {
    it('renders all common form fields correctly', () => {
      render(
        <IntegrationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('integration-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('service-type-select')).toBeInTheDocument();
      expect(screen.getByTestId('api-endpoint-input')).toBeInTheDocument();
    });

    it('renders with initial data when provided', () => {
      const initialData = {
        id: '123',
        name: 'Test Integration',
        serviceType: IntegrationServiceType.ZOHO_CRM,
        config: {
          apiEndpoint: 'https://api.example.com',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          environment: 'production'
        }
      };

      render(
        <IntegrationForm
          initialData={initialData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('integration-name-input')).toHaveValue('Test Integration');
      expect(screen.getByTestId('service-type-select')).toHaveValue(IntegrationServiceType.ZOHO_CRM);
      expect(screen.getByTestId('api-endpoint-input')).toHaveValue('https://api.example.com');
    });
  });

  describe('Zoho CRM Integration', () => {
    beforeEach(() => {
      render(
        <IntegrationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
      
      // Select Zoho CRM service type
      fireEvent.change(screen.getByTestId('service-type-select'), {
        target: { value: IntegrationServiceType.ZOHO_CRM }
      });
    });

    it('renders Zoho CRM specific fields', () => {
      expect(screen.getByTestId('client-id-input')).toBeInTheDocument();
      expect(screen.getByTestId('client-secret-input')).toBeInTheDocument();
      expect(screen.getByTestId('environment-select')).toBeInTheDocument();
    });

    it('validates required Zoho CRM fields', async () => {
      await user.click(screen.getByTestId('submit-button'));

      expect(await screen.findByText(/Client ID is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/Client secret is required/i)).toBeInTheDocument();
    });

    it('submits valid Zoho CRM configuration', async () => {
      await user.type(screen.getByTestId('integration-name-input'), 'Zoho Test');
      await user.type(screen.getByTestId('client-id-input'), 'test-client-id');
      await user.type(screen.getByTestId('client-secret-input'), 'test-client-secret');
      await user.type(screen.getByTestId('api-endpoint-input'), 'https://api.zoho.com');
      await user.selectOptions(screen.getByTestId('environment-select'), 'production');

      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Zoho Test',
          serviceType: IntegrationServiceType.ZOHO_CRM,
          config: expect.objectContaining({
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            apiEndpoint: 'https://api.zoho.com',
            environment: 'production'
          })
        }));
      });
    });
  });

  describe('RMS Integration', () => {
    beforeEach(() => {
      render(
        <IntegrationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
      
      // Select RMS service type
      fireEvent.change(screen.getByTestId('service-type-select'), {
        target: { value: IntegrationServiceType.RMS }
      });
    });

    it('renders RMS specific fields', () => {
      expect(screen.getByTestId('store-id-input')).toBeInTheDocument();
      expect(screen.getByTestId('location-id-input')).toBeInTheDocument();
      expect(screen.getByTestId('order-sync-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('inventory-sync-checkbox')).toBeInTheDocument();
    });

    it('validates required RMS fields', async () => {
      await user.click(screen.getByTestId('submit-button'));

      expect(await screen.findByText(/Store ID is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/Location ID is required/i)).toBeInTheDocument();
    });

    it('submits valid RMS configuration', async () => {
      await user.type(screen.getByTestId('integration-name-input'), 'RMS Test');
      await user.type(screen.getByTestId('store-id-input'), '12345');
      await user.type(screen.getByTestId('location-id-input'), '67890');
      await user.type(screen.getByTestId('api-endpoint-input'), 'https://api.rms.com');
      await user.click(screen.getByTestId('order-sync-checkbox'));

      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          name: 'RMS Test',
          serviceType: IntegrationServiceType.RMS,
          config: expect.objectContaining({
            storeId: '12345',
            locationId: '67890',
            apiEndpoint: 'https://api.rms.com',
            features: {
              orderSync: true,
              inventorySync: false
            }
          })
        }));
      });
    });
  });

  describe('Health Monitoring', () => {
    const initialData = {
      id: '123',
      name: 'Test Integration',
      serviceType: IntegrationServiceType.ZOHO_CRM,
      config: {
        apiEndpoint: 'https://api.example.com',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        environment: 'production'
      }
    };

    it('initializes health monitoring for existing integrations', async () => {
      render(
        <IntegrationForm
          initialData={initialData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          healthCheckConfig={{ interval: 1000, enabled: true }}
        />
      );

      // Initial health check should be performed
      await waitFor(() => {
        expect(screen.getByText(/Status: healthy/i)).toBeInTheDocument();
      });

      // Advance timers to trigger next health check
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.getByText(/Last checked:/i)).toBeInTheDocument();
      });
    });

    it('handles health check errors appropriately', async () => {
      mockHealthCheck.mockRejectedValueOnce(new Error('Health check failed'));

      render(
        <IntegrationForm
          initialData={initialData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          healthCheckConfig={{ interval: 1000, enabled: true }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Status: error/i)).toBeInTheDocument();
      });
    });

    it('cleans up health monitoring on unmount', () => {
      const { unmount } = render(
        <IntegrationForm
          initialData={initialData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          healthCheckConfig={{ interval: 1000, enabled: true }}
        />
      );

      unmount();

      // Advance timers to verify no more health checks are performed
      vi.advanceTimersByTime(2000);
      expect(mockHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('Form Actions', () => {
    it('handles form cancellation', async () => {
      render(
        <IntegrationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByTestId('cancel-button'));
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('disables submit button while submitting', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(
        <IntegrationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByTestId('integration-name-input'), 'Test');
      await user.click(screen.getByTestId('submit-button'));

      expect(screen.getByTestId('submit-button')).toBeDisabled();
      expect(screen.getByText(/Saving/i)).toBeInTheDocument();
    });
  });
});