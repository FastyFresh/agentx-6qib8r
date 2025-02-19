/**
 * API Endpoints Constants
 * Centralized endpoint definitions for all backend service communication
 * @version 1.0.0
 */

// Base API version prefix for all endpoints
export const API_VERSION = '/api/v1';

/**
 * Authentication service endpoints
 * Handles user authentication, session management and 2FA
 */
export const AUTH_ENDPOINTS = {
  BASE: `${API_VERSION}/auth`,
  LOGIN: `${API_VERSION}/auth/login`,
  LOGOUT: `${API_VERSION}/auth/logout`,
  REFRESH: `${API_VERSION}/auth/refresh`,
  VERIFY_2FA: `${API_VERSION}/auth/verify-2fa`
} as const;

/**
 * Agent service endpoints
 * Manages AI agent lifecycle including creation, updates, and monitoring
 */
export const AGENT_ENDPOINTS = {
  BASE: `${API_VERSION}/agents`,
  CREATE: `${API_VERSION}/agents`,
  GET_BY_ID: `${API_VERSION}/agents/:id`,
  UPDATE: `${API_VERSION}/agents/:id`,
  DELETE: `${API_VERSION}/agents/:id`,
  METRICS: `${API_VERSION}/agents/:id/metrics`,
  STATUS: `${API_VERSION}/agents/:id/status`
} as const;

/**
 * Integration service endpoints
 * Handles external service connections and verifications
 */
export const INTEGRATION_ENDPOINTS = {
  BASE: `${API_VERSION}/integrations`,
  CREATE: `${API_VERSION}/integrations`,
  GET_BY_ID: `${API_VERSION}/integrations/:id`,
  UPDATE: `${API_VERSION}/integrations/:id`,
  DELETE: `${API_VERSION}/integrations/:id`,
  VERIFY: `${API_VERSION}/integrations/:id/verify`
} as const;

/**
 * Monitoring service endpoints
 * Provides system health and performance metrics
 */
export const METRICS_ENDPOINTS = {
  BASE: `${API_VERSION}/metrics`,
  SYSTEM_HEALTH: `${API_VERSION}/metrics/health`,
  PERFORMANCE: `${API_VERSION}/metrics/performance`
} as const;

// Type definitions for endpoint parameters
export type AgentId = string;
export type IntegrationId = string;

// Ensure all endpoint objects are readonly
Object.freeze(AUTH_ENDPOINTS);
Object.freeze(AGENT_ENDPOINTS);
Object.freeze(INTEGRATION_ENDPOINTS);
Object.freeze(METRICS_ENDPOINTS);