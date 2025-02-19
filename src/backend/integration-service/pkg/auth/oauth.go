// Package auth provides OAuth 2.0 authentication management for external service integrations
// with enhanced security, reliability, and monitoring features.
package auth

import (
    "context"
    "crypto/aes"
    "crypto/cipher"
    "encoding/base64"
    "encoding/json"
    "errors"
    "fmt"
    "sync"
    "time"

    "golang.org/x/oauth2"        // v0.7.0
    "github.com/google/uuid"     // v1.3.0
    "github.com/go-redis/redis/v8" // v8.11.5
    "github.com/prometheus/client_golang/prometheus" // v1.14.0

    "github.com/yourdomain/agent-ai-platform/integration-service/config"
    "github.com/yourdomain/agent-ai-platform/integration-service/internal/models"
    "github.com/yourdomain/agent-ai-platform/integration-service/pkg/database"
)

const (
    tokenExpiryBuffer    = 5 * time.Minute
    maxRetries          = 3
    rateLimitWindow     = 1 * time.Minute
    maxRequestsPerWindow = 100
    cacheKeyPrefix      = "oauth_token:"
    cacheExpiration     = 30 * time.Minute
)

var (
    encryptionKey []byte
    metrics       *oauthMetrics
)

// OAuthManager handles OAuth authentication with enhanced security and monitoring
type OAuthManager struct {
    config       *config.Config
    db           *database.PostgresDB
    cache        *redis.Client
    logger       *log.Logger
    oauthClients map[string]*oauth2.Config
    rateLimiter  *rateLimiter
    metrics      *oauthMetrics
    mu           sync.RWMutex
}

// oauthMetrics tracks OAuth-related metrics
type oauthMetrics struct {
    tokenRequests    prometheus.Counter
    tokenRefreshes   prometheus.Counter
    errors          prometheus.Counter
    responseTime    prometheus.Histogram
}

// NewOAuthManager creates a new OAuth manager instance
func NewOAuthManager(cfg *config.Config, db *database.PostgresDB, cache *redis.Client, logger *log.Logger) (*OAuthManager, error) {
    if cfg == nil || db == nil || cache == nil || logger == nil {
        return nil, errors.New("all dependencies must be provided")
    }

    // Initialize encryption key from environment
    encryptionKey = []byte(cfg.SecurityConfig.EncryptionKey)
    if len(encryptionKey) != 32 {
        return nil, errors.New("invalid encryption key length")
    }

    // Initialize metrics
    metrics = initializeMetrics()

    // Initialize OAuth clients
    oauthClients := make(map[string]*oauth2.Config)
    
    // Configure Zoho CRM OAuth client
    oauthClients[models.ServiceTypeZohoCRM] = &oauth2.Config{
        ClientID:     cfg.ZohoCRMConfig.ClientID,
        ClientSecret: cfg.ZohoCRMConfig.ClientSecret,
        Endpoint: oauth2.Endpoint{
            AuthURL:  fmt.Sprintf("%s/oauth/v2/auth", cfg.ZohoCRMConfig.BaseURL),
            TokenURL: fmt.Sprintf("%s/oauth/v2/token", cfg.ZohoCRMConfig.BaseURL),
        },
    }

    // Initialize rate limiter
    rateLimiter := newRateLimiter(cache, rateLimitWindow, maxRequestsPerWindow)

    return &OAuthManager{
        config:       cfg,
        db:           db,
        cache:        cache,
        logger:       logger,
        oauthClients: oauthClients,
        rateLimiter:  rateLimiter,
        metrics:      metrics,
    }, nil
}

// GetToken retrieves a valid OAuth token for the specified integration
func (m *OAuthManager) GetToken(ctx context.Context, integrationID uuid.UUID) (*oauth2.Token, error) {
    start := time.Now()
    defer func() {
        m.metrics.responseTime.Observe(time.Since(start).Seconds())
    }()

    m.metrics.tokenRequests.Inc()

    // Check rate limit
    if err := m.rateLimiter.checkLimit(ctx, integrationID.String()); err != nil {
        return nil, fmt.Errorf("rate limit exceeded: %w", err)
    }

    // Try to get token from cache
    cacheKey := fmt.Sprintf("%s%s", cacheKeyPrefix, integrationID)
    tokenData, err := m.cache.Get(ctx, cacheKey).Bytes()
    if err == nil {
        var token oauth2.Token
        if err := json.Unmarshal(tokenData, &token); err == nil && token.Valid() {
            return &token, nil
        }
    }

    // Get integration from database
    var integration models.Integration
    if err := m.db.First(&integration, "id = ?", integrationID).Error; err != nil {
        m.metrics.errors.Inc()
        return nil, fmt.Errorf("failed to get integration: %w", err)
    }

    // Get OAuth client
    client, ok := m.oauthClients[integration.ServiceType]
    if !ok {
        m.metrics.errors.Inc()
        return nil, fmt.Errorf("unsupported service type: %s", integration.ServiceType)
    }

    // Parse stored token
    var storedToken oauth2.Token
    if err := json.Unmarshal(integration.Config, &storedToken); err != nil {
        m.metrics.errors.Inc()
        return nil, fmt.Errorf("failed to parse stored token: %w", err)
    }

    // Check if token needs refresh
    if time.Until(storedToken.Expiry) < tokenExpiryBuffer {
        newToken, err := m.refreshToken(ctx, client, &storedToken, &integration)
        if err != nil {
            m.metrics.errors.Inc()
            return nil, fmt.Errorf("failed to refresh token: %w", err)
        }
        storedToken = *newToken
    }

    // Cache the valid token
    tokenBytes, _ := json.Marshal(storedToken)
    m.cache.Set(ctx, cacheKey, tokenBytes, cacheExpiration)

    return &storedToken, nil
}

// refreshToken handles token refresh with retry logic
func (m *OAuthManager) refreshToken(ctx context.Context, client *oauth2.Config, token *oauth2.Token, integration *models.Integration) (*oauth2.Token, error) {
    m.metrics.tokenRefreshes.Inc()

    var newToken *oauth2.Token
    var err error

    for attempt := 1; attempt <= maxRetries; attempt++ {
        newToken, err = client.TokenSource(ctx, token).Token()
        if err == nil {
            break
        }

        if attempt == maxRetries {
            return nil, err
        }

        time.Sleep(time.Duration(attempt) * 100 * time.Millisecond)
    }

    // Update integration with new token
    tokenBytes, _ := json.Marshal(newToken)
    integration.Config = tokenBytes
    
    if err := m.db.Save(integration).Error; err != nil {
        return nil, fmt.Errorf("failed to save refreshed token: %w", err)
    }

    return newToken, nil
}

// initializeMetrics sets up Prometheus metrics
func initializeMetrics() *oauthMetrics {
    return &oauthMetrics{
        tokenRequests: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "oauth_token_requests_total",
            Help: "Total number of OAuth token requests",
        }),
        tokenRefreshes: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "oauth_token_refreshes_total",
            Help: "Total number of OAuth token refreshes",
        }),
        errors: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "oauth_errors_total",
            Help: "Total number of OAuth errors",
        }),
        responseTime: prometheus.NewHistogram(prometheus.HistogramOpts{
            Name:    "oauth_response_time_seconds",
            Help:    "OAuth operation response time in seconds",
            Buckets: prometheus.DefBuckets,
        }),
    }
}

// rateLimiter implements rate limiting using Redis
type rateLimiter struct {
    cache    *redis.Client
    window   time.Duration
    maxLimit int
}

func newRateLimiter(cache *redis.Client, window time.Duration, maxLimit int) *rateLimiter {
    return &rateLimiter{
        cache:    cache,
        window:   window,
        maxLimit: maxLimit,
    }
}

func (r *rateLimiter) checkLimit(ctx context.Context, key string) error {
    count, err := r.cache.Incr(ctx, "ratelimit:"+key).Result()
    if err != nil {
        return fmt.Errorf("failed to check rate limit: %w", err)
    }

    if count == 1 {
        r.cache.Expire(ctx, "ratelimit:"+key, r.window)
    }

    if count > int64(r.maxLimit) {
        return errors.New("rate limit exceeded")
    }

    return nil
}