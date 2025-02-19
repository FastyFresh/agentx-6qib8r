// Package rms provides an enterprise-grade Restaurant Management System (RMS) client
// with comprehensive security, monitoring, and reliability features.
package rms

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "sync"
    "time"

    "github.com/avast/retry-go/v4"     // v4.3.1
    "github.com/sony/gobreaker"        // v2.3.0
    "golang.org/x/time/rate"           // v0.3.0
    "github.com/prometheus/client_golang/prometheus" // v1.14.0

    "github.com/yourdomain/agent-ai-platform/integration-service/internal/models"
    "github.com/yourdomain/agent-ai-platform/integration-service/pkg/auth"
)

const (
    defaultTimeout = 30 * time.Second
    maxRetries    = 3
    baseAPIPath   = "/api/v1"
    defaultRateLimit = 100
    circuitBreakerTimeout = 60 * time.Second
    maxConcurrentRequests = 50
)

// RMSClient provides an enterprise-grade interface for RMS API interactions
type RMSClient struct {
    httpClient  *http.Client
    integration *models.Integration
    authManager *auth.OAuthManager
    baseURL     string
    rateLimiter *rate.Limiter
    breaker     *gobreaker.CircuitBreaker
    metrics     *prometheus.CounterVec
    requestPool *sync.Pool
}

// NewRMSClient creates a new RMS client with enterprise features
func NewRMSClient(integration *models.Integration, authManager *auth.OAuthManager, metrics *prometheus.CounterVec) (*RMSClient, error) {
    if integration == nil || authManager == nil || metrics == nil {
        return nil, fmt.Errorf("all dependencies must be provided")
    }

    // Parse configuration
    var config struct {
        BaseURL string `json:"base_url"`
    }
    if err := json.Unmarshal(integration.Config, &config); err != nil {
        return nil, fmt.Errorf("invalid integration configuration: %w", err)
    }

    // Configure HTTP client with timeouts and connection pooling
    transport := &http.Transport{
        MaxIdleConns:        100,
        MaxConnsPerHost:     100,
        MaxIdleConnsPerHost: 100,
        IdleConnTimeout:     90 * time.Second,
    }

    client := &http.Client{
        Timeout:   defaultTimeout,
        Transport: transport,
    }

    // Configure rate limiter
    limiter := rate.NewLimiter(rate.Limit(defaultRateLimit), defaultRateLimit)

    // Configure circuit breaker
    breakerSettings := gobreaker.Settings{
        Name:        fmt.Sprintf("rms-client-%s", integration.ID),
        MaxRequests: uint32(maxConcurrentRequests),
        Timeout:     circuitBreakerTimeout,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 10 && failureRatio >= 0.6
        },
        OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
            metrics.WithLabelValues("circuit_breaker_state_change").Inc()
        },
    }

    // Initialize request object pool
    requestPool := &sync.Pool{
        New: func() interface{} {
            return &http.Request{}
        },
    }

    rmsClient := &RMSClient{
        httpClient:  client,
        integration: integration,
        authManager: authManager,
        baseURL:     config.BaseURL,
        rateLimiter: limiter,
        breaker:     gobreaker.NewCircuitBreaker(breakerSettings),
        metrics:     metrics,
        requestPool: requestPool,
    }

    // Perform initial health check
    if err := rmsClient.HealthCheck(context.Background()); err != nil {
        return nil, fmt.Errorf("initial health check failed: %w", err)
    }

    return rmsClient, nil
}

// GetOrders retrieves orders from the RMS system with comprehensive error handling
func (c *RMSClient) GetOrders(ctx context.Context, filters map[string]interface{}) ([]Order, error) {
    startTime := time.Now()
    defer func() {
        c.metrics.WithLabelValues("get_orders_duration_seconds").Add(time.Since(startTime).Seconds())
    }()

    // Check rate limit
    if err := c.rateLimiter.Wait(ctx); err != nil {
        c.metrics.WithLabelValues("rate_limit_exceeded").Inc()
        return nil, fmt.Errorf("rate limit exceeded: %w", err)
    }

    // Get authentication token
    token, err := c.authManager.GetToken(ctx, c.integration.ID)
    if err != nil {
        c.metrics.WithLabelValues("auth_error").Inc()
        return nil, fmt.Errorf("failed to get auth token: %w", err)
    }

    // Prepare request
    url := fmt.Sprintf("%s%s/orders", c.baseURL, baseAPIPath)
    req := c.requestPool.Get().(*http.Request)
    defer c.requestPool.Put(req)

    req.URL.RawQuery = buildQueryString(filters)
    req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))
    req.Header.Set("Content-Type", "application/json")

    var orders []Order
    err = retry.Do(
        func() error {
            return c.breaker.Execute(func() error {
                resp, err := c.httpClient.Do(req)
                if err != nil {
                    c.metrics.WithLabelValues("request_error").Inc()
                    return fmt.Errorf("request failed: %w", err)
                }
                defer resp.Body.Close()

                if resp.StatusCode != http.StatusOK {
                    c.metrics.WithLabelValues("api_error").Inc()
                    return fmt.Errorf("API returned status %d", resp.StatusCode)
                }

                body, err := io.ReadAll(resp.Body)
                if err != nil {
                    return fmt.Errorf("failed to read response: %w", err)
                }

                if err := json.Unmarshal(body, &orders); err != nil {
                    return fmt.Errorf("failed to parse response: %w", err)
                }

                c.metrics.WithLabelValues("success").Inc()
                return nil
            })
        },
        retry.Attempts(maxRetries),
        retry.DelayType(retry.BackOffDelay),
        retry.Context(ctx),
    )

    if err != nil {
        return nil, fmt.Errorf("failed to get orders after %d attempts: %w", maxRetries, err)
    }

    return orders, nil
}

// HealthCheck performs a health check of the RMS API
func (c *RMSClient) HealthCheck(ctx context.Context) error {
    url := fmt.Sprintf("%s%s/health", c.baseURL, baseAPIPath)
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return fmt.Errorf("failed to create health check request: %w", err)
    }

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return fmt.Errorf("health check request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
    }

    return nil
}

// Order represents an RMS order with comprehensive fields
type Order struct {
    ID          string    `json:"id"`
    CustomerID  string    `json:"customer_id"`
    Status      string    `json:"status"`
    Items       []Item    `json:"items"`
    TotalAmount float64   `json:"total_amount"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

// Item represents an order item
type Item struct {
    ID       string  `json:"id"`
    Name     string  `json:"name"`
    Quantity int     `json:"quantity"`
    Price    float64 `json:"price"`
}

// buildQueryString converts a map of filters to a URL query string
func buildQueryString(filters map[string]interface{}) string {
    if len(filters) == 0 {
        return ""
    }

    values := make(url.Values)
    for key, value := range filters {
        values.Add(key, fmt.Sprintf("%v", value))
    }
    return values.Encode()
}