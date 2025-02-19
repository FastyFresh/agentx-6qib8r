import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { AgentList } from '../components/agents/AgentList';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useWebSocket } from '../hooks/useWebSocket';
import { Agent, AgentStatus } from '../types/agent.types';
import { httpClient } from '../services/httpClient';
import { AGENT_ENDPOINTS } from '../constants/apiEndpoints';
import { LoadingState, SortDirection } from '../types/common.types';
import { notificationService } from '../services/notificationService';
import { COLORS, SPACING, TYPOGRAPHY, BREAKPOINTS } from '../constants/theme';

// Styled components following Material Design 3.0 specifications
const PageContainer = styled.div`
  padding: ${SPACING.md};
  height: 100%;
  background-color: ${({ theme }) => theme.palette.background.default};
  overflow-y: auto;
  position: relative;

  @media (max-width: ${BREAKPOINTS.sm}px) {
    padding: ${SPACING.sm};
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${SPACING.lg};
  flex-wrap: wrap;
  gap: ${SPACING.md};
`;

const Title = styled.h1`
  font-size: ${TYPOGRAPHY.scale.h4};
  font-weight: ${TYPOGRAPHY.fontWeights.medium};
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0;
`;

const ActionButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.md};
  background-color: ${COLORS.light.primary};
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: ${TYPOGRAPHY.fontWeights.medium};
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${COLORS.light.primary}dd;
  }

  &:disabled {
    background-color: ${COLORS.light.secondary};
    cursor: not-allowed;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const AgentsListPage: React.FC = () => {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [sortState, setSortState] = useState({ field: 'createdAt', direction: SortDirection.DESC });

  // WebSocket setup for real-time updates
  const { connectionState, subscribe } = useWebSocket(
    `${process.env.VITE_WS_URL}/agents`,
    { autoConnect: true, reconnectAttempts: 3 }
  );

  // Fetch initial agents data
  const fetchAgents = useCallback(async () => {
    setLoadingState(LoadingState.LOADING);
    try {
      const response = await httpClient.get<Agent[]>(AGENT_ENDPOINTS.BASE);
      setAgents(response.data);
      setLoadingState(LoadingState.SUCCESS);
    } catch (error) {
      setLoadingState(LoadingState.ERROR);
      notificationService.addNotification({
        message: t('agents.list.fetchError'),
        severity: 'error',
        category: 'system'
      });
    }
  }, [t]);

  // Handle real-time agent updates
  const handleAgentUpdate = useCallback((update: { agent: Agent; action: string }) => {
    setAgents(prevAgents => {
      switch (update.action) {
        case 'create':
          return [update.agent, ...prevAgents];
        case 'update':
          return prevAgents.map(agent => 
            agent.id === update.agent.id ? update.agent : agent
          );
        case 'delete':
          return prevAgents.filter(agent => agent.id !== update.agent.id);
        default:
          return prevAgents;
      }
    });
  }, []);

  // Initialize WebSocket subscription and fetch initial data
  useEffect(() => {
    const unsubscribe = subscribe('agent_update', handleAgentUpdate);
    fetchAgents();
    return () => {
      unsubscribe();
    };
  }, [subscribe, handleAgentUpdate, fetchAgents]);

  // Handle agent creation navigation
  const handleCreateAgent = useCallback(() => {
    window.location.href = '/agents/create';
  }, []);

  // Memoized sorted agents list
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const aValue = a[sortState.field as keyof Agent];
      const bValue = b[sortState.field as keyof Agent];
      const modifier = sortState.direction === SortDirection.ASC ? 1 : -1;
      return aValue < bValue ? -1 * modifier : aValue > bValue ? 1 * modifier : 0;
    });
  }, [agents, sortState]);

  return (
    <ErrorBoundary>
      <PageContainer>
        <Header>
          <Title>{t('agents.list.title')}</Title>
          <ActionButton 
            onClick={handleCreateAgent}
            disabled={loadingState === LoadingState.LOADING}
            aria-label={t('agents.create.button')}
          >
            {t('agents.create.button')}
          </ActionButton>
        </Header>

        <AgentList
          agents={sortedAgents}
          sortField={sortState.field}
          sortDirection={sortState.direction}
          onSortChange={setSortState}
          filterStatus={null}
        />

        {loadingState === LoadingState.LOADING && (
          <LoadingOverlay>
            <span role="status">{t('common.loading')}</span>
          </LoadingOverlay>
        )}

        {connectionState === LoadingState.ERROR && (
          <div role="alert" aria-live="polite">
            {t('agents.list.connectionError')}
          </div>
        )}
      </PageContainer>
    </ErrorBoundary>
  );
};

export default AgentsListPage;