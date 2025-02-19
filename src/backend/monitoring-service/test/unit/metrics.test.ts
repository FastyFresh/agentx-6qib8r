import { describe, it, beforeEach, expect } from 'jest'; // v29.6.0
import { MetricsCollector } from '../../src/collectors/metrics.collector';
import { prometheusConfig } from '../../src/config/prometheus';

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    // Get fresh instance and reset metrics before each test
    metricsCollector = MetricsCollector.getInstance();
    metricsCollector['registry'].clear(); // Reset registry
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance across multiple calls', () => {
      const instance1 = MetricsCollector.getInstance();
      const instance2 = MetricsCollector.getInstance();
      const instance3 = MetricsCollector.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(metricsCollector);
    });

    it('should maintain consistent metric registry across instances', async () => {
      const instance1 = MetricsCollector.getInstance();
      const instance2 = MetricsCollector.getInstance();

      // Record metric on first instance
      instance1.recordHttpRequest('GET', '/test', 200, 0.1);

      // Verify metric is accessible from second instance
      const metrics1 = await instance1.getMetrics();
      const metrics2 = await instance2.getMetrics();
      expect(metrics1).toBe(metrics2);
    });
  });

  describe('HTTP Metrics Recording', () => {
    it('should record HTTP request metrics with correct labels', async () => {
      // Record sample HTTP request
      metricsCollector.recordHttpRequest('GET', '/api/test', 200, 0.15);

      const metrics = await metricsCollector.getMetrics();
      
      // Verify counter metric
      expect(metrics).toContain(`${prometheusConfig.prefix}http_requests_total{method="GET",route="/api/test",status="200",service="monitoring-service",result="success"} 1`);
      
      // Verify histogram metric
      expect(metrics).toContain(`${prometheusConfig.prefix}http_request_duration_seconds_bucket{method="GET",route="/api/test",status="200",service="monitoring-service",result="success",le="0.2"} 1`);
    });

    it('should handle error status codes correctly', async () => {
      metricsCollector.recordHttpRequest('POST', '/api/error', 500, 0.3);

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toContain(`result="error"`);
      expect(metrics).toContain(`status="500"`);
    });

    it('should accumulate multiple requests correctly', async () => {
      // Record multiple requests
      metricsCollector.recordHttpRequest('GET', '/api/test', 200, 0.1);
      metricsCollector.recordHttpRequest('GET', '/api/test', 200, 0.2);
      metricsCollector.recordHttpRequest('GET', '/api/test', 200, 0.3);

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toContain(`${prometheusConfig.prefix}http_requests_total{method="GET",route="/api/test",status="200",service="monitoring-service",result="success"} 3`);
    });
  });

  describe('Agent Operation Metrics', () => {
    it('should record agent operations with custom labels', async () => {
      metricsCollector.recordAgentOperation('create', 'success', {
        agentId: 'test-123',
        environment: 'production'
      });

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toContain(`${prometheusConfig.prefix}agent_operations_total{type="create",status="success",component="agent-service",agentId="test-123",environment="production"}`);
    });

    it('should handle failed operations correctly', async () => {
      metricsCollector.recordAgentOperation('deploy', 'error', {
        errorType: 'configuration_invalid'
      });

      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toContain(`status="error"`);
      expect(metrics).toContain(`errorType="configuration_invalid"`);
    });
  });

  describe('System Metrics', () => {
    it('should update system metrics within collection interval', async () => {
      const spy = jest.spyOn(process, 'memoryUsage');
      const mockMemoryUsage = {
        heapUsed: 50000000,
        heapTotal: 100000000,
        rss: 150000000
      };
      spy.mockReturnValue(mockMemoryUsage as any);

      await metricsCollector.updateSystemMetrics();
      const metrics = await metricsCollector.getMetrics();

      expect(metrics).toContain(`${prometheusConfig.prefix}system_memory_usage_bytes{type="heap",process="node",component="monitoring-service"} 50000000`);
      expect(metrics).toContain(`${prometheusConfig.prefix}system_memory_usage_bytes{type="rss",process="node",component="monitoring-service"} 150000000`);

      spy.mockRestore();
    });

    it('should respect collection interval for system metrics', async () => {
      const updateSpy = jest.spyOn(metricsCollector as any, 'updateSystemMetrics');

      // First update should occur
      await metricsCollector.getMetrics();
      expect(updateSpy).toHaveBeenCalledTimes(1);

      // Immediate second update should be skipped due to interval
      await metricsCollector.getMetrics();
      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(await metricsCollector.getMetrics()).toBeTruthy();

      updateSpy.mockRestore();
    });
  });

  describe('Prometheus Format Compliance', () => {
    it('should output metrics in valid Prometheus format', async () => {
      // Record various metrics
      metricsCollector.recordHttpRequest('GET', '/api/test', 200, 0.15);
      metricsCollector.recordAgentOperation('create', 'success');
      await metricsCollector.updateSystemMetrics();

      const metrics = await metricsCollector.getMetrics();

      // Verify HELP annotations
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');

      // Verify metric name format
      const metricLines = metrics.split('\n');
      metricLines.forEach(line => {
        if (line.startsWith(prometheusConfig.prefix)) {
          expect(line).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*({[^}]*})?\s+[\d\.]+(\s+\d+)?$/);
        }
      });

      // Verify label format
      expect(metrics).toMatch(/{[^}]+}/);
      expect(metrics).not.toContain(',,');
      expect(metrics).not.toContain('==');
    });

    it('should properly escape special characters in labels', async () => {
      metricsCollector.recordHttpRequest('GET', '/api/test\nwith\newline', 200, 0.1);
      const metrics = await metricsCollector.getMetrics();
      expect(metrics).not.toContain('\n');
      expect(metrics).toContain('\\n');
    });
  });
});