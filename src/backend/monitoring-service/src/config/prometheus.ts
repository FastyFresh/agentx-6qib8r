import { Registry, collectDefaultMetrics } from 'prom-client'; // v14.2.0

// Global configuration constants
export const DEFAULT_METRICS_PREFIX = 'agent_platform_';
export const DEFAULT_METRICS_INTERVAL = 10000; // 10 seconds in milliseconds

// Metric specifications with detailed configuration
export const prometheusConfig = {
  prefix: DEFAULT_METRICS_PREFIX,
  defaultInterval: DEFAULT_METRICS_INTERVAL,
  metricDefaults: {
    httpRequestDuration: {
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds with high-resolution tracking',
      labelNames: ['method', 'route', 'status', 'service', 'endpoint'],
      buckets: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 2, 5]
    },
    httpRequestsTotal: {
      name: 'http_requests_total',
      help: 'Total number of HTTP requests with detailed categorization',
      labelNames: ['method', 'route', 'status', 'service', 'result']
    },
    systemMemoryUsage: {
      name: 'system_memory_usage_bytes',
      help: 'Current system memory usage in bytes with process-level detail',
      labelNames: ['type', 'process', 'component']
    },
    systemCpuUsage: {
      name: 'system_cpu_usage_percent',
      help: 'Current CPU usage percentage with core-level tracking',
      labelNames: ['core', 'process', 'priority']
    },
    agentOperationsTotal: {
      name: 'agent_operations_total',
      help: 'Total number of agent operations with comprehensive tracking',
      labelNames: ['type', 'status', 'component', 'result', 'error_type']
    },
    agentResponseTime: {
      name: 'agent_response_time_seconds',
      help: 'Response time for agent operations with detailed performance tracking',
      labelNames: ['operation', 'status', 'component'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
    }
  }
};

/**
 * Configures and initializes Prometheus metrics collection with comprehensive settings
 * @returns Configured Prometheus registry instance
 */
export function configurePrometheus(): Registry {
  try {
    // Create new registry instance
    const registry = new Registry();

    // Configure default metrics collection with custom prefix
    collectDefaultMetrics({
      prefix: prometheusConfig.prefix,
      register: registry,
      timestamps: true,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // Optimized GC duration tracking
      eventLoopMonitoringPrecision: 10, // 10ms precision for event loop monitoring
    });

    // Initialize HTTP duration histogram
    registry.createHistogram({
      name: prometheusConfig.prefix + prometheusConfig.metricDefaults.httpRequestDuration.name,
      help: prometheusConfig.metricDefaults.httpRequestDuration.help,
      labelNames: prometheusConfig.metricDefaults.httpRequestDuration.labelNames,
      buckets: prometheusConfig.metricDefaults.httpRequestDuration.buckets
    });

    // Initialize HTTP requests counter
    registry.createCounter({
      name: prometheusConfig.prefix + prometheusConfig.metricDefaults.httpRequestsTotal.name,
      help: prometheusConfig.metricDefaults.httpRequestsTotal.help,
      labelNames: prometheusConfig.metricDefaults.httpRequestsTotal.labelNames
    });

    // Initialize system memory gauge
    registry.createGauge({
      name: prometheusConfig.prefix + prometheusConfig.metricDefaults.systemMemoryUsage.name,
      help: prometheusConfig.metricDefaults.systemMemoryUsage.help,
      labelNames: prometheusConfig.metricDefaults.systemMemoryUsage.labelNames
    });

    // Initialize CPU usage gauge
    registry.createGauge({
      name: prometheusConfig.prefix + prometheusConfig.metricDefaults.systemCpuUsage.name,
      help: prometheusConfig.metricDefaults.systemCpuUsage.help,
      labelNames: prometheusConfig.metricDefaults.systemCpuUsage.labelNames
    });

    // Initialize agent operations counter
    registry.createCounter({
      name: prometheusConfig.prefix + prometheusConfig.metricDefaults.agentOperationsTotal.name,
      help: prometheusConfig.metricDefaults.agentOperationsTotal.help,
      labelNames: prometheusConfig.metricDefaults.agentOperationsTotal.labelNames
    });

    // Initialize agent response time histogram
    registry.createHistogram({
      name: prometheusConfig.prefix + prometheusConfig.metricDefaults.agentResponseTime.name,
      help: prometheusConfig.metricDefaults.agentResponseTime.help,
      labelNames: prometheusConfig.metricDefaults.agentResponseTime.labelNames,
      buckets: prometheusConfig.metricDefaults.agentResponseTime.buckets
    });

    // Configure automatic metric cleanup
    registry.setDefaultLabels({
      app: 'agent_platform',
      environment: process.env.NODE_ENV || 'development'
    });

    return registry;
  } catch (error) {
    throw new Error(`Failed to configure Prometheus metrics: ${error.message}`);
  }
}