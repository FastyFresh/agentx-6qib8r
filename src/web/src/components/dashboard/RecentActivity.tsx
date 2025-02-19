import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { formatDistanceToNow } from 'date-fns'; // ^2.30.0
import Card from '../common/Card';
import ErrorBoundary from '../common/ErrorBoundary';
import { useAgent } from '../../hooks/useAgent';
import { AgentStatus } from '../../types/agent.types';
import { useTheme } from '../../hooks/useTheme';

interface RecentActivityProps {
  maxItems?: number;
  className?: string;
  refreshInterval?: number;
  onError?: (error: Error) => void;
  testId?: string;
}

interface ActivityItem {
  id: string;
  agentId: string;
  agentName: string;
  status: AgentStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const RecentActivity: React.FC<RecentActivityProps> = React.memo(({
  maxItems = 5,
  className,
  refreshInterval = 30000,
  onError,
  testId = 'recent-activity'
}) => {
  const { theme, isDarkMode } = useTheme();
  const { agents, loading, error, fetchAgents } = useAgent();
  const parentRef = useRef<HTMLDivElement>(null);

  // Transform agents into activity items
  const activityItems = useMemo(() => {
    if (!agents) return [];
    
    return agents
      .map(agent => ({
        id: `${agent.id}-${agent.updatedAt.getTime()}`,
        agentId: agent.id,
        agentName: agent.name,
        status: agent.status,
        timestamp: agent.updatedAt,
        metadata: {
          errorMessage: agent.errorMessage,
          metrics: agent.metrics
        }
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxItems);
  }, [agents, maxItems]);

  // Virtual list for performance optimization
  const rowVirtualizer = useVirtualizer({
    count: activityItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 2 // Number of items to render outside visible area
  });

  // Auto-refresh handler
  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAgents, refreshInterval]);

  // Error handling
  useEffect(() => {
    if (error && onError) {
      onError(new Error(error.message));
    }
  }, [error, onError]);

  // Status color mapping with theme support
  const getStatusColor = useCallback((status: AgentStatus): string => {
    const colors = {
      [AgentStatus.ACTIVE]: isDarkMode ? 'text-green-400' : 'text-green-600',
      [AgentStatus.ERROR]: isDarkMode ? 'text-red-400' : 'text-red-600',
      [AgentStatus.PAUSED]: isDarkMode ? 'text-yellow-400' : 'text-yellow-600',
      [AgentStatus.DEPLOYING]: isDarkMode ? 'text-blue-400' : 'text-blue-600',
      [AgentStatus.DRAFT]: isDarkMode ? 'text-gray-400' : 'text-gray-600'
    };
    return colors[status] || 'text-gray-600';
  }, [isDarkMode]);

  // Render activity item
  const renderActivityItem = useCallback((item: ActivityItem) => (
    <div
      className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700"
      role="listitem"
      aria-label={`${item.agentName} status update`}
    >
      <div className="flex-1">
        <div className="flex items-center">
          <span className="font-medium">{item.agentName}</span>
          <span
            className={`ml-2 px-2 py-1 rounded-full text-sm ${getStatusColor(item.status)}`}
            role="status"
          >
            {item.status}
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {formatDistanceToNow(item.timestamp, { addSuffix: true })}
        </div>
        {item.metadata?.errorMessage && (
          <div
            className="text-sm text-red-600 dark:text-red-400 mt-1"
            role="alert"
          >
            {item.metadata.errorMessage}
          </div>
        )}
      </div>
    </div>
  ), [getStatusColor]);

  return (
    <ErrorBoundary
      onError={onError}
      fallback={
        <Card className={className} testId={`${testId}-error`}>
          <div className="p-4 text-red-600 dark:text-red-400">
            Failed to load recent activity
          </div>
        </Card>
      }
    >
      <Card
        className={className}
        testId={testId}
        elevation={1}
        noPadding
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: `${Math.min(activityItems.length * 72, 360)}px` }}
          role="list"
          aria-label="Recent agent activities"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading && activityItems.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Loading activities...
            </div>
          ) : activityItems.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No recent activities
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = activityItems[virtualRow.index];
                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {renderActivityItem(item)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </ErrorBoundary>
  );
});

RecentActivity.displayName = 'RecentActivity';

export default RecentActivity;