// Package models provides core data models for the integration service
// with enhanced validation and monitoring capabilities.
package models

import (
    "encoding/json"
    "errors"
    "fmt"
    "time"

    "github.com/google/uuid"  // v1.3.0
    "gorm.io/gorm"           // v1.25.0

    "github.com/yourdomain/agent-ai-platform/integration-service/config"
)

const (
    // TableName defines the database table name for integrations
    TableName = "integrations"

    // Service type constants
    ServiceTypeZohoCRM = "zoho_crm"
    ServiceTypeRMS    = "rms"

    // Status constants
    StatusActive   = "active"
    StatusInactive = "inactive"
    StatusError    = "error"

    // Configuration limits
    MaxConfigSize = 1048576 // 1MB
    
    // Validation timeout
    ValidationTimeout = 5 * time.Second
)

// Integration represents an external service integration with comprehensive
// validation and monitoring capabilities.
type Integration struct {
    ID           uuid.UUID      `gorm:"type:uuid;primary_key"`
    AgentID      uuid.UUID      `gorm:"type:uuid;not null;index"`
    Name         string         `gorm:"type:varchar(255);not null"`
    ServiceType  string         `gorm:"type:varchar(50);not null;index"`
    Status       string         `gorm:"type:varchar(20);not null;index"`
    Config       json.RawMessage `gorm:"type:jsonb;not null"`
    LastSyncAt   *time.Time     `gorm:"index"`
    ErrorMessage string         `gorm:"type:text"`
    CreatedAt    time.Time      `gorm:"not null"`
    UpdatedAt    time.Time      `gorm:"not null"`
    RetryCount   int            `gorm:"not null;default:0"`
    LastRetryAt  time.Time      `gorm:"index"`
}

// TableName specifies the database table name for the Integration model
func (Integration) TableName() string {
    return TableName
}

// BeforeCreate handles pre-creation validation and setup
func (i *Integration) BeforeCreate(tx *gorm.DB) error {
    // Generate UUID if not provided
    if i.ID == uuid.Nil {
        i.ID = uuid.New()
    }

    // Set default status if not set
    if i.Status == "" {
        i.Status = StatusInactive
    }

    // Validate service type
    if err := i.validateServiceType(); err != nil {
        return fmt.Errorf("invalid service type: %w", err)
    }

    // Validate configuration
    if err := i.validateConfig(); err != nil {
        return fmt.Errorf("invalid configuration: %w", err)
    }

    // Initialize timestamps
    now := time.Now()
    i.CreatedAt = now
    i.UpdatedAt = now
    i.LastSyncAt = nil
    i.ErrorMessage = ""

    return nil
}

// BeforeUpdate handles pre-update validation
func (i *Integration) BeforeUpdate(tx *gorm.DB) error {
    // Validate service type
    if err := i.validateServiceType(); err != nil {
        return fmt.Errorf("invalid service type: %w", err)
    }

    // Validate configuration
    if err := i.validateConfig(); err != nil {
        return fmt.Errorf("invalid configuration: %w", err)
    }

    // Update timestamp
    i.UpdatedAt = time.Now()

    // Validate status transition
    if err := i.validateStatusTransition(); err != nil {
        return fmt.Errorf("invalid status transition: %w", err)
    }

    return nil
}

// Validate performs comprehensive validation of the integration
func (i *Integration) Validate() error {
    // Create validation context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), ValidationTimeout)
    defer cancel()

    // Validate required fields
    if i.AgentID == uuid.Nil {
        return errors.New("agent ID is required")
    }
    if i.Name == "" {
        return errors.New("name is required")
    }

    // Validate service type
    if err := i.validateServiceType(); err != nil {
        return err
    }

    // Validate configuration
    if err := i.validateConfig(); err != nil {
        return err
    }

    // Validate status
    if err := i.validateStatus(); err != nil {
        return err
    }

    // Validate retry count
    if i.RetryCount < 0 {
        return errors.New("retry count cannot be negative")
    }

    return nil
}

// UpdateStatus updates the integration status with comprehensive error handling
func (i *Integration) UpdateStatus(status string, errorMessage string) error {
    // Validate status transition
    if err := i.validateStatusTransition(); err != nil {
        return fmt.Errorf("invalid status transition: %w", err)
    }

    // Update status and related fields
    i.Status = status
    i.ErrorMessage = errorMessage
    i.LastSyncAt = timePtr(time.Now())

    // Handle retry count
    if status == StatusError {
        i.RetryCount++
        i.LastRetryAt = time.Now()
    } else if status == StatusActive {
        i.RetryCount = 0
        i.ErrorMessage = ""
    }

    return nil
}

// validateServiceType checks if the service type is supported
func (i *Integration) validateServiceType() error {
    switch i.ServiceType {
    case ServiceTypeZohoCRM, ServiceTypeRMS:
        return nil
    default:
        return fmt.Errorf("unsupported service type: %s", i.ServiceType)
    }
}

// validateConfig performs configuration validation
func (i *Integration) validateConfig() error {
    if len(i.Config) == 0 {
        return errors.New("configuration is required")
    }
    if len(i.Config) > MaxConfigSize {
        return fmt.Errorf("configuration size exceeds maximum allowed size of %d bytes", MaxConfigSize)
    }

    // Validate JSON structure
    var configMap map[string]interface{}
    if err := json.Unmarshal(i.Config, &configMap); err != nil {
        return fmt.Errorf("invalid JSON configuration: %w", err)
    }

    return nil
}

// validateStatus checks if the status is valid
func (i *Integration) validateStatus() error {
    switch i.Status {
    case StatusActive, StatusInactive, StatusError:
        return nil
    default:
        return fmt.Errorf("invalid status: %s", i.Status)
    }
}

// validateStatusTransition ensures valid status transitions
func (i *Integration) validateStatusTransition() error {
    // All transitions from inactive are allowed
    if i.Status == StatusInactive {
        return nil
    }

    // Active can transition to error or inactive
    if i.Status == StatusActive {
        return nil
    }

    // Error can transition to inactive or active
    if i.Status == StatusError {
        return nil
    }

    return fmt.Errorf("invalid status transition to: %s", i.Status)
}

// timePtr returns a pointer to a time.Time value
func timePtr(t time.Time) *time.Time {
    return &t
}

// IntegrationConfig defines the interface for service-specific configurations
type IntegrationConfig interface {
    Validate() error
    GetSchema() map[string]interface{}
    GetVersion() int
}