import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material';
import AgentCard from '../../../src/components/agents/AgentCard';
import { Agent, AgentStatus } from '../../../src/types/agent.types';
import { createAppTheme } from '../../../src/config/theme.config';
import { Theme } from '../../../src/types/common.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock theme hook
vi.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: createAppTheme(Theme.LIGHT, false, false),
    isDarkMode: false
  })
}));

describe('AgentCard', () => {
  // Mock data
  const mockAgent: Agent = {
    id: 'test-agent-1',
    name: 'Test Agent',
    description: 'A test agent for unit testing',
    status: AgentStatus.ACTIVE,
    config: {
      naturalLanguageInput: 'Test input',
      schedule: {
        type: 'realtime'
      },
      permissions: {
        readCustomerData: true,
        writeCustomerData: false,
        accessReports: true,
        executeActions: true,
        manageIntegrations: false
      },
      resources: {
        cpu: 1,
        memory: 512
      }
    },
    integrationIds: ['integration-1'],
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    lastDeployedAt: new Date('2023-01-01'),
    errorMessage: null,
    metrics: {
      successRate: 0.98,
      avgResponseTime: 180,
      lastExecutionTime: new Date('2023-01-01')
    }
  };

  // Mock handlers
  const mockHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onStatusChange: vi.fn()
  };

  // Helper function to render with theme
  const renderWithTheme = (ui: React.ReactNode, themeMode: Theme = Theme.LIGHT) => {
    const theme = createAppTheme(themeMode, themeMode === Theme.DARK, false);
    return render(
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with all required props', () => {
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    // Verify basic content
    expect(screen.getByText(mockAgent.name)).toBeInTheDocument();
    expect(screen.getByText(mockAgent.description)).toBeInTheDocument();
    expect(screen.getByText('98.0%')).toBeInTheDocument();
    expect(screen.getByText('180ms')).toBeInTheDocument();
  });

  it('renders in light theme with correct styles', () => {
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const card = screen.getByTestId('agent-card');
    const computedStyle = window.getComputedStyle(card);
    
    expect(computedStyle.backgroundColor).toBe('#FFFFFF');
    expect(computedStyle.color).toBe('#333333');
  });

  it('renders in dark theme with correct styles', () => {
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />,
      Theme.DARK
    );

    const card = screen.getByTestId('agent-card');
    const computedStyle = window.getComputedStyle(card);
    
    expect(computedStyle.backgroundColor).toBe('#1E1E1E');
    expect(computedStyle.color).toBe('#FFFFFF');
  });

  it('handles status change correctly', async () => {
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const statusButton = screen.getByRole('button', { name: /pause agent/i });
    fireEvent.click(statusButton);

    expect(mockHandlers.onStatusChange).toHaveBeenCalledWith(
      mockAgent.id,
      AgentStatus.PAUSED
    );
  });

  it('handles edit action correctly', () => {
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit agent/i });
    fireEvent.click(editButton);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockAgent.id);
  });

  it('handles delete action with confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete agent/i });
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockAgent.id);
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', () => {
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const card = screen.getByTestId('agent-card');
    const buttons = within(card).getAllByRole('button');

    // Verify all buttons are focusable
    buttons.forEach(button => {
      expect(button).toHaveFocus();
      fireEvent.keyDown(button, { key: 'Tab' });
    });
  });

  it('displays loading state during actions', async () => {
    mockHandlers.onEdit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit agent/i });
    fireEvent.click(editButton);

    expect(screen.getByTestId('agent-card')).toHaveAttribute('aria-busy', 'true');
    expect(editButton).toBeDisabled();
  });

  it('handles error states gracefully', () => {
    const errorAgent = {
      ...mockAgent,
      status: AgentStatus.ERROR,
      errorMessage: 'Test error message'
    };

    renderWithTheme(
      <AgentCard
        agent={errorAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    const statusBadge = screen.getByRole('status');
    expect(statusBadge).toHaveTextContent(/error/i);
  });

  it('formats metrics correctly', () => {
    renderWithTheme(
      <AgentCard
        agent={mockAgent}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    expect(screen.getByText('98.0%')).toBeInTheDocument();
    expect(screen.getByText('180ms')).toBeInTheDocument();
  });
});