import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import compression from 'compression'; // v1.7.4
import { WebSocket, WebSocketServer } from 'ws'; // v8.13.0
import { configurePrometheus } from './config/prometheus';
import { Logger } from './utils/logger';
import { MetricsCollector } from './collectors/metrics.collector';
import { AlertService } from './services/alert.service';

// Environment variables with defaults
const PORT = process.env.PORT || 3003;
const WS_PORT = process.env.WS_PORT || 3004;
const SHUTDOWN_TIMEOUT = process.env.SHUTDOWN_TIMEOUT || 10000;

// Initialize core services
const logger = Logger.getInstance();
const metricsCollector = MetricsCollector.getInstance();
const alertService = AlertService.getInstance();

/**
 * Configures and initializes the HTTP server with security middleware
 */
function setupHttpServer(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400 // 24 hours
  }));
  app.use(compression());

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      metricsCollector.recordHttpRequest(
        req.method,
        req.path,
        res.statusCode,
        duration
      );
    });
    next();
  });

  // Metrics endpoint with caching
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await metricsCollector.getMetrics();
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(metrics);
    } catch (error) {
      logger.error('Failed to retrieve metrics', error as Error);
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      uptime: process.uptime()
    });
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
      error: 'Internal server error',
      requestId: req.headers['x-request-id']
    });
  });

  return app;
}

/**
 * Configures and initializes the WebSocket server for alerts
 */
function setupWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({
    port: Number(WS_PORT),
    clientTracking: true,
    perMessageDeflate: true
  });

  wss.on('connection', (ws: WebSocket, req: Request) => {
    const clientId = req.headers['x-client-id']?.toString() || 
                    `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('New WebSocket connection established', { clientId });

    alertService.subscribeToAlerts(clientId, ws, {
      levels: ['CRITICAL', 'WARNING'],
      rateLimitPerMinute: 60
    });

    // Heartbeat mechanism
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
      logger.info('WebSocket connection closed', { clientId });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', error as Error, { clientId });
    });
  });

  return wss;
}

/**
 * Initializes and starts all monitoring service components
 */
async function startServer(): Promise<void> {
  try {
    // Initialize Prometheus metrics
    configurePrometheus();

    // Start HTTP server
    const app = setupHttpServer();
    const httpServer = app.listen(PORT, () => {
      logger.info('HTTP server started', { port: PORT });
    });

    // Start WebSocket server
    const wss = setupWebSocketServer();
    logger.info('WebSocket server started', { port: WS_PORT });

    // Register shutdown handlers
    const shutdown = async (signal: NodeJS.Signals) => {
      await gracefulShutdown(signal, httpServer, wss);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Export Express app for testing
    export const app = app;
  } catch (error) {
    logger.error('Failed to start monitoring service', error as Error);
    process.exit(1);
  }
}

/**
 * Handles graceful shutdown of all service components
 */
async function gracefulShutdown(
  signal: NodeJS.Signals,
  httpServer: any,
  wss: WebSocketServer
): Promise<void> {
  logger.info('Initiating graceful shutdown', { signal });

  // Set shutdown timeout
  const shutdownTimer = setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, Number(SHUTDOWN_TIMEOUT));

  try {
    // Stop accepting new connections
    httpServer.close();
    
    // Close WebSocket connections
    wss.clients.forEach((client) => {
      client.close(1000, 'Server shutting down');
    });
    wss.close();

    // Stop metrics collection and alert processing
    await Promise.all([
      metricsCollector.stopCollection(),
      alertService.stopAlertProcessing()
    ]);

    clearTimeout(shutdownTimer);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
}

// Start the monitoring service
startServer().catch((error) => {
  logger.error('Fatal error starting monitoring service', error as Error);
  process.exit(1);
});