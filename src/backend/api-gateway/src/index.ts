import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import cors from 'cors'; // ^2.8.5
import morgan from 'morgan'; // ^1.10.0
import compression from 'compression'; // ^1.7.4
import { OpenApiValidator } from 'express-openapi-validator'; // ^5.0.1
import pino from 'pino'; // ^8.14.1
import pinoHttp from 'express-pino-logger'; // ^7.0.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { kongConfig } from './config/kong.config';
import { authenticateRequest } from './middleware/auth.middleware';
import router from './routes';

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [];
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT || 30000;

// Initialize Pino logger
const logger = pino({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  }
});

// Initialize Circuit Breaker
const breaker = new CircuitBreaker(async (req: Request) => {
  // Circuit breaker logic for service calls
  return Promise.resolve();
}, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000
});

// Initialize Express application
const initializeApp = (): Express => {
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", ...CORS_ORIGINS]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // CORS configuration
  app.use(cors({
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    credentials: true,
    maxAge: 3600
  }));

  // Logging middleware
  app.use(morgan('combined'));
  app.use(pinoHttp({ logger }));

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
    next();
  });

  // OpenAPI validation
  new OpenApiValidator({
    apiSpec: './openapi.yaml',
    validateRequests: true,
    validateResponses: true
  }).install(app);

  // Authentication middleware
  app.use(authenticateRequest);

  // Mount API routes
  app.use('/api/v1', router);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION,
      environment: NODE_ENV
    });
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-request-id'] as string;
    
    logger.error({
      correlationId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });

    res.status(500).json({
      error: {
        message: 'Internal Server Error',
        correlationId,
        timestamp: new Date().toISOString()
      }
    });
  });

  return app;
};

// Server startup function
const startServer = async (app: Express): Promise<void> => {
  try {
    // Validate required configuration
    if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_AUDIENCE) {
      throw new Error('Missing required authentication configuration');
    }

    // Initialize service connections
    await Promise.all(kongConfig.services.map(async (service) => {
      try {
        await breaker.fire({ method: 'GET', url: `${service.protocol}://${service.host}:${service.port}/health` });
        logger.info(`Connected to service: ${service.name}`);
      } catch (error) {
        logger.error(`Failed to connect to service: ${service.name}`, error);
      }
    }));

    // Start server
    app.listen(PORT, () => {
      logger.info(`API Gateway started on port ${PORT} in ${NODE_ENV} mode`);
    });

    // Graceful shutdown handler
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Starting graceful shutdown...');
      // Implement graceful shutdown logic here
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize and start the application
const app = initializeApp();
startServer(app);

export { app };