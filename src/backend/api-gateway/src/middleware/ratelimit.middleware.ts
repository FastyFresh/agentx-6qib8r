import { Request, Response, NextFunction, RequestHandler } from 'express'; // ^4.18.2
import Redis, { RedisOptions, ClusterNode } from 'ioredis'; // ^5.3.2
import { kongConfig } from '../config/kong.config';
import winston from 'winston'; // ^3.8.2

// Interface definitions for rate limiting
interface RateLimitInfo {
  count: number;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

interface RateLimitConfig {
  window: number;
  max: number;
  policy: string;
  fallbackLimit: number;
  bypassTokens: string[];
}

interface RedisConfig {
  nodes: Array<ClusterNode>;
  options: RedisOptions;
  retryStrategy: (times: number) => number | void;
}

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Creates rate limiting middleware with Redis cluster support
 * @param serviceName - Name of the service to apply rate limiting
 * @param redisConfig - Redis cluster configuration
 * @returns Express middleware function
 */
export const createRateLimiter = (
  serviceName: string,
  redisConfig: RedisConfig
): RequestHandler => {
  // Initialize Redis cluster client
  const redisClient = new Redis.Cluster(redisConfig.nodes, {
    ...redisConfig.options,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  // Get rate limit configuration from Kong config
  const serviceConfig = kongConfig.services.find(s => s.name === serviceName);
  const rateLimitPlugin = serviceConfig?.plugins.find(p => p.name === 'rate-limiting');
  
  if (!rateLimitPlugin) {
    throw new Error(`Rate limiting not configured for service: ${serviceName}`);
  }

  const rateLimit: RateLimitConfig = {
    window: 60, // 1 minute window
    max: rateLimitPlugin.config.minute,
    policy: rateLimitPlugin.config.policy,
    fallbackLimit: Math.floor(rateLimitPlugin.config.minute * 0.8), // 80% of normal limit
    bypassTokens: [] // Add bypass tokens if needed
  };

  // Setup Redis connection event handlers
  redisClient.on('error', (err) => {
    logger.error('Redis cluster error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Connected to Redis cluster');
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip;
    const endpoint = req.path;
    const key = `ratelimit:${serviceName}:${endpoint}:${clientIp}`;

    try {
      // Check bypass tokens
      const apiKey = req.headers['x-api-key'];
      if (apiKey && rateLimit.bypassTokens.includes(apiKey as string)) {
        return next();
      }

      // Get current rate limit status
      const limitInfo = await getRateLimit(key, redisClient);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimit.max);
      res.setHeader('X-RateLimit-Remaining', limitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', limitInfo.reset);

      if (limitInfo.count >= rateLimit.max) {
        return handleRateLimitExceeded(res, limitInfo);
      }

      // Increment rate limit counter
      const incremented = await incrementRateLimit(key, rateLimit.window, redisClient);
      if (!incremented) {
        logger.warn(`Failed to increment rate limit for ${key}`);
        // Use fallback limit
        if (limitInfo.count >= rateLimit.fallbackLimit) {
          return handleRateLimitExceeded(res, {
            ...limitInfo,
            limit: rateLimit.fallbackLimit
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Fail open with fallback limit
      if (error instanceof Redis.ClusterAllFailedError) {
        next();
      } else {
        next(error);
      }
    }
  };
};

/**
 * Retrieves current rate limit count using sliding window
 * @param key - Rate limit key
 * @param redisClient - Redis client instance
 * @returns Rate limit information
 */
export const getRateLimit = async (
  key: string,
  redisClient: Redis.Cluster
): Promise<RateLimitInfo> => {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  // Remove expired entries
  await redisClient.zremrangebyscore(key, '-inf', windowStart);
  
  // Get current count
  const count = await redisClient.zcard(key);
  
  // Calculate reset time
  const oldestTimestamp = await redisClient.zrange(key, 0, 0, 'WITHSCORES');
  const reset = oldestTimestamp.length ? parseInt(oldestTimestamp[1]) + 60000 : now + 60000;

  return {
    count,
    limit: 0, // Will be set by middleware
    remaining: 0, // Will be set by middleware
    reset: Math.floor(reset / 1000),
    retryAfter: Math.max(0, Math.floor((reset - now) / 1000))
  };
};

/**
 * Increments rate limit counter using Redis sorted sets
 * @param key - Rate limit key
 * @param windowSize - Time window in seconds
 * @param redisClient - Redis client instance
 * @returns Success status
 */
const incrementRateLimit = async (
  key: string,
  windowSize: number,
  redisClient: Redis.Cluster
): Promise<boolean> => {
  const now = Date.now();
  const pipeline = redisClient.pipeline();

  pipeline.zadd(key, now, `${now}`);
  pipeline.zremrangebyscore(key, '-inf', now - (windowSize * 1000));
  pipeline.expire(key, windowSize);

  try {
    await pipeline.exec();
    return true;
  } catch (error) {
    logger.error('Failed to increment rate limit:', error);
    return false;
  }
};

/**
 * Handles rate limit exceeded response
 * @param res - Express response object
 * @param limitInfo - Rate limit information
 */
const handleRateLimitExceeded = (res: Response, limitInfo: RateLimitInfo): void => {
  res.setHeader('Retry-After', limitInfo.retryAfter);
  res.setHeader('X-RateLimit-Reset', limitInfo.reset);

  logger.warn(`Rate limit exceeded for ${res.req.ip} on ${res.req.path}`);

  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded',
    retryAfter: limitInfo.retryAfter
  });
};