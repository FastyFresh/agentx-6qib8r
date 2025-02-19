import { Request, Response, NextFunction, RequestHandler } from 'express'; // ^4.18.2
import { expressjwt, GetVerificationKey } from 'express-jwt'; // ^8.4.1
import jwksRsa from 'jwks-rsa'; // ^3.0.1
import { ManagementClient } from 'auth0'; // ^4.0.0
import { createClient } from 'redis'; // ^4.6.7
import { kongConfig } from '../config/kong.config';

// Constants for Auth Configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN!;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE!;
const REDIS_URL = process.env.REDIS_URL!;

// Initialize Auth0 Management Client
const auth0Client = new ManagementClient({
  domain: AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

// Initialize Redis Client
const redisClient = createClient({ url: REDIS_URL });
redisClient.connect().catch(console.error);

// JWKS Client for JWT Verification
const jwksClient = jwksRsa.expressJwtSecret({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
}) as GetVerificationKey;

// Role Hierarchy Definition
const ROLE_HIERARCHY = {
  'super_admin': ['admin', 'agent_manager', 'viewer'],
  'admin': ['agent_manager', 'viewer'],
  'agent_manager': ['viewer'],
  'viewer': []
};

// Enhanced JWT Authentication Middleware
export const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // JWT Validation Middleware
    const jwtCheck = expressjwt({
      secret: jwksClient,
      audience: AUTH0_AUDIENCE,
      issuer: `https://${AUTH0_DOMAIN}/`,
      algorithms: ['RS256'],
      requestProperty: 'user'
    });

    // Execute JWT Check
    await new Promise((resolve, reject) => {
      jwtCheck(req, res, (err) => {
        if (err) reject(err);
        resolve(true);
      });
    });

    // Prevent Token Replay
    const jti = (req.user as any).jti;
    const usedToken = await redisClient.get(`used_token:${jti}`);
    if (usedToken) {
      throw new Error('Token has been used previously');
    }
    await redisClient.set(`used_token:${jti}`, '1', { EX: 86400 }); // 24h expiry

    // Enhance User Context
    const userId = (req.user as any).sub;
    const userInfo = await auth0Client.getUser({ id: userId });
    
    // Attach Enhanced User Context
    req.user = {
      ...req.user,
      roles: userInfo.app_metadata?.roles || [],
      permissions: userInfo.app_metadata?.permissions || [],
      mfa_enabled: userInfo.multifactor?.length > 0,
      last_login: userInfo.last_login,
      login_count: userInfo.logins_count
    };

    next();
  } catch (error) {
    handleAuthError(error as Error, req, res, next);
  }
};

// Role-Based Authorization Middleware
export const authorizeRole = (
  allowedRoles: string[],
  requiredPermissions: string[] = []
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRoles = (req.user as any)?.roles || [];
      const userPermissions = (req.user as any)?.permissions || [];

      // Check Role Hierarchy
      const hasValidRole = allowedRoles.some(role => 
        userRoles.some(userRole => 
          userRole === role || ROLE_HIERARCHY[userRole]?.includes(role)
        )
      );

      // Validate Permissions
      const hasRequiredPermissions = requiredPermissions.every(
        permission => userPermissions.includes(permission)
      );

      if (!hasValidRole || !hasRequiredPermissions) {
        throw new Error('Insufficient permissions');
      }

      // Log Access Attempt
      const accessLog = {
        userId: (req.user as any).sub,
        timestamp: new Date().toISOString(),
        resource: req.path,
        method: req.method,
        roles: userRoles,
        allowed: true
      };
      await redisClient.xAdd('access_log', '*', accessLog);

      next();
    } catch (error) {
      handleAuthError(error as Error, req, res, next);
    }
  };
};

// MFA Validation Middleware
export const validateMfa = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const operation = req.path;

    // Check if operation requires MFA
    const mfaRequired = kongConfig.services.some(service => 
      service.routes.some(route => 
        route.paths.includes(operation) && 
        route.methods.includes(req.method)
      )
    );

    if (mfaRequired) {
      // Check MFA Status
      const mfaStatus = await redisClient.get(`mfa:${user.sub}`);
      
      if (!mfaStatus || Date.now() - parseInt(mfaStatus) > 3600000) { // 1 hour expiry
        res.status(401).json({
          error: 'MFA_REQUIRED',
          message: 'Multi-factor authentication required',
          details: {
            supported_methods: ['totp', 'sms', 'webauthn'],
            verification_endpoint: '/api/v1/auth/mfa/verify'
          }
        });
        return;
      }
    }

    next();
  } catch (error) {
    handleAuthError(error as Error, req, res, next);
  }
};

// Enhanced Error Handler
export const handleAuthError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = req.headers['x-request-id'] || crypto.randomUUID();

  // Log Error
  console.error({
    correlationId,
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    user: (req.user as any)?.sub,
    path: req.path,
    method: req.method
  });

  // Format Error Response
  const errorResponse = {
    error: {
      type: error.name,
      message: error.message,
      code: getErrorCode(error),
      correlation_id: correlationId
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    resolution_steps: getResolutionSteps(error)
  };

  // Set Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Correlation-ID', correlationId);

  // Send Response
  res.status(getHttpStatus(error)).json(errorResponse);
};

// Helper Functions
const getErrorCode = (error: Error): string => {
  switch (error.name) {
    case 'UnauthorizedError': return 'AUTH001';
    case 'TokenExpiredError': return 'AUTH002';
    case 'JsonWebTokenError': return 'AUTH003';
    case 'InsufficientScopeError': return 'AUTH004';
    default: return 'AUTH999';
  }
};

const getHttpStatus = (error: Error): number => {
  switch (error.name) {
    case 'UnauthorizedError': return 401;
    case 'TokenExpiredError': return 401;
    case 'InsufficientScopeError': return 403;
    default: return 500;
  }
};

const getResolutionSteps = (error: Error): string[] => {
  switch (error.name) {
    case 'TokenExpiredError':
      return [
        'Obtain a new access token',
        'Ensure your system clock is synchronized',
        'Contact support if the issue persists'
      ];
    case 'UnauthorizedError':
      return [
        'Check your authentication credentials',
        'Verify your token is valid',
        'Ensure you have the required permissions'
      ];
    default:
      return ['Contact support for assistance'];
  }
};