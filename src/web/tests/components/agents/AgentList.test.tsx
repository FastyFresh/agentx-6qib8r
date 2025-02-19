import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import AgentList from '../../../src/components/agents/AgentList';
import { AgentStatus } from '../../../src/types/agent.types';
import { LoadingState } from '../../../src/types/common.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock hooks and services
vi.mock('../../../src/hooks/useAgent', () => ({
  useAgent: vi.fn()
}));

vi.mock('../../../src/services/websocketService', () => ({
  WebSocketService: vi.fn(() => ({
    subscribe: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  }))
}));

// Mock data
const mockAgents = [
  {
    id: '1',
    name: 'Sales Bot',
    description: 'Handles sales inquiries',
    status: AgentStatus.ACTIVE,
    metrics: {
      successRate: 0.98,
      avgResponseTime: 180
    },
    lastDeployedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Order Processor',
    description: 'Processes customer orders',
    status: AgentStatus.PAUSED,
    metrics: {
      successRate: 0.95,
      avgResponseTime: 165
    },
    lastDeployedAt: new Date().toISOString()
  }
];

describe('AgentList', () => {
  let mockUseAgent: any;

  beforeEach(() => {
    mockUseAgent = {
      agents: mockAgents,
      loading: {
        fetch: false,
        create: false,
        update: false,
        delete: false
      },
      error: null,
      fetchAgents: vi.fn(),
      updateAgentStatus: vi.fn(),
      filterAgents: vi.fn(),
      deleteAgent: vi.fn()
    };

    vi.mocked(require('../../../src/hooks/useAgent').useAgent).mockReturnValue(mockUseAgent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering States', () => {
    test('should show loading spinner when fetching agents', () => {
      mockUseAgent.loading.fetch = true;
      render(<AgentList />);
      
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
      expect(screen.queryByTestId('agent-grid')).not.toBeInTheDocument();
    });

    test('should show error message when fetch fails', () => {
      mockUseAgent.error = { message: 'Failed to fetch agents' };
      render(<AgentList />);
      
      expect(screen.getByText('Failed to fetch agents')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    test('should show empty state when no agents exist', () => {
      mockUseAgent.agents = [];
      render(<AgentList />);
      
      expect(screen.getByText('No agents found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument();
    });

    test('should render agent list with correct data', () => {
      render(<AgentList />);
      
      mockAgents.forEach(agent => {
        const card = screen.getByTestId(`agent-card-${agent.id}`);
        expect(within(card).getByText(agent.name)).toBeInTheDocument();
        expect(within(card).getByText(agent.description)).toBeInTheDocument();
        expect(within(card).getByText(`${agent.metrics.successRate * 100}%`)).toBeInTheDocument();
        expect(within(card).getByText(`${agent.metrics.avgResponseTime}ms`)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    test('should filter agents by status', async () => {
      render(<AgentList filterStatus={AgentStatus.ACTIVE} />);
      
      const activeAgents = mockAgents.filter(a => a.status === AgentStatus.ACTIVE);
      expect(screen.getAllByTestId(/agent-card-/)).toHaveLength(activeAgents.length);
    });

    test('should filter agents by search query', async () => {
      render(<AgentList />);
      
      const searchInput = screen.getByPlaceholderText('Search agents...');
      fireEvent.change(searchInput, { target: { value: 'Sales' } });
      
      await waitFor(() => {
        expect(screen.getAllByTestId(/agent-card-/)).toHaveLength(1);
        expect(screen.getByText('Sales Bot')).toBeInTheDocument();
      });
    });

    test('should handle combined status and search filters', async () => {
      render(<AgentList filterStatus={AgentStatus.ACTIVE} />);
      
      const searchInput = screen.getByPlaceholderText('Search agents...');
      fireEvent.change(searchInput, { target: { value: 'Sales' } });
      
      await waitFor(() => {
        expect(screen.getAllByTestId(/agent-card-/)).toHaveLength(1);
        expect(screen.getByText('Sales Bot')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    test('should update agent status in real-time', async () => {
      render(<AgentList />);
      
      const agent = mockAgents[0];
      const statusButton = within(screen.getByTestId(`agent-card-${agent.id}`))
        .getByRole('button', { name: /status/i });
      
      fireEvent.click(statusButton);
      
      await waitFor(() => {
        expect(mockUseAgent.updateAgentStatus).toHaveBeenCalledWith(
          agent.id,
          AgentStatus.PAUSED
        );
      });
    });

    test('should handle agent deletion', async () => {
      render(<AgentList />);
      
      const agent = mockAgents[0];
      const deleteButton = within(screen.getByTestId(`agent-card-${agent.id}`))
        .getByRole('button', { name: /delete/i });
      
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(mockUseAgent.deleteAgent).toHaveBeenCalledWith(agent.id);
      });
    });
  });

  describe('Performance', () => {
    test('should virtualize list for large datasets', async () => {
      const largeAgentList = Array.from({ length: 100 }, (_, i) => ({
        ...mockAgents[0],
        id: `${i}`,
        name: `Agent ${i}`
      }));
      
      mockUseAgent.agents = largeAgentList;
      
      const { container } = render(<AgentList />);
      
      // Verify only a subset of agents are rendered
      expect(container.querySelectorAll('[data-testid^="agent-card-"]').length)
        .toBeLessThan(largeAgentList.length);
    });

    test('should debounce search input', async () => {
      render(<AgentList />);
      
      const searchInput = screen.getByPlaceholderText('Search agents...');
      
      fireEvent.change(searchInput, { target: { value: 'a' } });
      fireEvent.change(searchInput, { target: { value: 'ag' } });
      fireEvent.change(searchInput, { target: { value: 'age' } });
      
      await waitFor(() => {
        expect(mockUseAgent.filterAgents).toHaveBeenCalledTimes(1);
      }, { timeout: 300 });
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(<AgentList />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should support keyboard navigation', () => {
      render(<AgentList />);
      
      const firstCard = screen.getByTestId('agent-card-1');
      firstCard.focus();
      
      fireEvent.keyDown(firstCard, { key: 'Enter' });
      expect(firstCard).toHaveAttribute('aria-expanded', 'true');
      
      fireEvent.keyDown(firstCard, { key: 'Escape' });
      expect(firstCard).toHaveAttribute('aria-expanded', 'false');
    });

    test('should announce status changes', async () => {
      render(<AgentList />);
      
      const statusButton = screen.getByRole('button', { name: /change status/i });
      fireEvent.click(statusButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/status updated/i);
      });
    });
  });
});