import { UserRole } from '../types/auth.types';

/**
 * Public routes accessible without authentication
 */
export const PUBLIC_ROUTES = {
  LOGIN: '/login',
  ERROR: '/error',
  NOT_FOUND: '/404',
  PASSWORD_RESET: '/reset-password',
  VERIFY_EMAIL: '/verify-email'
} as const;

/**
 * Protected routes requiring authentication with nested route structure
 */
export const PROTECTED_ROUTES = {
  // Dashboard
  DASHBOARD: '/',

  // Agents section
  AGENTS: '/agents',
  AGENT_DETAILS: '/agents/:agentId',
  AGENT_CREATION: '/agents/create',
  AGENT_EDIT: '/agents/:agentId/edit',
  AGENT_LOGS: '/agents/:agentId/logs',

  // Analytics section
  ANALYTICS: '/analytics',
  ANALYTICS_PERFORMANCE: '/analytics/performance',
  ANALYTICS_USAGE: '/analytics/usage',

  // Integrations section
  INTEGRATIONS: '/integrations',
  INTEGRATION_DETAILS: '/integrations/:integrationId',

  // Settings section
  SETTINGS: '/settings',
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_SECURITY: '/settings/security',
  SETTINGS_NOTIFICATIONS: '/settings/notifications'
} as const;

/**
 * Role-based access control for protected routes
 * Defines which roles have access to specific routes
 */
export const ROUTE_PERMISSIONS = {
  AGENT_CREATION: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENT_MANAGER],
  AGENT_EDIT: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENT_MANAGER],
  ANALYTICS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENT_MANAGER, UserRole.VIEWER],
  ANALYTICS_PERFORMANCE: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  INTEGRATIONS: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  SETTINGS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENT_MANAGER, UserRole.VIEWER],
  SETTINGS_SECURITY: [UserRole.SUPER_ADMIN, UserRole.ADMIN]
} as const;

/**
 * URL parameter names for dynamic routes
 */
export const ROUTE_PARAMS = {
  AGENT_ID: 'agentId',
  INTEGRATION_ID: 'integrationId',
  TAB: 'tab',
  VIEW: 'view',
  PERIOD: 'period'
} as const;

/**
 * Additional route metadata for navigation and UI
 */
export const ROUTE_METADATA = {
  TITLES: {
    [PROTECTED_ROUTES.DASHBOARD]: 'Dashboard',
    [PROTECTED_ROUTES.AGENTS]: 'Agents',
    [PROTECTED_ROUTES.AGENT_CREATION]: 'Create New Agent',
    [PROTECTED_ROUTES.AGENT_EDIT]: 'Edit Agent',
    [PROTECTED_ROUTES.AGENT_LOGS]: 'Agent Logs',
    [PROTECTED_ROUTES.ANALYTICS]: 'Analytics',
    [PROTECTED_ROUTES.ANALYTICS_PERFORMANCE]: 'Performance Analytics',
    [PROTECTED_ROUTES.ANALYTICS_USAGE]: 'Usage Analytics',
    [PROTECTED_ROUTES.INTEGRATIONS]: 'Integrations',
    [PROTECTED_ROUTES.SETTINGS]: 'Settings',
    [PROTECTED_ROUTES.SETTINGS_PROFILE]: 'Profile Settings',
    [PROTECTED_ROUTES.SETTINGS_SECURITY]: 'Security Settings',
    [PROTECTED_ROUTES.SETTINGS_NOTIFICATIONS]: 'Notification Settings'
  },
  BREADCRUMBS: {
    [PROTECTED_ROUTES.AGENT_DETAILS]: ['Agents', 'Agent Details'],
    [PROTECTED_ROUTES.AGENT_CREATION]: ['Agents', 'Create New'],
    [PROTECTED_ROUTES.AGENT_EDIT]: ['Agents', 'Edit'],
    [PROTECTED_ROUTES.AGENT_LOGS]: ['Agents', 'Logs'],
    [PROTECTED_ROUTES.ANALYTICS_PERFORMANCE]: ['Analytics', 'Performance'],
    [PROTECTED_ROUTES.ANALYTICS_USAGE]: ['Analytics', 'Usage'],
    [PROTECTED_ROUTES.INTEGRATION_DETAILS]: ['Integrations', 'Details'],
    [PROTECTED_ROUTES.SETTINGS_PROFILE]: ['Settings', 'Profile'],
    [PROTECTED_ROUTES.SETTINGS_SECURITY]: ['Settings', 'Security'],
    [PROTECTED_ROUTES.SETTINGS_NOTIFICATIONS]: ['Settings', 'Notifications']
  },
  DEFAULT_REDIRECTS: {
    [PROTECTED_ROUTES.ANALYTICS]: PROTECTED_ROUTES.ANALYTICS_PERFORMANCE,
    [PROTECTED_ROUTES.SETTINGS]: PROTECTED_ROUTES.SETTINGS_PROFILE
  }
} as const;