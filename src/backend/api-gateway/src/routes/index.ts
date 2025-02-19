import express, { Router, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import compression from 'compression'; // ^1.7.4
import { 
  authenticateRequest, 
  authorizeRole, 
  validateMfa 
} from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/ratelimit.middleware';
import { kongConfig } from '../config/kong.config';

// Initialize Express Router
const router: Router = express.Router();

// Redis Cluster Configuration
const redisConfig = {
  nodes: [
    { host: process.env.REDIS_HOST || 'localhost', port: 6379 }
  ],
  options: {
    maxRetries: 3,
    enableReadyCheck: true,
    scaleReads: 'slave'
  },
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
};

// Configure Global Middleware
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.API_URL]
    }
  }
}));

router.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
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

router.use(compression());

// Request Context Middleware
router.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  req.headers['x-request-timestamp'] = Date.now().toString();
  next();
});

// Configure Service Routes
setupAgentRoutes(router);
setupIntegrationRoutes(router);
setupMetricsRoutes(router);
setupUserRoutes(router);

// Health Check Endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.SERVICE_VERSION
  });
});

// Error Handling Middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-request-id'];
  console.error({
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

// Agent Service Routes Configuration
function setupAgentRoutes(router: Router): void {
  const agentRateLimiter = createRateLimiter('agent-service', redisConfig);
  const basePath = '/api/v1/agents';

  router.use(basePath, agentRateLimiter);
  router.use(basePath, authenticateRequest);

  router.get(basePath, 
    authorizeRole(['viewer', 'agent_manager', 'admin', 'super_admin']),
    forwardToService('agent-service')
  );

  router.post(basePath,
    authorizeRole(['agent_manager', 'admin', 'super_admin']),
    validateMfa,
    forwardToService('agent-service')
  );

  router.put(`${basePath}/:id`,
    authorizeRole(['agent_manager', 'admin', 'super_admin']),
    validateMfa,
    forwardToService('agent-service')
  );

  router.delete(`${basePath}/:id`,
    authorizeRole(['admin', 'super_admin']),
    validateMfa,
    forwardToService('agent-service')
  );
}

// Integration Service Routes Configuration
function setupIntegrationRoutes(router: Router): void {
  const integrationRateLimiter = createRateLimiter('integration-service', redisConfig);
  const basePath = '/api/v1/integrations';

  router.use(basePath, integrationRateLimiter);
  router.use(basePath, authenticateRequest);

  router.get(basePath,
    authorizeRole(['viewer', 'agent_manager', 'admin', 'super_admin']),
    forwardToService('integration-service')
  );

  router.post(basePath,
    authorizeRole(['admin', 'super_admin']),
    validateMfa,
    forwardToService('integration-service')
  );

  router.put(`${basePath}/:id`,
    authorizeRole(['admin', 'super_admin']),
    validateMfa,
    forwardToService('integration-service')
  );
}

// Metrics Service Routes Configuration
function setupMetricsRoutes(router: Router): void {
  const metricsRateLimiter = createRateLimiter('metrics-service', redisConfig);
  const basePath = '/api/v1/metrics';

  router.use(basePath, metricsRateLimiter);
  router.use(basePath, authenticateRequest);

  router.get(basePath,
    authorizeRole(['viewer', 'agent_manager', 'admin', 'super_admin']),
    forwardToService('metrics-service')
  );

  router.get(`${basePath}/aggregate`,
    authorizeRole(['admin', 'super_admin']),
    forwardToService('metrics-service')
  );
}

// User Service Routes Configuration
function setupUserRoutes(router: Router): void {
  const userRateLimiter = createRateLimiter('user-service', {
    ...redisConfig,
    options: { ...redisConfig.options, maxRetries: 5 }
  });
  const basePath = '/api/v1/users';

  router.use(basePath, userRateLimiter);
  router.use(basePath, authenticateRequest);

  router.get(`${basePath}/profile`,
    authorizeRole(['viewer', 'agent_manager', 'admin', 'super_admin']),
    forwardToService('user-service')
  );

  router.put(`${basePath}/profile`,
    authorizeRole(['viewer', 'agent_manager', 'admin', 'super_admin']),
    validateMfa,
    forwardToService('user-service')
  );
}

// Service Forwarding Helper
function forwardToService(serviceName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = kongConfig.services.find(s => s.name === serviceName);
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }

      // Forward request logic would go here
      // In production, this would use Kong's proxy
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default router;