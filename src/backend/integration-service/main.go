// Package main provides the entry point for the integration service with comprehensive
// error handling, monitoring, and graceful shutdown capabilities.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"                 // v2.47.0
	"github.com/gofiber/fiber/v2/middleware/cors" // v2.47.0
	"github.com/gofiber/fiber/v2/middleware/compress" // v2.47.0
	"github.com/prometheus/client_golang/prometheus" // v1.16.0
	"go.uber.org/zap"                              // v1.24.0

	"github.com/yourdomain/agent-ai-platform/integration-service/config"
	"github.com/yourdomain/agent-ai-platform/integration-service/pkg/database"
)

const (
	defaultConfigPath = "/etc/integration-service/config.yaml"
	metricsPrefix    = "integration_service"
	shutdownTimeout  = 15 * time.Second
	readTimeout     = 10 * time.Second
	writeTimeout    = 10 * time.Second
)

func main() {
	// Parse command line flags
	configPath := flag.String("config", defaultConfigPath, "path to configuration file")
	flag.Parse()

	// Create context with cancellation for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize logger
	logger, err := initLogger()
	if err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Load configuration
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	// Initialize database connection
	db, err := database.NewPostgresDB(&cfg.DatabaseConfig)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer database.Close(db)

	// Initialize metrics
	if err := setupMetrics(); err != nil {
		logger.Fatal("Failed to setup metrics", zap.Error(err))
	}

	// Setup HTTP server
	app := setupServer(cfg)

	// Start server in a goroutine
	go func() {
		addr := fmt.Sprintf("%s:%d", cfg.ServerConfig.Host, cfg.ServerConfig.Port)
		if err := app.Listen(addr); err != nil {
			logger.Error("Server error", zap.Error(err))
			cancel()
		}
	}()

	// Wait for shutdown signal
	if err := gracefulShutdown(ctx, app, db, logger); err != nil {
		logger.Error("Error during shutdown", zap.Error(err))
		os.Exit(1)
	}

	logger.Info("Service shutdown completed")
}

// setupServer configures and initializes the HTTP server with security
// and performance optimizations
func setupServer(cfg *config.Config) *fiber.App {
	app := fiber.New(fiber.Config{
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
		IdleTimeout:  120 * time.Second,
		BodyLimit:    10 * 1024 * 1024, // 10MB
	})

	// Security middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.SecurityConfig.AllowedOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		ExposeHeaders:    "Content-Length",
		AllowCredentials: true,
		MaxAge:           24 * 60 * 60, // 24 hours
	}))

	// Compression middleware
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
	}))

	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	// Metrics endpoint
	app.Get("/metrics", func(c *fiber.Ctx) error {
		metrics, err := prometheus.DefaultGatherer.Gather()
		if err != nil {
			return c.Status(500).SendString("Failed to gather metrics")
		}
		return c.JSON(metrics)
	})

	return app
}

// setupMetrics initializes Prometheus metrics collectors
func setupMetrics() error {
	// Request duration histogram
	requestDuration := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: metricsPrefix,
			Name:      "request_duration_seconds",
			Help:      "Request duration in seconds",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"method", "path", "status"},
	)

	// Integration status gauge
	integrationStatus := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: metricsPrefix,
			Name:      "integration_status",
			Help:      "Integration status (1=active, 0=inactive)",
		},
		[]string{"integration_type", "agent_id"},
	)

	// Register metrics
	if err := prometheus.Register(requestDuration); err != nil {
		return fmt.Errorf("failed to register request duration metric: %w", err)
	}
	if err := prometheus.Register(integrationStatus); err != nil {
		return fmt.Errorf("failed to register integration status metric: %w", err)
	}

	return nil
}

// initLogger initializes the structured logger
func initLogger() (*zap.Logger, error) {
	config := zap.NewProductionConfig()
	config.OutputPaths = []string{"stdout"}
	config.ErrorOutputPaths = []string{"stderr"}
	
	return config.Build()
}

// gracefulShutdown manages graceful shutdown of service components
func gracefulShutdown(ctx context.Context, app *fiber.App, db interface{}, logger *zap.Logger) error {
	// Setup shutdown signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

	// Wait for shutdown signal or context cancellation
	select {
	case <-ctx.Done():
		logger.Info("Shutdown initiated by context cancellation")
	case sig := <-sigChan:
		logger.Info("Shutdown initiated by signal", zap.String("signal", sig.String()))
	}

	// Create shutdown context with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	// Shutdown HTTP server
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		return fmt.Errorf("error shutting down HTTP server: %w", err)
	}

	// Close database connection
	if err := database.Close(db); err != nil {
		return fmt.Errorf("error closing database connection: %w", err)
	}

	// Wait for shutdown context
	<-shutdownCtx.Done()
	if err := shutdownCtx.Err(); err != nil && err != context.Canceled {
		return fmt.Errorf("shutdown context error: %w", err)
	}

	return nil
}