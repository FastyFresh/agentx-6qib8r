import React, { useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { formatDistanceToNow } from 'date-fns'; // ^2.30.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import AgentStatusBadge from './AgentStatusBadge';
import Card from '../common/Card';
import { Agent, AgentStatus } from '../../types/agent.types';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, ANIMATION, TYPOGRAPHY } from '../../constants/theme';

interface AgentCardProps {
  agent: Agent;
  onEdit: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: AgentStatus) => Promise<void>;
  className?: string;
  testId?: string;
}

const StyledCard = styled(Card)`
  position: relative;
  min-width: 300px;
  margin: ${SPACING.sm};
  transition: all ${ANIMATION.duration.normal} ${ANIMATION.easing.easeInOut};
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${SPACING.md};
`;

const CardTitle = styled.h3`
  font-size: ${TYPOGRAPHY.scale.h5};
  font-weight: ${TYPOGRAPHY.fontWeights.medium};
  margin: 0;
  color: ${props => props.theme.palette.text.primary};
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
`;

const MetricsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${SPACING.sm};
  margin-top: ${SPACING.md};
`;

const ActionContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${SPACING.sm};
  margin-top: ${SPACING.md};
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
`;

const MetricLabel = styled.span`
  font-size: ${TYPOGRAPHY.scale.caption};
  color: ${props => props.theme.palette.text.secondary};
`;

const MetricValue = styled.span`
  font-size: ${TYPOGRAPHY.scale.body2};
  font-weight: ${TYPOGRAPHY.fontWeights.medium};
  color: ${props => props.theme.palette.text.primary};
`;

const AgentCard: React.FC<AgentCardProps> = React.memo(({
  agent,
  onEdit,
  onDelete,
  onStatusChange,
  className,
  testId = 'agent-card'
}) => {
  const { theme, isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsLoading(true);
    try {
      await onEdit(agent.id);
    } finally {
      setIsLoading(false);
    }
  }, [agent.id, onEdit]);

  const handleDelete = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this agent?')) {
      setIsLoading(true);
      try {
        await onDelete(agent.id);
      } finally {
        setIsLoading(false);
      }
    }
  }, [agent.id, onDelete]);

  const handleStatusChange = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    const newStatus = agent.status === AgentStatus.ACTIVE ? AgentStatus.PAUSED : AgentStatus.ACTIVE;
    setIsLoading(true);
    try {
      await onStatusChange(agent.id, newStatus);
    } finally {
      setIsLoading(false);
    }
  }, [agent.id, agent.status, onStatusChange]);

  const lastDeployedText = agent.lastDeployedAt
    ? formatDistanceToNow(new Date(agent.lastDeployedAt), { addSuffix: true })
    : 'Never deployed';

  return (
    <ErrorBoundary
      fallback={<div>Error loading agent card</div>}
      onError={(error) => console.error('Agent card error:', error)}
    >
      <StyledCard
        variant="elevated"
        elevation={2}
        className={className}
        data-testid={testId}
        focusable
        aria-busy={isLoading}
      >
        <CardHeader>
          <CardTitle>{agent.name}</CardTitle>
          <AgentStatusBadge
            status={agent.status}
            isDarkMode={isDarkMode}
          />
        </CardHeader>

        <CardContent>
          <p>{agent.description}</p>

          <MetricsContainer>
            <MetricItem>
              <MetricLabel>Success Rate</MetricLabel>
              <MetricValue>
                {agent.metrics?.successRate ? `${(agent.metrics.successRate * 100).toFixed(1)}%` : 'N/A'}
              </MetricValue>
            </MetricItem>
            <MetricItem>
              <MetricLabel>Response Time</MetricLabel>
              <MetricValue>
                {agent.metrics?.avgResponseTime ? `${agent.metrics.avgResponseTime}ms` : 'N/A'}
              </MetricValue>
            </MetricItem>
          </MetricsContainer>

          <MetricItem>
            <MetricLabel>Last Deployed</MetricLabel>
            <MetricValue>{lastDeployedText}</MetricValue>
          </MetricItem>

          <ActionContainer>
            <button
              onClick={handleStatusChange}
              disabled={isLoading}
              aria-label={`${agent.status === AgentStatus.ACTIVE ? 'Pause' : 'Activate'} agent`}
            >
              {agent.status === AgentStatus.ACTIVE ? 'Pause' : 'Activate'}
            </button>
            <button
              onClick={handleEdit}
              disabled={isLoading}
              aria-label="Edit agent"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isLoading}
              aria-label="Delete agent"
            >
              Delete
            </button>
          </ActionContainer>
        </CardContent>
      </StyledCard>
    </ErrorBoundary>
  );
});

AgentCard.displayName = 'AgentCard';

export default AgentCard;