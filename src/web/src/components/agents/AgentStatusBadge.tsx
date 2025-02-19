import React, { useMemo } from 'react';
import styled from '@emotion/styled';
import { AgentStatus } from '../../types/agent.types';
import { COLORS } from '../../constants/theme';

interface AgentStatusBadgeProps {
  status: AgentStatus;
  isDarkMode: boolean;
}

// Theme-aware color mapping for agent statuses with WCAG 2.1 AA compliant contrast ratios
const getStatusColor = (status: AgentStatus, isDarkMode: boolean): string => {
  const theme = isDarkMode ? COLORS.dark : COLORS.light;

  switch (status) {
    case AgentStatus.DRAFT:
      return isDarkMode ? '#9E9E9E' : '#757575'; // Gray
    case AgentStatus.DEPLOYING:
      return isDarkMode ? '#64B5F6' : '#1E88E5'; // Blue
    case AgentStatus.ACTIVE:
      return isDarkMode ? '#66BB6A' : '#388E3C'; // Green
    case AgentStatus.PAUSED:
      return isDarkMode ? '#FFB74D' : '#F57C00'; // Orange
    case AgentStatus.ERROR:
      return isDarkMode ? '#EF5350' : '#D32F2F'; // Red
    default:
      return theme.secondary; // Fallback color
  }
};

// Status text mapping for accessibility and readability
const getStatusText = (status: AgentStatus): string => {
  switch (status) {
    case AgentStatus.DRAFT:
      return 'Draft';
    case AgentStatus.DEPLOYING:
      return 'Deploying';
    case AgentStatus.ACTIVE:
      return 'Active';
    case AgentStatus.PAUSED:
      return 'Paused';
    case AgentStatus.ERROR:
      return 'Error';
    default:
      return 'Unknown Status';
  }
};

const StyledBadge = styled.div<{ color: string; isDarkMode: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  background-color: ${({ color }) => color}1A; // 10% opacity background
  color: ${({ color }) => color};
  border: 1px solid ${({ color }) => color}3D; // 24% opacity border
  transition: all 0.2s ease-in-out;
  cursor: default;
  user-select: none;
  direction: inherit;
  min-width: 80px;

  &:hover {
    background-color: ${({ color }) => color}26; // 15% opacity on hover
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 1px solid currentColor;
    background-color: transparent;
  }
`;

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({
  status,
  isDarkMode
}) => {
  // Memoize color calculation to prevent unnecessary recalculations
  const statusColor = useMemo(
    () => getStatusColor(status, isDarkMode),
    [status, isDarkMode]
  );

  const statusText = getStatusText(status);

  return (
    <StyledBadge
      color={statusColor}
      isDarkMode={isDarkMode}
      role="status"
      aria-label={`Agent status: ${statusText}`}
      title={statusText}
    >
      {statusText}
    </StyledBadge>
  );
};

// Display name for debugging and development tools
AgentStatusBadge.displayName = 'AgentStatusBadge';

export default AgentStatusBadge;