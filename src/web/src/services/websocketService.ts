/**
 * WebSocket Service Implementation
 * Provides real-time communication capabilities with enhanced reliability features
 * @version 1.0.0
 */

import EventEmitter from 'events'; // ^3.3.0
import { apiConfig } from '../config/api.config';
import { LoadingState } from '../types/common.types';

// WebSocket configuration constants
const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_INTERVAL = 3000;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;
const DEFAULT_MESSAGE_QUEUE_SIZE = 100;

// WebSocket event types
const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat'
} as const;

// Message queue implementation for handling disconnections
class Queue<T> {
  private items: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  enqueue(item: T): boolean {
    if (this.items.length >= this.maxSize) {
      return false;
    }
    this.items.push(item);
    return true;
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  clear(): void {
    this.items = [];
  }

  get size(): number {
    return this.items.length;
  }
}

// WebSocket message interface
interface Message {
  type: string;
  payload: any;
  timestamp: number;
}

// WebSocket configuration options
interface WebSocketOptions {
  url?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
}

/**
 * Converts HTTP/HTTPS URL to WebSocket URL (ws/wss)
 * @param url - The HTTP(S) URL to convert
 * @returns WebSocket URL
 */
export const parseWSUrl = (url: string): string => {
  if (!url) throw new Error('URL is required');
  return url.replace(/^http/, 'ws').replace(/^https/, 'wss');
};

/**
 * WebSocket service with enhanced reliability features
 * Handles real-time communication, connection management, and health monitoring
 */
export class WebSocketService {
  private socket: WebSocket | null = null;
  private readonly eventEmitter: EventEmitter;
  private connectionState: LoadingState = LoadingState.IDLE;
  private reconnectAttempts: number;
  private reconnectInterval: number;
  private heartbeatInterval: number;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly url: string;
  private readonly messageQueue: Queue<Message>;
  private lastHeartbeat: number = 0;

  constructor(options: WebSocketOptions = {}) {
    this.eventEmitter = new EventEmitter();
    this.url = parseWSUrl(options.url || apiConfig.baseURL);
    this.reconnectAttempts = options.reconnectAttempts || DEFAULT_RECONNECT_ATTEMPTS;
    this.reconnectInterval = options.reconnectInterval || DEFAULT_RECONNECT_INTERVAL;
    this.heartbeatInterval = options.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL;
    this.messageQueue = new Queue<Message>(options.messageQueueSize || DEFAULT_MESSAGE_QUEUE_SIZE);
  }

  /**
   * Establishes WebSocket connection with error handling and health monitoring
   */
  public async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.connectionState = LoadingState.LOADING;

    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        this.connectionState = LoadingState.SUCCESS;
        this.lastHeartbeat = Date.now();
        this.startHeartbeat();
        this.eventEmitter.emit(WS_EVENTS.CONNECT);
        this.processQueuedMessages();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === WS_EVENTS.HEARTBEAT) {
            this.lastHeartbeat = Date.now();
          }
          this.eventEmitter.emit(WS_EVENTS.MESSAGE, message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        this.handleDisconnection();
      };

      this.socket.onerror = (error: Event) => {
        this.connectionState = LoadingState.ERROR;
        this.eventEmitter.emit(WS_EVENTS.ERROR, error);
      };

    } catch (error) {
      this.connectionState = LoadingState.ERROR;
      throw new Error(`WebSocket connection failed: ${error}`);
    }
  }

  /**
   * Gracefully closes WebSocket connection with cleanup
   */
  public disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.messageQueue.clear();
    this.connectionState = LoadingState.IDLE;
    this.eventEmitter.emit(WS_EVENTS.DISCONNECT);
  }

  /**
   * Sends message through WebSocket with queuing and retry logic
   * @param data - Message data to send
   * @returns Promise resolving to send success status
   */
  public async sendMessage(data: any): Promise<boolean> {
    const message: Message = {
      type: WS_EVENTS.MESSAGE,
      payload: data,
      timestamp: Date.now()
    };

    if (this.socket?.readyState !== WebSocket.OPEN) {
      return this.messageQueue.enqueue(message);
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return this.messageQueue.enqueue(message);
    }
  }

  /**
   * Subscribes to WebSocket events with type safety
   * @param event - Event type to subscribe to
   * @param callback - Event handler function
   * @returns Unsubscribe function
   */
  public subscribe(event: keyof typeof WS_EVENTS, callback: (data: any) => void): () => void {
    this.eventEmitter.on(event, callback);
    return () => this.eventEmitter.off(event, callback);
  }

  /**
   * Processes messages queued during disconnection
   */
  private async processQueuedMessages(): Promise<void> {
    while (this.socket?.readyState === WebSocket.OPEN && this.messageQueue.size > 0) {
      const message = this.messageQueue.dequeue();
      if (message) {
        await this.sendMessage(message.payload);
      }
    }
  }

  /**
   * Handles disconnection with reconnection logic
   */
  private handleDisconnection(): void {
    this.stopHeartbeat();
    this.connectionState = LoadingState.ERROR;
    this.eventEmitter.emit(WS_EVENTS.DISCONNECT);

    if (this.reconnectAttempts > 0) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts--;
        this.connect().catch(console.error);
      }, this.reconnectInterval);
    }
  }

  /**
   * Starts heartbeat mechanism for connection health monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: WS_EVENTS.HEARTBEAT }));
        
        // Check if heartbeat response is overdue
        if (Date.now() - this.lastHeartbeat > this.heartbeatInterval * 2) {
          this.handleDisconnection();
        }
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stops heartbeat mechanism and cleans up timers
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}