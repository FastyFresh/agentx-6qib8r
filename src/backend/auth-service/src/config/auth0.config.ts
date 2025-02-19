// @package-version dotenv@16.3.1
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validates that all required Auth0 configuration values are present and properly formatted
 * @throws Error if configuration is invalid or missing required values
 */
const validateConfig = (): void => {
  const missingConfigs: string[] = [];
  const invalidConfigs: string[] = [];

  // Validate domain
  if (!process.env.AUTH0_DOMAIN) {
    missingConfigs.push('AUTH0_DOMAIN');
  } else if (!/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(process.env.AUTH0_DOMAIN)) {
    invalidConfigs.push('AUTH0_DOMAIN must be a valid domain');
  }

  // Validate client ID
  if (!process.env.AUTH0_CLIENT_ID) {
    missingConfigs.push('AUTH0_CLIENT_ID');
  } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(process.env.AUTH0_CLIENT_ID)) {
    invalidConfigs.push('AUTH0_CLIENT_ID must be a valid UUID');
  }

  // Validate client secret
  if (!process.env.AUTH0_CLIENT_SECRET) {
    missingConfigs.push('AUTH0_CLIENT_SECRET');
  } else if (process.env.AUTH0_CLIENT_SECRET.length < 32) {
    invalidConfigs.push('AUTH0_CLIENT_SECRET must be at least 32 characters long');
  }

  // Validate audience
  if (!process.env.AUTH0_AUDIENCE) {
    missingConfigs.push('AUTH0_AUDIENCE');
  } else if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/.test(process.env.AUTH0_AUDIENCE)) {
    invalidConfigs.push('AUTH0_AUDIENCE must be a valid URL');
  }

  // Validate token signing algorithm
  const allowedAlgorithms = ['RS256', 'HS256'];
  if (!process.env.TOKEN_SIGNING_ALG) {
    missingConfigs.push('TOKEN_SIGNING_ALG');
  } else if (!allowedAlgorithms.includes(process.env.TOKEN_SIGNING_ALG)) {
    invalidConfigs.push(`TOKEN_SIGNING_ALG must be one of: ${allowedAlgorithms.join(', ')}`);
  }

  // Validate token expiration
  if (!process.env.TOKEN_EXPIRES_IN) {
    missingConfigs.push('TOKEN_EXPIRES_IN');
  } else if (isNaN(Number(process.env.TOKEN_EXPIRES_IN)) || Number(process.env.TOKEN_EXPIRES_IN) <= 0) {
    invalidConfigs.push('TOKEN_EXPIRES_IN must be a positive number');
  }

  if (missingConfigs.length > 0 || invalidConfigs.length > 0) {
    throw new Error(
      'Invalid Auth0 Configuration:\n' +
      (missingConfigs.length > 0 ? `Missing required values: ${missingConfigs.join(', ')}\n` : '') +
      (invalidConfigs.length > 0 ? `Invalid values: ${invalidConfigs.join(', ')}` : '')
    );
  }
};

// Validate configuration before creating config object
validateConfig();

/**
 * Auth0 Configuration object containing all settings required for authentication service
 */
export const auth0Config = {
  // Core Auth0 Settings
  domain: process.env.AUTH0_DOMAIN as string,
  clientId: process.env.AUTH0_CLIENT_ID as string,
  clientSecret: process.env.AUTH0_CLIENT_SECRET as string,
  audience: process.env.AUTH0_AUDIENCE as string,
  tokenSigningAlg: process.env.TOKEN_SIGNING_ALG as string,
  tokenExpiresIn: Number(process.env.TOKEN_EXPIRES_IN),
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,

  // Multi-Factor Authentication Settings
  mfaEnabled: process.env.MFA_ENABLED === 'true',
  
  // SAML SSO Settings
  samlEnabled: process.env.SAML_ENABLED === 'true',
  samlCallbackURL: process.env.SAML_CALLBACK_URL || '',

  // Token Refresh Settings
  tokenRefreshEnabled: process.env.TOKEN_REFRESH_ENABLED === 'true',
  tokenRefreshTTL: Number(process.env.TOKEN_REFRESH_TTL) || 86400, // Default 24 hours

  // Logout Settings
  logoutURL: process.env.LOGOUT_URL || `https://${process.env.AUTH0_DOMAIN}/v2/logout`,

  // Allowed URLs
  allowedCallbackURLs: (process.env.ALLOWED_CALLBACK_URLS || '').split(',').filter(Boolean),
  allowedLogoutURLs: (process.env.ALLOWED_LOGOUT_URLS || '').split(',').filter(Boolean),
  allowedWebOrigins: (process.env.ALLOWED_WEB_ORIGINS || '').split(',').filter(Boolean),
};

export default auth0Config;