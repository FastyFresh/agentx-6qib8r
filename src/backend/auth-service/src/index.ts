// @package-version express@4.18.2
// @package-version cors@2.8.5
// @package-version helmet@7.0.0
// @package-version morgan@1.10.0
// @package-version winston@3.10.0
// @package-version express-rate-limit@6.7.0

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import winston from 'winston';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';

import { auth0Config } from './config/auth0.config';
import { jwtAuthMiddleware } from './middleware/jwt.middleware';
import { AuthService } from './services/auth.service';

// Configure security-focused logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize Express application with security features
const initializeServer = (): Express => {
  const app = express();

  // Security middleware configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", `https://${auth0Config.domain}`],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration with strict origin validation
  app.use(cors({
    origin: auth0Config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Request size limits
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  // Rate limiting configuration
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development'
  });

  // Apply rate limiting to all routes
  app.use(limiter);

  // Security-focused request logging
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.path === '/health'
  }));

  return app;
};

// Configure authentication routes with security controls
const setupAuthRoutes = (app: Express): void => {
  const authService = new AuthService(null, null, null, null); // Dependencies injected in actual implementation

  // Login endpoint with rate limiting
  app.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const response = await authService.login(email, password, req.ip);
      res.json(response);
    } catch (error) {
      logger.error('Login failed', { error: error.message, requestId: req.id });
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Invalid credentials' });
    }
  });

  // Token refresh endpoint
  app.post('/auth/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      const response = await authService.refreshToken(refreshToken);
      res.json(response);
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message, requestId: req.id });
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Invalid refresh token' });
    }
  });

  // MFA setup endpoint
  app.post('/auth/mfa/setup', jwtAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const response = await authService.setupMFA(req.user.id);
      res.json(response);
    } catch (error) {
      logger.error('MFA setup failed', { error: error.message, requestId: req.id });
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'MFA setup failed' });
    }
  });

  // MFA verification endpoint
  app.post('/auth/mfa/verify', jwtAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const isValid = await authService.verifyMFA(req.user.id, token);
      res.json({ success: isValid });
    } catch (error) {
      logger.error('MFA verification failed', { error: error.message, requestId: req.id });
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid MFA token' });
    }
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
};

// Start server with monitoring and high availability
const startServer = async (app: Express): Promise<void> => {
  const port = process.env.PORT || 3001;

  try {
    setupAuthRoutes(app);

    // Global error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        requestId: req.id
      });

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'An unexpected error occurred'
      });
    });

    app.listen(port, () => {
      logger.info(`Auth service started on port ${port}`, {
        environment: process.env.NODE_ENV,
        port
      });
    });
  } catch (error) {
    logger.error('Server startup failed', { error: error.message });
    process.exit(1);
  }
};

// Initialize and start server
const app = initializeServer();
if (process.env.NODE_ENV !== 'test') {
  startServer(app);
}

export { app };