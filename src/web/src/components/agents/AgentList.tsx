import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import styled from '@emotion/styled';
import { useAnalytics } from '@segment/analytics-next';
import AgentCard from './AgentCard';
import ErrorBoundary from '../common/ErrorBoundary';
import { Agent, AgentStatus } from '../../types/agent.types';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, BREAKPOINTS } from '../../constants/theme';
import { httpClient } from '../../services/httpClient';
import { AGENT_ENDPOINTS } from '../../constants/apiEndpoints';
import { LoadingState, SortDirection } from '../../types/common.types';

// Styled components
const AgentListContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: ${SPACING.md};
`;

const ToolbarContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${SPACING.md};
  gap: ${SPACING.md};
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  padding: ${SPACING.sm} ${SPACING.md};
  border-radius: 4px;
  border: 1px solid ${props => props.theme.palette.divider};
  min-width: 250px;
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${SPACING.md};
  overflow-y: auto;
  padding-right: ${SPACING.sm}; // Space for scrollbar

  @media (max-width: ${BREAKPOINTS.sm}px) {
    grid-template-columns: 1fr;
  }
`;

const LoadingOverlay = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`;

// Component props interface
interface AgentListProps {
  filterStatus?: AgentStatus | null;
  sortField?: keyof Agent;
  sortDirection?: SortDirection;
  className?: string;
}

// Analytics decorator
const withAnalytics = (WrappedComponent: React.ComponentType<AgentListProps>) => {
  return function WithAnalyticsComponent(props: AgentListProps) {
    const analytics = useAnalytics();
    
    const trackEvent = useCallback((eventName: string, properties?: Record<string, unknown>) => {
      analytics.track(eventName, {
        ...properties,
        timestamp: new Date().toISOString()
      });
    }, [analytics]);

    return <WrappedComponent {...props} onTrackEvent={trackEvent} />;
  };
};

const AgentList: React.FC<AgentListProps & { onTrackEvent?: (name: string, props?: Record<string, unknown>) => void }> = ({
  filterStatus,
  sortField = 'createdAt',
  sortDirection = SortDirection.DESC,
  className,
  onTrackEvent
}) => {
  const { theme, isDarkMode } = useTheme();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());

  // Fetch agents on mount and when filter changes
  useEffect(() => {
    const fetchAgents = async () => {
      setLoadingState(LoadingState.LOADING);
      try {
        const response = await httpClient.get<Agent[]>(AGENT_ENDPOINTS.BASE, {
          status: filterStatus
        });
        setAgents(response.data);
        setLoadingState(LoadingState.SUCCESS);
        onTrackEvent?.('agents_loaded', { count: response.data.length });
      } catch (error) {
        setLoadingState(LoadingState.ERROR);
        onTrackEvent?.('agents_load_error', { error });
      }
    };

    fetchAgents();
  }, [filterStatus, onTrackEvent]);

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(agent => 
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus) {
      result = result.filter(agent => agent.status === filterStatus);
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const modifier = sortDirection === SortDirection.ASC ? 1 : -1;
      return aValue < bValue ? -1 * modifier : aValue > bValue ? 1 * modifier : 0;
    });

    return result;
  }, [agents, searchQuery, filterStatus, sortField, sortDirection]);

  // Virtual scrolling setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredAgents.length / 3),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5
  });

  // Agent management handlers
  const handleEdit = useCallback(async (id: string) => {
    onTrackEvent?.('agent_edit_started', { agentId: id });
    // Implementation handled by parent component
  }, [onTrackEvent]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await httpClient.delete(`${AGENT_ENDPOINTS.DELETE.replace(':id', id)}`);
      setAgents(prev => prev.filter(agent => agent.id !== id));
      onTrackEvent?.('agent_deleted', { agentId: id });
    } catch (error) {
      onTrackEvent?.('agent_delete_error', { agentId: id, error });
    }
  }, [onTrackEvent]);

  const handleStatusChange = useCallback(async (id: string, status: AgentStatus) => {
    try {
      await httpClient.put(`${AGENT_ENDPOINTS.STATUS.replace(':id', id)}`, { status });
      setAgents(prev => prev.map(agent => 
        agent.id === id ? { ...agent, status } : agent
      ));
      onTrackEvent?.('agent_status_changed', { agentId: id, status });
    } catch (error) {
      onTrackEvent?.('agent_status_change_error', { agentId: id, error });
    }
  }, [onTrackEvent]);

  if (loadingState === LoadingState.LOADING) {
    return <LoadingOverlay>Loading agents...</LoadingOverlay>;
  }

  return (
    <ErrorBoundary>
      <AgentListContainer className={className}>
        <ToolbarContainer>
          <SearchInput
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search agents"
          />
          {/* Additional toolbar actions can be added here */}
        </ToolbarContainer>

        <GridContainer ref={parentRef}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => (
            <div
              key={virtualRow.index}
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {[0, 1, 2].map(columnIndex => {
                const agentIndex = virtualRow.index * 3 + columnIndex;
                const agent = filteredAgents[agentIndex];

                if (!agent) return null;

                return (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                    selected={selectedAgents.has(agent.id)}
                  />
                );
              })}
            </div>
          ))}
        </GridContainer>
      </AgentListContainer>
    </ErrorBoundary>
  );
};

// Add display name for debugging
AgentList.displayName = 'AgentList';

// Export decorated component
export default withAnalytics(AgentList);