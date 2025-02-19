/**
 * Agent Details Page Component
 * Displays comprehensive information about a specific AI agent with real-time updates
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Badge,
  Button,
  Skeleton,
  useToast,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { Agent, AgentStatus } from '../../types/agent.types';
import { agentService } from '../../services/agentService';
import { useWebSocket } from '../../hooks/useWebSocket';
import { LoadingState, Severity } from '../../types/common.types';

// Constants for WebSocket events
const WS_EVENTS = {
  AGENT_STATUS: 'agent.status',
  AGENT_METRICS: 'agent.metrics',
  AGENT_ERROR: 'agent.error',
} as const;

interface AgentMetricsUpdate {
  successRate: number;
  avgResponseTime: number;
  lastExecutionTime: Date | null;
}

const AgentDetailsPage: React.FC = () => {
  // Router hooks
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State management
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.LOADING);
  const [error, setError] = useState<string | null>(null);

  // UI hooks
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // WebSocket connection for real-time updates
  const {
    connectionState,
    subscribe,
    disconnect,
    reconnect,
    lastError: wsError
  } = useWebSocket(`${process.env.VITE_WS_URL}/agents/${id}`, {
    autoConnect: true,
    reconnectAttempts: 3,
    heartbeatInterval: 30000
  });

  /**
   * Fetches initial agent data
   */
  const fetchAgentData = useCallback(async () => {
    if (!id) return;

    try {
      setLoadingState(LoadingState.LOADING);
      const agentData = await agentService.getAgentById(id);
      setAgent(agentData);
      setLoadingState(LoadingState.SUCCESS);
    } catch (error) {
      setLoadingState(LoadingState.ERROR);
      setError(error instanceof Error ? error.message : 'Failed to load agent');
      toast({
        title: 'Error loading agent',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [id, toast]);

  /**
   * Handles agent status updates from WebSocket
   */
  const handleStatusUpdate = useCallback((newStatus: AgentStatus) => {
    setAgent((prevAgent) => {
      if (!prevAgent) return null;
      return { ...prevAgent, status: newStatus };
    });

    toast({
      title: 'Agent Status Updated',
      description: `Status changed to ${newStatus}`,
      status: newStatus === AgentStatus.ERROR ? 'error' : 'info',
      duration: 3000,
      isClosable: true,
    });
  }, [toast]);

  /**
   * Handles agent metrics updates from WebSocket
   */
  const handleMetricsUpdate = useCallback((metrics: AgentMetricsUpdate) => {
    setAgent((prevAgent) => {
      if (!prevAgent) return null;
      return { ...prevAgent, metrics };
    });
  }, []);

  /**
   * Handles agent deletion
   */
  const handleDeleteAgent = async () => {
    if (!agent) return;

    try {
      await agentService.deleteAgent(agent.id);
      toast({
        title: 'Agent Deleted',
        description: 'Agent has been successfully deleted',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      navigate('/agents');
    } catch (error) {
      toast({
        title: 'Error Deleting Agent',
        description: error instanceof Error ? error.message : 'Failed to delete agent',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Initialize WebSocket subscriptions
  useEffect(() => {
    if (connectionState === LoadingState.SUCCESS) {
      const unsubscribeStatus = subscribe(WS_EVENTS.AGENT_STATUS, handleStatusUpdate);
      const unsubscribeMetrics = subscribe(WS_EVENTS.AGENT_METRICS, handleMetricsUpdate);

      return () => {
        unsubscribeStatus();
        unsubscribeMetrics();
      };
    }
  }, [connectionState, subscribe, handleStatusUpdate, handleMetricsUpdate]);

  // Fetch initial data
  useEffect(() => {
    fetchAgentData();
    return () => {
      disconnect();
    };
  }, [fetchAgentData, disconnect]);

  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      toast({
        title: 'Connection Error',
        description: 'Lost connection to agent updates. Attempting to reconnect...',
        status: 'warning',
        duration: null,
        isClosable: true,
      });
    }
  }, [wsError, toast]);

  if (loadingState === LoadingState.LOADING) {
    return (
      <Box p={8}>
        <Skeleton height="40px" mb={4} />
        <Skeleton height="20px" mb={2} />
        <Skeleton height="20px" mb={2} />
        <Skeleton height="20px" />
      </Box>
    );
  }

  if (loadingState === LoadingState.ERROR || !agent) {
    return (
      <Box p={8} textAlign="center">
        <Heading size="lg" color="red.500" mb={4}>Error Loading Agent</Heading>
        <Text mb={4}>{error || 'Agent not found'}</Text>
        <Button onClick={() => navigate('/agents')}>Return to Agents List</Button>
      </Box>
    );
  }

  return (
    <Box p={8} data-testid="agent-details-page">
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <Heading size="lg">{agent.name}</Heading>
          <Badge
            size="lg"
            colorScheme={
              agent.status === AgentStatus.ACTIVE ? 'green' :
              agent.status === AgentStatus.ERROR ? 'red' :
              agent.status === AgentStatus.PAUSED ? 'yellow' :
              'gray'
            }
          >
            {agent.status}
          </Badge>
        </HStack>

        <Text color="gray.600">{agent.description}</Text>

        {agent.metrics && (
          <Box p={4} bg="gray.50" borderRadius="md">
            <Heading size="sm" mb={4}>Performance Metrics</Heading>
            <HStack spacing={8}>
              <VStack align="start">
                <Text color="gray.600">Success Rate</Text>
                <Text fontWeight="bold">{agent.metrics.successRate.toFixed(2)}%</Text>
              </VStack>
              <VStack align="start">
                <Text color="gray.600">Avg Response Time</Text>
                <Text fontWeight="bold">{agent.metrics.avgResponseTime}ms</Text>
              </VStack>
              <VStack align="start">
                <Text color="gray.600">Last Execution</Text>
                <Text fontWeight="bold">
                  {agent.metrics.lastExecutionTime
                    ? new Date(agent.metrics.lastExecutionTime).toLocaleString()
                    : 'Never'}
                </Text>
              </VStack>
            </HStack>
          </Box>
        )}

        <HStack spacing={4}>
          <Button
            colorScheme="red"
            onClick={onOpen}
            aria-label="Delete agent"
          >
            Delete Agent
          </Button>
          {wsError && (
            <Button
              colorScheme="blue"
              onClick={reconnect}
              aria-label="Reconnect to agent updates"
            >
              Reconnect Updates
            </Button>
          )}
        </HStack>

        <AlertDialog
          isOpen={isOpen}
          leastDestructiveRef={cancelRef}
          onClose={onClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader>Delete Agent</AlertDialogHeader>
              <AlertDialogBody>
                Are you sure you want to delete this agent? This action cannot be undone.
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onClose}>
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={handleDeleteAgent} ml={3}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </VStack>
    </Box>
  );
};

export default AgentDetailsPage;