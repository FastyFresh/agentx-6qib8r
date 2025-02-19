// @auth0/auth0-spa-js v2.1.0
import { Auth0ClientOptions } from '@auth0/auth0-spa-js';

// Environment variables for Auth0 configuration
const AUTH0_DOMAIN = process.env.VITE_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.VITE_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = process.env.VITE_AUTH0_AUDIENCE || '';
const AUTH0_SCOPE = 'openid profile email';

/**
 * Auth0 client configuration for the AGENT AI Platform
 * Implements OAuth 2.0 + OIDC, MFA, and SSO capabilities
 */
export const authConfig: Auth0ClientOptions = {
  // Core Auth0 Configuration
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
  audience: AUTH0_AUDIENCE,
  scope: AUTH0_SCOPE,

  // Dynamic redirect URI based on environment
  redirectUri: window.location.origin,

  // Cache and Token Management
  cacheLocation: 'localStorage', // Persist auth state
  useRefreshTokens: true, // Enable refresh token rotation

  // Advanced Configuration Options
  advancedOptions: {
    defaultScope: AUTH0_SCOPE
  },

  // Authentication Parameters
  authorizationParams: {
    response_type: 'code',
    audience: AUTH0_AUDIENCE,
    scope: AUTH0_SCOPE
  },

  // Session Management
  sessionCheckExpiryDays: 1,
  
  // MFA Configuration
  auth0Client: {
    name: 'AGENT AI Platform',
    version: '1.0.0'
  },

  // Error Handling
  onRedirectCallback: (appState) => {
    window.history.replaceState(
      {},
      document.title,
      appState?.returnTo || window.location.pathname
    );
  },

  // SSO Configuration
  client_sso: true,
  
  // Security Options
  leeway: 60, // Clock skew tolerance in seconds
  useCookiesForTransactions: true,
  
  // HTTP Options
  httpTimeoutInSeconds: 10,
  
  // Token Management
  tokenRefreshThreshold: 60 * 60, // Refresh tokens 1 hour before expiry
};