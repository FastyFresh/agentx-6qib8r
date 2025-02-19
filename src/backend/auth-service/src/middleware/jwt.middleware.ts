// @package-version express@4.18.2
// @package-version jwt-decode@3.1.2
// @package-version http-status-codes@2.2.0
// @package-version rate-limiter-flexible@2.4.1
// @package-version winston@3.8.2

import { Request, Response, NextFunction } from 'express';
import { decode } from 'jwt-decode';
import { StatusCodes } from 'http-status-codes';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import winston from 'winston';
import { auth0Config } from '../config/auth0.config';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/User';

// Configure rate limiter for token validation
const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per minute
});

// Configure security logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log' })
  ]
});

interface DecodedToken {
  sub: string;
  email: string;
  role: UserRole;
  mfa_enabled: boolean;
  exp: number;
  iss: string;
  aud: string;
}

/**
 * Extracts JWT token from request headers
 * @param req Express request object
 * @returns Extracted token or null if not found/invalid
 */
const extractTokenFromHeader = (req: Request): string | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.length < 10) { // Basic length validation
      return null;
    }

    securityLogger.debug('Token extracted from request', {
      requestId: req.id,
      ipAddress: req.ip
    });

    return token;
  } catch (error) {
    securityLogger.error('Token extraction failed', {
      error: error.message,
      requestId: req.id,
      ipAddress: req.ip
    });
    return null;
  }
};

/**
 * Validates JWT token claims
 * @param token Decoded token object
 * @returns Promise resolving to boolean indicating validity
 */
const validateTokenClaims = async (token: DecodedToken): Promise<boolean> => {
  try {
    // Verify issuer
    if (token.iss !== auth0Config.issuerBaseURL) {
      securityLogger.warn('Invalid token issuer', { issuer: token.iss });
      return false;
    }

    // Verify audience
    if (token.aud !== auth0Config.audience) {
      securityLogger.warn('Invalid token audience', { audience: token.aud });
      return false;
    }

    // Check expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (token.exp <= currentTime) {
      securityLogger.warn('Token expired', { 
        expiration: new Date(token.exp * 1000).toISOString() 
      });
      return false;
    }

    return true;
  } catch (error) {
    securityLogger.error('Token claim validation failed', { error: error.message });
    return false;
  }
};

/**
 * Express middleware for JWT token validation with enhanced security features
 */
export const jwtAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Apply rate limiting
    try {
      await rateLimiter.consume(req.ip);
    } catch (error) {
      securityLogger.warn('Rate limit exceeded', { 
        ipAddress: req.ip,
        requestId: req.id 
      });
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        error: 'Too many requests, please try again later'
      });
      return;
    }

    // Extract token
    const token = extractTokenFromHeader(req);
    if (!token) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'No valid authorization token provided'
      });
      return;
    }

    // Check token blacklist
    const authService = new AuthService(null, null, null, null); // Dependencies injected in actual implementation
    const isBlacklisted = await authService.checkTokenBlacklist(token);
    if (isBlacklisted) {
      securityLogger.warn('Blacklisted token used', {
        requestId: req.id,
        ipAddress: req.ip
      });
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Token has been revoked'
      });
      return;
    }

    // Validate token
    const validationResult = await authService.validateToken(token);
    if (!validationResult.isValid) {
      securityLogger.warn('Invalid token', {
        error: validationResult.error,
        requestId: req.id,
        ipAddress: req.ip
      });
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: validationResult.error || 'Invalid token'
      });
      return;
    }

    // Decode token and validate claims
    const decodedToken = decode(token) as DecodedToken;
    const claimsValid = await validateTokenClaims(decodedToken);
    if (!claimsValid) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Invalid token claims'
      });
      return;
    }

    // Log successful validation
    await authService.logAuthEvent({
      action: 'TOKEN_VALIDATION',
      userId: decodedToken.sub,
      status: 'SUCCESS',
      ipAddress: req.ip,
      requestId: req.id
    });

    // Attach user information to request
    req.user = {
      id: decodedToken.sub,
      email: decodedToken.email,
      role: decodedToken.role,
      mfaEnabled: decodedToken.mfa_enabled
    };

    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    next();
  } catch (error) {
    securityLogger.error('JWT middleware error', {
      error: error.message,
      stack: error.stack,
      requestId: req.id,
      ipAddress: req.ip
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred during authentication'
    });
  }
};