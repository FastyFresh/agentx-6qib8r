// External dependencies
import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.0.0
import { createConnection, Connection } from 'typeorm'; // v0.3.17
import winston from 'winston'; // v3.10.0
import { Registry, collectDefaultMetrics } from 'prom-client'; // v14.2.0
import CircuitBreaker from 'opossum'; // v7.1.0

// Internal imports
import { config } from './config/config';
import { GeneratorService } from './services/generator.service';
import { Agent, AgentStatus, AgentType } from './models/Agent';

// Initialize Express application
const app: Express = express();

// Initialize Winston logger with correlation IDs
const logger = winston.createLogger({
  level: config.server.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.correlationId(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Initialize Prometheus metrics registry
const metrics = new Registry();
collectDefaultMetrics({ register: metrics });

// Custom metrics
const httpRequestDuration = new metrics.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new metrics.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Setup middleware
const setupMiddleware = (app: Express): void => {
  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.server.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  // Request parsing
  app.use(express.json({ limit: config.server.maxPayloadSize }));
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      httpRequestDuration.observe(
        { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
        duration / 1000
      );
      logger.info('Request processed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration
      });
    });
    next();
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  });
};

// Database connection with retry logic
const setupDatabase = async (): Promise<Connection> => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const connection = await createConnection({
        type: 'postgres',
        host: config.database.host,
        port: config.database.port,
        username: config.database.user,
        password: config.database.password,
        database: config.database.database,
        entities: [Agent],
        synchronize: config.server.nodeEnv === 'development',
        logging: config.server.nodeEnv === 'development'
      });

      logger.info('Database connection established');
      return connection;
    } catch (error) {
      retries++;
      logger.error(`Database connection failed (attempt ${retries}/${maxRetries})`, { error });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Failed to connect to database after maximum retries');
};

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});

// Metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', metrics.contentType);
    res.end(await metrics.metrics());
  } catch (error) {
    logger.error('Failed to collect metrics', { error });
    res.status(500).send('Failed to collect metrics');
  }
});

// Circuit breaker configuration
const breaker = new CircuitBreaker(async (req: Request) => {
  // Implementation for protected routes
}, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

breaker.on('open', () => {
  logger.warn('Circuit breaker opened');
});

breaker.on('close', () => {
  logger.info('Circuit breaker closed');
});

// Start server with comprehensive initialization
const startServer = async (): Promise<void> => {
  try {
    // Setup middleware
    setupMiddleware(app);

    // Initialize database connection
    const connection = await setupDatabase();

    // Initialize GeneratorService
    const generatorService = new GeneratorService(
      connection.getRepository(Agent),
      logger,
      metrics
    );

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info('Shutting down server...');
      
      // Close database connection
      await connection.close();
      
      // Close server
      server.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      logger.info(`Server started on port ${config.server.port}`);
    });

    // Track active connections
    server.on('connection', () => {
      activeConnections.inc();
    });

    server.on('close', () => {
      activeConnections.dec();
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
startServer().catch(error => {
  logger.error('Unhandled server startup error', { error });
  process.exit(1);
});

// Export app instance for testing
export { app };