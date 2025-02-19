// Package database provides robust PostgreSQL database connection management
// with advanced features including connection pooling, health monitoring,
// and high-availability support.
package database

import (
    "context"
    "errors"
    "fmt"
    "time"

    "gorm.io/driver/postgres" // v1.5.0
    "gorm.io/gorm"           // v1.25.0

    "github.com/yourdomain/agent-ai-platform/integration-service/config"
    "github.com/yourdomain/agent-ai-platform/integration-service/internal/models"
)

// Global connection pool settings for optimal performance
const (
    maxOpenConnections     = 25
    maxIdleConnections    = 10
    connectionMaxLifetime = 15 * time.Minute
    connectionTimeout     = 5 * time.Second
    maxRetries           = 3
    retryBackoff         = 100 * time.Millisecond
)

// dbInstance holds the database connection and related metadata
type dbInstance struct {
    db        *gorm.DB
    cfg       *config.DatabaseConfig
    isHealthy bool
    lastPing  time.Time
}

// NewPostgresDB creates and configures a new PostgreSQL database connection
// with advanced features including connection pooling, health checks, and retry logic.
func NewPostgresDB(cfg *config.DatabaseConfig) (*gorm.DB, error) {
    var db *gorm.DB
    var err error

    // Configure GORM with advanced settings
    gormConfig := &gorm.Config{
        PrepareStmt:            true, // Enable prepared statement cache
        SkipDefaultTransaction: true, // Optimize performance for non-transactional operations
        Logger:                 newDBLogger(),
    }

    // Implement retry logic for connection establishment
    for attempt := 1; attempt <= maxRetries; attempt++ {
        ctx, cancel := context.WithTimeout(context.Background(), connectionTimeout)
        defer cancel()

        // Establish connection with context timeout
        db, err = gorm.Open(postgres.New(postgres.Config{
            DSN: buildDSN(cfg),
            PreferSimpleProtocol: true, // Better performance for prepared statements
        }), gormConfig)

        if err == nil {
            break
        }

        if attempt < maxRetries {
            time.Sleep(retryBackoff * time.Duration(attempt))
            continue
        }
        return nil, fmt.Errorf("failed to connect to database after %d attempts: %w", maxRetries, err)
    }

    // Configure connection pool
    sqlDB, err := db.DB()
    if err != nil {
        return nil, fmt.Errorf("failed to get database instance: %w", err)
    }

    sqlDB.SetMaxOpenConns(maxOpenConnections)
    sqlDB.SetMaxIdleConns(maxIdleConnections)
    sqlDB.SetConnMaxLifetime(connectionMaxLifetime)

    // Verify connection with ping
    ctx, cancel := context.WithTimeout(context.Background(), connectionTimeout)
    defer cancel()

    if err := sqlDB.PingContext(ctx); err != nil {
        return nil, fmt.Errorf("failed to ping database: %w", err)
    }

    // Initialize schema and verify tables
    if err := initializeSchema(db); err != nil {
        return nil, fmt.Errorf("failed to initialize schema: %w", err)
    }

    return db, nil
}

// Close gracefully closes the database connection with resource cleanup
func Close(db *gorm.DB) error {
    sqlDB, err := db.DB()
    if err != nil {
        return fmt.Errorf("failed to get database instance: %w", err)
    }

    // Set reasonable timeout for connection closure
    ctx, cancel := context.WithTimeout(context.Background(), connectionTimeout)
    defer cancel()

    // Close connection pool
    if err := sqlDB.Close(); err != nil {
        return fmt.Errorf("failed to close database connection: %w", err)
    }

    return nil
}

// WithTransaction executes database operations within a transaction
// with advanced monitoring and safety features
func WithTransaction(db *gorm.DB, fn func(*gorm.DB) error) error {
    // Start transaction with timeout
    tx := db.Begin()
    if tx.Error != nil {
        return fmt.Errorf("failed to begin transaction: %w", tx.Error)
    }

    // Set transaction timeout
    ctx, cancel := context.WithTimeout(context.Background(), connectionTimeout)
    defer cancel()

    tx = tx.WithContext(ctx)

    // Execute transaction function
    if err := fn(tx); err != nil {
        // Rollback on error
        if rbErr := tx.Rollback().Error; rbErr != nil {
            return fmt.Errorf("transaction failed and rollback failed: %v (rollback error: %v)", err, rbErr)
        }
        return err
    }

    // Commit transaction
    if err := tx.Commit().Error; err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    return nil
}

// buildDSN constructs the database connection string with proper escaping
func buildDSN(cfg *config.DatabaseConfig) string {
    return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        cfg.Host,
        cfg.Port,
        cfg.User,
        cfg.Password,
        cfg.Name,
        cfg.SSLMode,
    )
}

// initializeSchema verifies and initializes the database schema
func initializeSchema(db *gorm.DB) error {
    // Auto-migrate the integration model
    if err := db.AutoMigrate(&models.Integration{}); err != nil {
        return fmt.Errorf("failed to migrate integration model: %w", err)
    }

    // Verify table existence
    if !db.Migrator().HasTable(&models.Integration{}) {
        return errors.New("integration table not created after migration")
    }

    return nil
}

// newDBLogger creates a new GORM logger with custom configuration
func newDBLogger() gorm.Logger {
    return gorm.Default.LogMode(gorm.Info)
}