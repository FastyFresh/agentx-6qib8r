import { Registry, Counter, Histogram, Gauge, MetricAggregator } from 'prom-client'; // v14.2.0
import { prometheusConfig } from '../config/prometheus';
import { Logger } from '../utils/logger';

/**
 * High-performance singleton metrics collector for system-wide monitoring
 * with optimized collection, buffering, and Prometheus integration.
 */
export class MetricsCollector {
  private static instance: MetricsCollector;
  private readonly registry: Registry;
  private readonly logger: Logger;
  private readonly metricBuffers: Map<string, MetricAggregator>;
  private lastCollectionTimestamp: number;
  private readonly collectionInterval: number = 10000; // 10 seconds

  // Prometheus metrics
  private readonly httpRequestsCounter: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly systemMemoryUsage: Gauge;
  private readonly systemCpuUsage: Gauge;
  private readonly agentOperationsCounter: Counter;

  /**
   * Private constructor initializing Prometheus metrics and buffers
   */
  private constructor() {
    this.registry = new Registry();
    this.logger = Logger.getInstance();
    this.metricBuffers = new Map();
    this.lastCollectionTimestamp = Date.now();

    // Initialize HTTP metrics
    this.httpRequestsCounter = new Counter({
      name: `${prometheusConfig.prefix}${prometheusConfig.metricDefaults.httpRequestsTotal.name}`,
      help: prometheusConfig.metricDefaults.httpRequestsTotal.help,
      labelNames: prometheusConfig.metricDefaults.httpRequestsTotal.labelNames,
      registers: [this.registry]
    });

    this.httpRequestDuration = new Histogram({
      name: `${prometheusConfig.prefix}${prometheusConfig.metricDefaults.httpRequestDuration.name}`,
      help: prometheusConfig.metricDefaults.httpRequestDuration.help,
      labelNames: prometheusConfig.metricDefaults.httpRequestDuration.labelNames,
      buckets: prometheusConfig.metricDefaults.httpRequestDuration.buckets,
      registers: [this.registry]
    });

    // Initialize system metrics
    this.systemMemoryUsage = new Gauge({
      name: `${prometheusConfig.prefix}${prometheusConfig.metricDefaults.systemMemoryUsage.name}`,
      help: prometheusConfig.metricDefaults.systemMemoryUsage.help,
      labelNames: prometheusConfig.metricDefaults.systemMemoryUsage.labelNames,
      registers: [this.registry]
    });

    this.systemCpuUsage = new Gauge({
      name: `${prometheusConfig.prefix}${prometheusConfig.metricDefaults.systemCpuUsage.name}`,
      help: prometheusConfig.metricDefaults.systemCpuUsage.help,
      labelNames: prometheusConfig.metricDefaults.systemCpuUsage.labelNames,
      registers: [this.registry]
    });

    // Initialize agent metrics
    this.agentOperationsCounter = new Counter({
      name: `${prometheusConfig.prefix}${prometheusConfig.metricDefaults.agentOperationsTotal.name}`,
      help: prometheusConfig.metricDefaults.agentOperationsTotal.help,
      labelNames: prometheusConfig.metricDefaults.agentOperationsTotal.labelNames,
      registers: [this.registry]
    });

    this.initializeMetricBuffers();
  }

  /**
   * Returns singleton instance with thread-safe initialization
   */
  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Records HTTP request metrics with high-performance buffering
   */
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    try {
      const labels = {
        method,
        route,
        status: statusCode.toString(),
        service: 'monitoring-service',
        result: statusCode < 400 ? 'success' : 'error'
      };

      this.httpRequestsCounter.inc(labels);
      this.httpRequestDuration.observe(labels, duration);

      this.logger.debug('HTTP request metric recorded', {
        method,
        route,
        statusCode,
        duration
      });
    } catch (error) {
      this.logger.error('Failed to record HTTP request metric', error);
    }
  }

  /**
   * Records agent operation metrics with detailed tracking
   */
  public recordAgentOperation(
    operationType: string,
    status: string,
    additionalLabels: Record<string, string> = {}
  ): void {
    try {
      const labels = {
        type: operationType,
        status,
        component: 'agent-service',
        ...additionalLabels
      };

      this.agentOperationsCounter.inc(labels);

      this.logger.debug('Agent operation metric recorded', {
        operationType,
        status,
        additionalLabels
      });
    } catch (error) {
      this.logger.error('Failed to record agent operation metric', error);
    }
  }

  /**
   * Updates system resource metrics with optimized collection
   */
  public async updateSystemMetrics(): Promise<void> {
    try {
      const currentTime = Date.now();
      if (currentTime - this.lastCollectionTimestamp < this.collectionInterval) {
        return;
      }

      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Update memory metrics
      this.systemMemoryUsage.set(
        { type: 'heap', process: 'node', component: 'monitoring-service' },
        memoryUsage.heapUsed
      );
      this.systemMemoryUsage.set(
        { type: 'rss', process: 'node', component: 'monitoring-service' },
        memoryUsage.rss
      );

      // Update CPU metrics
      this.systemCpuUsage.set(
        { core: 'total', process: 'node', priority: 'normal' },
        (cpuUsage.user + cpuUsage.system) / 1000000
      );

      this.lastCollectionTimestamp = currentTime;

      this.logger.debug('System metrics updated', {
        memoryUsage,
        cpuUsage,
        timestamp: currentTime
      });
    } catch (error) {
      this.logger.error('Failed to update system metrics', error);
    }
  }

  /**
   * Retrieves current metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    try {
      await this.updateSystemMetrics();
      return await this.registry.metrics();
    } catch (error) {
      this.logger.error('Failed to get metrics', error);
      throw error;
    }
  }

  /**
   * Initializes metric buffers for high-throughput collection
   */
  private initializeMetricBuffers(): void {
    try {
      // Initialize buffers for high-throughput metrics
      this.metricBuffers.set('http_requests', new MetricAggregator());
      this.metricBuffers.set('agent_operations', new MetricAggregator());

      // Set up periodic buffer flushing
      setInterval(() => this.flushMetricBuffers(), 5000);
    } catch (error) {
      this.logger.error('Failed to initialize metric buffers', error);
    }
  }

  /**
   * Flushes metric buffers to Prometheus registry
   */
  private flushMetricBuffers(): void {
    try {
      for (const [name, buffer] of this.metricBuffers) {
        buffer.flush();
      }
      this.logger.debug('Metric buffers flushed');
    } catch (error) {
      this.logger.error('Failed to flush metric buffers', error);
    }
  }
}