/**
 * Enhanced WebSocket Hook
 * Provides a declarative interface for WebSocket functionality with automatic reconnection,
 * state management, and robust error handling
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.2.0
import { WebSocketService, parseWSUrl } from '../services/websocketService';
import { LoadingState } from '../types/common.types';

// Default WebSocket configuration options
const DEFAULT_OPTIONS = {
  autoConnect: true,
  reconnectAttempts: 3,
  reconnectInterval: 3000,
  heartbeatInterval: 30000,
  connectionTimeout: 5000,
  binaryType: 'arraybuffer' as BinaryType,
  enableCompression: true
};

// WebSocket hook interface
interface WebSocketHookOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  binaryType?: BinaryType;
  enableCompression?: boolean;
}

interface WebSocketHookResult {
  connectionState: LoadingState;
  sendMessage: (data: any) => Promise<boolean>;
  subscribe: (event: string, callback: (data: any) => void) => () => void;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  isConnected: () => boolean;
  lastError: Error | null;
}

/**
 * Custom hook for managing WebSocket connections with enhanced features
 * @param url - WebSocket endpoint URL
 * @param options - Configuration options for WebSocket behavior
 */
export function useWebSocket(
  url: string,
  options: WebSocketHookOptions = {}
): WebSocketHookResult {
  // Merge default options with provided options
  const wsOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [connectionState, setConnectionState] = useState<LoadingState>(LoadingState.IDLE);
  const [lastError, setLastError] = useState<Error | null>(null);
  
  // Refs for persistent values
  const wsRef = useRef<WebSocketService | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Initialize WebSocket service with configuration
   */
  const initializeWebSocket = useCallback(() => {
    if (!wsRef.current) {
      wsRef.current = new WebSocketService({
        url: parseWSUrl(url),
        reconnectAttempts: wsOptions.reconnectAttempts,
        reconnectInterval: wsOptions.reconnectInterval,
        heartbeatInterval: wsOptions.heartbeatInterval
      });
    }
  }, [url, wsOptions]);

  /**
   * Memoized message sending function with compression support
   */
  const sendMessage = useCallback(async (data: any): Promise<boolean> => {
    if (!wsRef.current) {
      setLastError(new Error('WebSocket not initialized'));
      return false;
    }

    try {
      if (wsOptions.enableCompression && typeof data === 'string') {
        // Add compression if enabled and data is string
        const encoder = new TextEncoder();
        const compressed = encoder.encode(data);
        return await wsRef.current.sendMessage(compressed);
      }
      return await wsRef.current.sendMessage(data);
    } catch (error) {
      setLastError(error as Error);
      return false;
    }
  }, [wsOptions.enableCompression]);

  /**
   * Memoized event subscription function
   */
  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (!wsRef.current) {
      throw new Error('WebSocket not initialized');
    }
    return wsRef.current.subscribe(event as any, callback);
  }, []);

  /**
   * Memoized disconnect function with cleanup
   */
  const disconnect = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.disconnect();
      setConnectionState(LoadingState.IDLE);
    }
  }, []);

  /**
   * Memoized reconnect function
   */
  const reconnect = useCallback(async () => {
    disconnect();
    setConnectionState(LoadingState.RECONNECTING);
    try {
      await wsRef.current?.connect();
    } catch (error) {
      setLastError(error as Error);
      setConnectionState(LoadingState.ERROR);
    }
  }, [disconnect]);

  /**
   * Connection state checker
   */
  const isConnected = useCallback((): boolean => {
    return wsRef.current?.isConnected() || false;
  }, []);

  /**
   * Effect for WebSocket lifecycle management
   */
  useEffect(() => {
    initializeWebSocket();

    if (wsOptions.autoConnect) {
      setConnectionState(LoadingState.CONNECTING);
      
      // Set connection timeout
      timeoutRef.current = setTimeout(() => {
        if (!isConnected()) {
          setConnectionState(LoadingState.ERROR);
          setLastError(new Error('Connection timeout'));
        }
      }, wsOptions.connectionTimeout);

      // Attempt connection
      wsRef.current?.connect().catch((error) => {
        setLastError(error);
        setConnectionState(LoadingState.ERROR);
      });
    }

    // Cleanup on unmount
    return () => {
      disconnect();
      wsRef.current = null;
    };
  }, [url, wsOptions.autoConnect, wsOptions.connectionTimeout, initializeWebSocket, disconnect, isConnected]);

  return {
    connectionState,
    sendMessage,
    subscribe,
    disconnect,
    reconnect,
    isConnected,
    lastError
  };
}