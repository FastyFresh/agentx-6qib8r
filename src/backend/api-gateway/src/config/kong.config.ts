import dotenv from 'dotenv'; // ^16.3.1

// Load environment variables
dotenv.config();

// API Constants
const API_VERSION = 'v1';
const BASE_PATH = '/api';

// Service configuration type definitions
interface ServiceConfig {
  host: string;
  port: number;
  protocol: string;
}

interface RouteConfig {
  paths: string[];
  methods: string[];
  strip_path: boolean;
  preserve_host: boolean;
}

interface PluginConfig {
  name: string;
  config: Record<string, any>;
}

// Service configuration helper
const getServiceConfig = (serviceName: string): ServiceConfig => {
  const host = process.env[`${serviceName.toUpperCase()}_HOST`];
  const port = parseInt(process.env[`${serviceName.toUpperCase()}_PORT`] || '3000', 10);
  
  if (!host) {
    throw new Error(`Missing host configuration for service: ${serviceName}`);
  }

  return {
    host,
    port,
    protocol: 'http'
  };
};

// Kong Gateway Configuration
export const kongConfig = {
  services: [
    {
      name: 'agent-service',
      ...getServiceConfig('agent-service'),
      routes: [{
        paths: [`${BASE_PATH}/${API_VERSION}/agents`],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        strip_path: false,
        preserve_host: true
      }],
      plugins: [
        {
          name: 'rate-limiting',
          config: {
            minute: 100,
            policy: 'redis',
            fault_tolerant: true,
            hide_client_headers: false
          }
        },
        {
          name: 'jwt',
          config: {
            uri_param_names: ['jwt'],
            cookie_names: [],
            key_claim_name: 'kid',
            claims_to_verify: ['exp', 'nbf']
          }
        }
      ]
    },
    {
      name: 'integration-service',
      ...getServiceConfig('integration-service'),
      routes: [{
        paths: [`${BASE_PATH}/${API_VERSION}/integrations`],
        methods: ['GET', 'POST', 'PUT'],
        strip_path: false,
        preserve_host: true
      }],
      plugins: [
        {
          name: 'rate-limiting',
          config: {
            minute: 60,
            policy: 'redis',
            fault_tolerant: true,
            hide_client_headers: false
          }
        },
        {
          name: 'jwt',
          config: {
            uri_param_names: ['jwt'],
            cookie_names: [],
            key_claim_name: 'kid',
            claims_to_verify: ['exp', 'nbf']
          }
        }
      ]
    },
    {
      name: 'metrics-service',
      ...getServiceConfig('metrics-service'),
      routes: [{
        paths: [`${BASE_PATH}/${API_VERSION}/metrics`],
        methods: ['GET'],
        strip_path: false,
        preserve_host: true
      }],
      plugins: [
        {
          name: 'rate-limiting',
          config: {
            minute: 200,
            policy: 'redis',
            fault_tolerant: true,
            hide_client_headers: false
          }
        },
        {
          name: 'jwt',
          config: {
            uri_param_names: ['jwt'],
            cookie_names: [],
            key_claim_name: 'kid',
            claims_to_verify: ['exp', 'nbf']
          }
        }
      ]
    }
  ],
  plugins: [
    {
      name: 'cors',
      config: {
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: [
          'Accept',
          'Accept-Version',
          'Content-Type',
          'Authorization',
          'X-API-Key',
          'X-Request-ID'
        ],
        exposed_headers: [
          'X-Rate-Limit-Remaining',
          'X-Rate-Limit-Reset',
          'X-Request-ID'
        ],
        credentials: true,
        max_age: 3600
      }
    },
    {
      name: 'ip-restriction',
      config: {
        whitelist: process.env.IP_WHITELIST?.split(','),
        message: 'Access denied: IP not in whitelist'
      }
    },
    {
      name: 'request-transformer',
      config: {
        add: {
          headers: [
            'X-Request-ID:$(uuid)',
            'X-Service-Name:${service.name}',
            'X-Original-Host:${request.host}'
          ]
        }
      }
    },
    {
      name: 'response-transformer',
      config: {
        add: {
          headers: [
            'X-Service-Version:${SERVICE_VERSION}',
            'X-Response-Time:${response.time}',
            'X-Kong-Gateway-Version:${kong.version}'
          ]
        }
      }
    }
  ]
};