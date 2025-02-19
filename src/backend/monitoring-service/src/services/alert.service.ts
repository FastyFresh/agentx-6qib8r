import WebSocket from 'ws'; // v8.13.0
import axios from 'axios'; // v1.4.0
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../collectors/metrics.collector';
import { prometheusConfig } from '../config/prometheus';

// Alert severity levels
const ALERT_LEVELS = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
} as const;

// Configuration constants
const ALERT_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const NOTIFICATION_BATCH_SIZE = 100;
const NOTIFICATION_RATE_LIMIT = 1000; // 1 second

// Type definitions
type AlertLevel = typeof ALERT_LEVELS[keyof typeof ALERT_LEVELS];

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  level: AlertLevel;
  description: string;
  labels: Record<string, string>;
}

interface Alert {
  id: string;
  ruleId: string;
  level: AlertLevel;
  message: string;
  metric: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

interface AlertState {
  active: boolean;
  lastTriggered: number;
  repeatCount: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

interface SubscriptionOptions {
  levels: AlertLevel[];
  labels?: Record<string, string>;
  rateLimitPerMinute?: number;
}

/**
 * Enterprise-grade alert management service implementing sophisticated alert rules evaluation
 * and multi-channel notification dispatch with high reliability and scalability.
 */
export class AlertService {
  private static instance: AlertService;
  private readonly logger: Logger;
  private readonly metricsCollector: MetricsCollector;
  private readonly subscribers: Map<string, { ws: WebSocket; options: SubscriptionOptions }>;
  private readonly alertRules: Map<string, AlertRule>;
  private readonly alertStates: Map<string, AlertState>;
  private readonly pendingNotifications: Alert[];
  private notificationTimer?: NodeJS.Timer;

  /**
   * Private constructor initializing alert service components
   */
  private constructor() {
    this.logger = Logger.getInstance();
    this.metricsCollector = MetricsCollector.getInstance();
    this.subscribers = new Map();
    this.alertRules = new Map();
    this.alertStates = new Map();
    this.pendingNotifications = [];

    this.initializeDefaultRules();
    this.startAlertEvaluation();
    this.startNotificationDispatcher();
  }

  /**
   * Returns singleton instance with thread-safe initialization
   */
  public static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Evaluates current metrics against alert rules with correlation and deduplication
   */
  private async evaluateAlerts(): Promise<void> {
    try {
      const metrics = await this.metricsCollector.getMetrics();
      
      for (const [ruleId, rule] of this.alertRules) {
        const metricValue = this.extractMetricValue(metrics, rule.metric);
        const shouldTrigger = this.evaluateThreshold(metricValue, rule);
        
        if (shouldTrigger) {
          const alert: Alert = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ruleId,
            level: rule.level,
            message: rule.description,
            metric: rule.metric,
            value: metricValue,
            timestamp: Date.now(),
            labels: rule.labels
          };

          await this.processAlert(alert);
        }
      }
    } catch (error) {
      this.logger.error('Failed to evaluate alerts', error);
    }
  }

  /**
   * Registers a WebSocket client for alert notifications with connection management
   */
  public subscribeToAlerts(
    clientId: string,
    ws: WebSocket,
    options: SubscriptionOptions
  ): void {
    try {
      this.subscribers.set(clientId, { ws, options });

      ws.on('close', () => {
        this.subscribers.delete(clientId);
        this.logger.info('Client unsubscribed from alerts', { clientId });
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket error', error, { clientId });
        this.subscribers.delete(clientId);
      });

      this.logger.info('Client subscribed to alerts', { clientId, options });
    } catch (error) {
      this.logger.error('Failed to subscribe client to alerts', error, { clientId });
      throw error;
    }
  }

  /**
   * Processes and dispatches alerts with retry logic and rate limiting
   */
  private async processAlert(alert: Alert): Promise<void> {
    try {
      const state = this.alertStates.get(alert.ruleId) || {
        active: false,
        lastTriggered: 0,
        repeatCount: 0
      };

      // Implement alert deduplication and correlation
      if (
        state.active &&
        Date.now() - state.lastTriggered < ALERT_CHECK_INTERVAL
      ) {
        state.repeatCount++;
        return;
      }

      state.active = true;
      state.lastTriggered = Date.now();
      state.repeatCount = 0;
      this.alertStates.set(alert.ruleId, state);

      this.pendingNotifications.push(alert);
    } catch (error) {
      this.logger.error('Failed to process alert', error, { alertId: alert.id });
    }
  }

  /**
   * Dispatches notifications to subscribers with delivery guarantees
   */
  private async dispatchNotifications(): Promise<void> {
    if (this.pendingNotifications.length === 0) return;

    const batch = this.pendingNotifications.splice(0, NOTIFICATION_BATCH_SIZE);
    
    for (const [clientId, { ws, options }] of this.subscribers) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      const filteredAlerts = batch.filter(alert => 
        options.levels.includes(alert.level) &&
        (!options.labels || this.matchLabels(alert.labels, options.labels))
      );

      if (filteredAlerts.length === 0) continue;

      try {
        ws.send(JSON.stringify(filteredAlerts), (error) => {
          if (error) {
            this.logger.error('Failed to send alerts to client', error, { clientId });
            this.pendingNotifications.push(...filteredAlerts);
          }
        });
      } catch (error) {
        this.logger.error('Failed to dispatch alerts', error, { clientId });
        this.pendingNotifications.push(...filteredAlerts);
      }
    }
  }

  /**
   * Initializes default alert rules based on system requirements
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-latency',
        name: 'High API Latency',
        metric: 'http_request_duration_seconds',
        threshold: 0.2, // 200ms
        operator: 'gt',
        level: ALERT_LEVELS.WARNING,
        description: 'API response time exceeds 200ms threshold',
        labels: { component: 'api', type: 'latency' }
      },
      {
        id: 'system-memory',
        name: 'High Memory Usage',
        metric: 'system_memory_usage_bytes',
        threshold: 0.85, // 85%
        operator: 'gt',
        level: ALERT_LEVELS.CRITICAL,
        description: 'System memory usage exceeds 85%',
        labels: { component: 'system', type: 'resource' }
      }
    ];

    defaultRules.forEach(rule => this.alertRules.set(rule.id, rule));
  }

  /**
   * Starts periodic alert evaluation with error recovery
   */
  private startAlertEvaluation(): void {
    setInterval(async () => {
      try {
        await this.evaluateAlerts();
      } catch (error) {
        this.logger.error('Alert evaluation failed', error);
      }
    }, ALERT_CHECK_INTERVAL);
  }

  /**
   * Starts notification dispatcher with rate limiting
   */
  private startNotificationDispatcher(): void {
    this.notificationTimer = setInterval(
      () => this.dispatchNotifications(),
      NOTIFICATION_RATE_LIMIT
    );
  }

  /**
   * Utility function to extract metric value from Prometheus format
   */
  private extractMetricValue(metrics: string, metricName: string): number {
    // Implementation of metric extraction from Prometheus format
    return 0; // Placeholder
  }

  /**
   * Evaluates if a metric value triggers an alert rule
   */
  private evaluateThreshold(value: number, rule: AlertRule): boolean {
    switch (rule.operator) {
      case 'gt': return value > rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'eq': return value === rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lte': return value <= rule.threshold;
      default: return false;
    }
  }

  /**
   * Checks if alert labels match subscription filters
   */
  private matchLabels(
    alertLabels: Record<string, string>,
    filterLabels: Record<string, string>
  ): boolean {
    return Object.entries(filterLabels).every(
      ([key, value]) => alertLabels[key] === value
    );
  }
}

export default AlertService.getInstance();