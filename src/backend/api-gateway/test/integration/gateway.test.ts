import request from 'supertest'; // ^6.3.3
import { app } from '../../src/index';
import Redis from 'ioredis-mock'; // ^8.8.1
import jwt from 'jsonwebtoken'; // ^9.0.1
import { kongConfig } from '../../src/config/kong.config';

// Mock Redis client
jest.mock('ioredis', () => require('ioredis-mock'));

describe('API Gateway Integration Tests', () => {
  let redisClient: Redis;
  let testTokens: { [key: string]: string };

  beforeAll(async () => {
    // Initialize Redis mock
    redisClient = new Redis({
      data: {
        'mfa:test-user': Date.now().toString()
      }
    });

    // Generate test tokens for different roles
    testTokens = {
      superAdmin: generateTestToken({ role: 'super_admin', mfaVerified: true }),
      admin: generateTestToken({ role: 'admin', mfaVerified: true }),
      agentManager: generateTestToken({ role: 'agent_manager', mfaVerified: true }),
      viewer: generateTestToken({ role: 'viewer', mfaVerified: true }),
      expired: generateTestToken({ role: 'viewer', mfaVerified: true }, -1),
      noMfa: generateTestToken({ role: 'admin', mfaVerified: false })
    };

    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.AUTH0_DOMAIN = 'test.auth0.com';
    process.env.AUTH0_AUDIENCE = 'test-api';
  });

  afterAll(async () => {
    await redisClient.quit();
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'AUTH001');
      expect(response.body).toHaveProperty('resolution_steps');
    });

    it('should reject requests with expired token', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .set('Authorization', `Bearer ${testTokens.expired}`)
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'AUTH002');
    });

    it('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .set('Authorization', `Bearer ${testTokens.viewer}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should enforce role-based access control', async () => {
      const response = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', `Bearer ${testTokens.viewer}`)
        .expect(403);

      expect(response.body.error).toHaveProperty('message', 'Insufficient permissions');
    });

    it('should validate MFA requirements', async () => {
      const response = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${testTokens.noMfa}`)
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'MFA_REQUIRED');
      expect(response.body).toHaveProperty('details.supported_methods');
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits for endpoints', async () => {
      const requests = Array(101).fill(null).map(() => 
        request(app)
          .get('/api/v1/agents')
          .set('Authorization', `Bearer ${testTokens.viewer}`)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find(r => r.status === 429);

      expect(rateLimited).toBeDefined();
      expect(rateLimited?.headers).toHaveProperty('retry-after');
      expect(rateLimited?.body).toHaveProperty('retryAfter');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .set('Authorization', `Bearer ${testTokens.viewer}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should handle concurrent requests correctly', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/v1/metrics')
          .set('Authorization', `Bearer ${testTokens.admin}`)
      );

      const responses = await Promise.all(requests);
      const successfulRequests = responses.filter(r => r.status === 200);

      expect(successfulRequests.length).toBe(concurrentRequests);
    });
  });

  describe('Security Headers Tests', () => {
    it('should set security headers on responses', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .set('Authorization', `Bearer ${testTokens.viewer}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should validate CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/agents')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers).toHaveProperty('access-control-max-age');
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/invalid')
        .set('Authorization', `Bearer ${testTokens.admin}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('correlation_id');
    });

    it('should handle service errors with proper status codes', async () => {
      // Simulate service error by triggering circuit breaker
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/agents')
          .set('Authorization', `Bearer ${testTokens.admin}`)
      );

      const responses = await Promise.all(requests);
      const errorResponse = responses.find(r => r.status === 500);

      expect(errorResponse?.body).toHaveProperty('error.correlation_id');
      expect(errorResponse?.body).toHaveProperty('timestamp');
    });
  });
});

// Helper function to generate test JWT tokens
function generateTestToken(
  payload: { role: string; mfaVerified: boolean },
  expiresIn: number = 3600
): string {
  const privateKey = Buffer.from('test-private-key').toString('base64');
  
  return jwt.sign(
    {
      sub: 'test-user',
      roles: [payload.role],
      permissions: ['read:agents', 'write:agents'],
      mfa_verified: payload.mfaVerified,
      jti: crypto.randomUUID()
    },
    privateKey,
    {
      algorithm: 'HS256',
      expiresIn: expiresIn,
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`
    }
  );
}