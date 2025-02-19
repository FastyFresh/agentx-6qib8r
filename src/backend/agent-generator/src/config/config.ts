// External dependencies
// dotenv v16.3.1 - Environment variable loading
import dotenv from 'dotenv';
// joi v17.9.0 - Configuration validation
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Type definitions for configuration objects
interface ServerConfig {
    nodeEnv: 'development' | 'staging' | 'production';
    port: number;
    apiVersion: string;
    corsOrigin: string[];
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    requestTimeout: number;
    maxPayloadSize: string;
    rateLimitWindow: number;
    rateLimitMaxRequests: number;
}

interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    sslMode: string;
    maxConnections: number;
    idleTimeout: number;
    connectionTimeout: number;
}

interface RedisConfig {
    host: string;
    port: number;
    password: string;
    db: number;
    maxRetries: number;
    retryInterval: number;
    keepAlive: boolean;
}

interface AuthConfig {
    auth0Domain: string;
    auth0ClientId: string;
    auth0ClientSecret: string;
    auth0Audience: string;
    jwtSecret: string;
    tokenExpiration: number;
    refreshTokenExpiration: number;
    passwordHashRounds: number;
    mfaEnabled: boolean;
}

interface IntegrationsConfig {
    zoho: {
        clientId: string;
        clientSecret: string;
        baseUrl: string;
        timeout: number;
    };
    rms: {
        apiKey: string;
        baseUrl: string;
        timeout: number;
    };
    retryAttempts: number;
    healthCheckInterval: number;
}

interface MonitoringConfig {
    prometheusEndpoint: string;
    grafanaUrl: string;
    alertWebhookUrl: string;
    metricsRetentionDays: number;
    healthCheckInterval: number;
    performanceThresholds: {
        cpu: number;
        memory: number;
    };
    logRetentionDays: number;
}

interface ConfigType {
    server: ServerConfig;
    database: DatabaseConfig;
    redis: RedisConfig;
    auth: AuthConfig;
    integrations: IntegrationsConfig;
    monitoring: MonitoringConfig;
}

// Configuration validation schema
const configSchema = Joi.object({
    server: Joi.object({
        nodeEnv: Joi.string().valid('development', 'staging', 'production').required(),
        port: Joi.number().port().default(3000),
        apiVersion: Joi.string().default('v1'),
        corsOrigin: Joi.array().items(Joi.string()).required(),
        logLevel: Joi.string().valid('debug', 'info', 'warn', 'error').required(),
        requestTimeout: Joi.number().min(1000).required(),
        maxPayloadSize: Joi.string().required(),
        rateLimitWindow: Joi.number().min(1).required(),
        rateLimitMaxRequests: Joi.number().min(1).required()
    }).required(),

    database: Joi.object({
        host: Joi.string().required(),
        port: Joi.number().port().required(),
        database: Joi.string().required(),
        user: Joi.string().required(),
        password: Joi.string().required(),
        sslMode: Joi.string().valid('disable', 'require', 'verify-full').required(),
        maxConnections: Joi.number().min(1).required(),
        idleTimeout: Joi.number().min(1000).required(),
        connectionTimeout: Joi.number().min(1000).required()
    }).required(),

    redis: Joi.object({
        host: Joi.string().required(),
        port: Joi.number().port().required(),
        password: Joi.string().required(),
        db: Joi.number().min(0).required(),
        maxRetries: Joi.number().min(1).required(),
        retryInterval: Joi.number().min(100).required(),
        keepAlive: Joi.boolean().required()
    }).required(),

    auth: Joi.object({
        auth0Domain: Joi.string().required(),
        auth0ClientId: Joi.string().required(),
        auth0ClientSecret: Joi.string().required(),
        auth0Audience: Joi.string().required(),
        jwtSecret: Joi.string().min(32).required(),
        tokenExpiration: Joi.number().min(300).required(),
        refreshTokenExpiration: Joi.number().min(3600).required(),
        passwordHashRounds: Joi.number().min(10).required(),
        mfaEnabled: Joi.boolean().required()
    }).required(),

    integrations: Joi.object({
        zoho: Joi.object({
            clientId: Joi.string().required(),
            clientSecret: Joi.string().required(),
            baseUrl: Joi.string().uri().required(),
            timeout: Joi.number().min(1000).required()
        }).required(),
        rms: Joi.object({
            apiKey: Joi.string().required(),
            baseUrl: Joi.string().uri().required(),
            timeout: Joi.number().min(1000).required()
        }).required(),
        retryAttempts: Joi.number().min(1).required(),
        healthCheckInterval: Joi.number().min(5000).required()
    }).required(),

    monitoring: Joi.object({
        prometheusEndpoint: Joi.string().uri().required(),
        grafanaUrl: Joi.string().uri().required(),
        alertWebhookUrl: Joi.string().uri().required(),
        metricsRetentionDays: Joi.number().min(1).required(),
        healthCheckInterval: Joi.number().min(5000).required(),
        performanceThresholds: Joi.object({
            cpu: Joi.number().min(0).max(100).required(),
            memory: Joi.number().min(0).max(100).required()
        }).required(),
        logRetentionDays: Joi.number().min(1).required()
    }).required()
});

// Configuration validation function
export const validateConfig = (config: ConfigType): void => {
    const { error } = configSchema.validate(config, { abortEarly: false });
    if (error) {
        const errorMessage = error.details.map(detail => detail.message).join('\n');
        throw new Error(`Configuration validation failed:\n${errorMessage}`);
    }
};

// Load and validate configuration
const loadConfig = (): ConfigType => {
    const config: ConfigType = {
        server: {
            nodeEnv: process.env.NODE_ENV as 'development' | 'staging' | 'production',
            port: parseInt(process.env.PORT || '3000', 10),
            apiVersion: process.env.API_VERSION || 'v1',
            corsOrigin: process.env.CORS_ORIGIN?.split(',') || [],
            logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
            requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
            maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb',
            rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
            rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
        },
        database: {
            host: process.env.POSTGRES_HOST!,
            port: parseInt(process.env.POSTGRES_PORT!, 10),
            database: process.env.POSTGRES_DB!,
            user: process.env.POSTGRES_USER!,
            password: process.env.POSTGRES_PASSWORD!,
            sslMode: process.env.POSTGRES_SSL_MODE!,
            maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS!, 10),
            idleTimeout: parseInt(process.env.POSTGRES_IDLE_TIMEOUT!, 10),
            connectionTimeout: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT!, 10)
        },
        redis: {
            host: process.env.REDIS_HOST!,
            port: parseInt(process.env.REDIS_PORT!, 10),
            password: process.env.REDIS_PASSWORD!,
            db: parseInt(process.env.REDIS_DB!, 10),
            maxRetries: parseInt(process.env.REDIS_MAX_RETRIES!, 10),
            retryInterval: parseInt(process.env.REDIS_RETRY_INTERVAL!, 10),
            keepAlive: process.env.REDIS_KEEP_ALIVE === 'true'
        },
        auth: {
            auth0Domain: process.env.AUTH0_DOMAIN!,
            auth0ClientId: process.env.AUTH0_CLIENT_ID!,
            auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET!,
            auth0Audience: process.env.AUTH0_AUDIENCE!,
            jwtSecret: process.env.JWT_SECRET!,
            tokenExpiration: parseInt(process.env.TOKEN_EXPIRATION!, 10),
            refreshTokenExpiration: parseInt(process.env.REFRESH_TOKEN_EXPIRATION!, 10),
            passwordHashRounds: parseInt(process.env.PASSWORD_HASH_ROUNDS!, 10),
            mfaEnabled: process.env.MFA_ENABLED === 'true'
        },
        integrations: {
            zoho: {
                clientId: process.env.ZOHO_CLIENT_ID!,
                clientSecret: process.env.ZOHO_CLIENT_SECRET!,
                baseUrl: process.env.ZOHO_BASE_URL!,
                timeout: parseInt(process.env.ZOHO_TIMEOUT!, 10)
            },
            rms: {
                apiKey: process.env.RMS_API_KEY!,
                baseUrl: process.env.RMS_BASE_URL!,
                timeout: parseInt(process.env.RMS_TIMEOUT!, 10)
            },
            retryAttempts: parseInt(process.env.INTEGRATION_RETRY_ATTEMPTS!, 10),
            healthCheckInterval: parseInt(process.env.INTEGRATION_HEALTH_CHECK_INTERVAL!, 10)
        },
        monitoring: {
            prometheusEndpoint: process.env.PROMETHEUS_ENDPOINT!,
            grafanaUrl: process.env.GRAFANA_URL!,
            alertWebhookUrl: process.env.ALERT_WEBHOOK_URL!,
            metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS!, 10),
            healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL!, 10),
            performanceThresholds: {
                cpu: parseInt(process.env.PERFORMANCE_THRESHOLD_CPU!, 10),
                memory: parseInt(process.env.PERFORMANCE_THRESHOLD_MEMORY!, 10)
            },
            logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS!, 10)
        }
    };

    validateConfig(config);
    return config;
};

// Export validated configuration
export const config = loadConfig();