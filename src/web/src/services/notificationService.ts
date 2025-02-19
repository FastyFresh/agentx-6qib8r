/**
 * Notification Service Implementation
 * Manages system-wide notifications with support for real-time updates,
 * prioritization, and delivery confirmation
 * @version 1.0.0
 */

import EventEmitter from 'events'; // ^3.3.0
import { WebSocketService } from './websocketService';
import { httpClient } from './httpClient';
import { Severity } from '../types/common.types';

// Notification event types
export const NOTIFICATION_EVENTS = {
  NEW_NOTIFICATION: 'new_notification',
  CLEAR_NOTIFICATION: 'clear_notification',
  UPDATE_NOTIFICATION: 'update_notification',
  BATCH_NOTIFICATION: 'batch_notification',
  NOTIFICATION_DELIVERED: 'notification_delivered',
  NOTIFICATION_FAILED: 'notification_failed'
} as const;

// Configuration constants
const MAX_NOTIFICATIONS = 100;
const NOTIFICATION_BATCH_SIZE = 10;
const NOTIFICATION_RETRY_ATTEMPTS = 3;

// Notification interfaces
interface Notification {
  id: string;
  message: string;
  severity: Severity;
  category?: string;
  timestamp: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
  isRead?: boolean;
}

interface NotificationCategory {
  name: string;
  priority: number;
  retentionPeriod: number;
}

interface NotificationMetrics {
  delivered: number;
  failed: number;
  averageDeliveryTime: number;
}

interface PendingNotification {
  notification: Notification;
  attempts: number;
  priority: number;
}

class NotificationQueue {
  private items: PendingNotification[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  enqueue(item: PendingNotification): boolean {
    if (this.items.length >= this.maxSize) {
      // Remove lowest priority notification if queue is full
      const lowestPriorityIndex = this.items.reduce((lowest, current, index, arr) => 
        current.priority < arr[lowest].priority ? index : lowest, 0);
      this.items.splice(lowestPriorityIndex, 1);
    }

    // Insert based on priority
    const insertIndex = this.items.findIndex(existing => existing.priority < item.priority);
    if (insertIndex === -1) {
      this.items.push(item);
    } else {
      this.items.splice(insertIndex, 0, item);
    }
    return true;
  }

  dequeue(): PendingNotification | undefined {
    return this.items.shift();
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * NotificationService class
 * Manages system-wide notifications with enhanced delivery tracking and offline support
 */
class NotificationService {
  private readonly eventEmitter: EventEmitter;
  private readonly wsService: WebSocketService;
  private readonly notifications: Notification[] = [];
  private readonly categories: Map<string, NotificationCategory> = new Map();
  private readonly notificationQueue: NotificationQueue;
  private readonly deliveryMetrics: Map<string, NotificationMetrics> = new Map();
  private processingInterval?: NodeJS.Timeout;

  constructor(wsService: WebSocketService) {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(20); // Increase max listeners for high-traffic scenarios
    this.wsService = wsService;
    this.notificationQueue = new NotificationQueue(MAX_NOTIFICATIONS);

    // Initialize default categories
    this.initializeCategories();
    
    // Set up WebSocket subscriptions
    this.setupWebSocketHandlers();
    
    // Start notification processor
    this.startNotificationProcessor();
  }

  /**
   * Adds a new notification with priority handling and delivery tracking
   */
  public async addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<void> {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      isRead: false,
      ...notification
    };

    const priority = this.calculatePriority(newNotification);
    const pendingNotification: PendingNotification = {
      notification: newNotification,
      attempts: 0,
      priority
    };

    this.notificationQueue.enqueue(pendingNotification);
    this.eventEmitter.emit(NOTIFICATION_EVENTS.NEW_NOTIFICATION, newNotification);
  }

  /**
   * Retrieves all active notifications
   */
  public getNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Marks a notification as read
   */
  public async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      this.eventEmitter.emit(NOTIFICATION_EVENTS.UPDATE_NOTIFICATION, notification);
      await this.syncNotificationState(notification);
    }
  }

  /**
   * Removes a notification
   */
  public async removeNotification(notificationId: string): Promise<void> {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      const [notification] = this.notifications.splice(index, 1);
      this.eventEmitter.emit(NOTIFICATION_EVENTS.CLEAR_NOTIFICATION, notification);
      await this.syncNotificationState(notification, true);
    }
  }

  /**
   * Subscribes to notification events
   */
  public subscribe(
    event: keyof typeof NOTIFICATION_EVENTS,
    callback: (notification: Notification) => void
  ): () => void {
    this.eventEmitter.on(event, callback);
    return () => this.eventEmitter.off(event, callback);
  }

  /**
   * Clears all notifications
   */
  public async clearAll(): Promise<void> {
    this.notifications.length = 0;
    this.eventEmitter.emit(NOTIFICATION_EVENTS.BATCH_NOTIFICATION, []);
    await httpClient.post('/api/v1/notifications/clear', {});
  }

  private initializeCategories(): void {
    this.categories.set('system', { name: 'system', priority: 100, retentionPeriod: 24 * 60 * 60 * 1000 });
    this.categories.set('security', { name: 'security', priority: 90, retentionPeriod: 7 * 24 * 60 * 60 * 1000 });
    this.categories.set('performance', { name: 'performance', priority: 80, retentionPeriod: 12 * 60 * 60 * 1000 });
    this.categories.set('general', { name: 'general', priority: 50, retentionPeriod: 24 * 60 * 60 * 1000 });
  }

  private setupWebSocketHandlers(): void {
    this.wsService.subscribe('message', (data: any) => {
      if (data.type === 'notification') {
        this.handleWebSocketNotification(data.payload);
      }
    });
  }

  private startNotificationProcessor(): void {
    this.processingInterval = setInterval(() => {
      this.processNotificationQueue();
    }, 1000);
  }

  private async processNotificationQueue(): Promise<void> {
    while (this.notificationQueue.size > 0) {
      const pending = this.notificationQueue.dequeue();
      if (!pending) break;

      try {
        await this.deliverNotification(pending.notification);
        this.updateDeliveryMetrics(pending.notification.id, true);
        this.eventEmitter.emit(NOTIFICATION_EVENTS.NOTIFICATION_DELIVERED, pending.notification);
      } catch (error) {
        this.handleDeliveryFailure(pending);
      }
    }
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    this.notifications.unshift(notification);
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications.pop();
    }

    await this.wsService.sendMessage({
      type: 'notification',
      payload: notification
    });
  }

  private handleDeliveryFailure(pending: PendingNotification): void {
    if (pending.attempts < NOTIFICATION_RETRY_ATTEMPTS) {
      pending.attempts++;
      this.notificationQueue.enqueue(pending);
    } else {
      this.updateDeliveryMetrics(pending.notification.id, false);
      this.eventEmitter.emit(NOTIFICATION_EVENTS.NOTIFICATION_FAILED, pending.notification);
    }
  }

  private calculatePriority(notification: Notification): number {
    const category = this.categories.get(notification.category || 'general');
    const severityWeight = {
      [Severity.ERROR]: 40,
      [Severity.WARNING]: 30,
      [Severity.INFO]: 20,
      [Severity.SUCCESS]: 10
    };

    return (category?.priority || 50) + (severityWeight[notification.severity] || 0);
  }

  private updateDeliveryMetrics(notificationId: string, success: boolean): void {
    const metrics = this.deliveryMetrics.get(notificationId) || {
      delivered: 0,
      failed: 0,
      averageDeliveryTime: 0
    };

    if (success) {
      metrics.delivered++;
    } else {
      metrics.failed++;
    }

    this.deliveryMetrics.set(notificationId, metrics);
  }

  private async syncNotificationState(notification: Notification, isRemoved = false): Promise<void> {
    try {
      await httpClient.post('/api/v1/notifications/sync', {
        notificationId: notification.id,
        isRead: notification.isRead,
        isRemoved
      });
    } catch (error) {
      console.error('Failed to sync notification state:', error);
    }
  }

  private handleWebSocketNotification(payload: any): void {
    if (payload.action === 'add') {
      this.addNotification(payload.notification);
    } else if (payload.action === 'remove') {
      this.removeNotification(payload.notificationId);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService(new WebSocketService());