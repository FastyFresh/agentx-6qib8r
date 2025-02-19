// Package config provides secure configuration management for the integration service
// with enhanced validation, encryption, and monitoring capabilities.
package config

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-playground/validator/v10"
	"gopkg.in/yaml.v3"
)

// Version: gopkg.in/yaml.v3 v3.0.1
// Version: github.com/go-playground/validator/v10 v10.11.0

const (
	defaultConfigPath = "/etc/integration-service/config.yaml"
	configVersion    = "1.0.0"
)

var (
	defaultTimeouts = struct {
		read        time.Duration
		write       time.Duration
		shutdown    time.Duration
		integration time.Duration
	}{
		read:        30 * time.Second,
		write:       30 * time.Second,
		shutdown:    15 * time.Second,
		integration: 10 * time.Second,
	}
)

// Config represents the main configuration structure with comprehensive validation
type Config struct {
	Version        string         `yaml:"version" validate:"required"`
	DatabaseConfig DatabaseConfig `yaml:"database" validate:"required"`
	ServerConfig   ServerConfig   `yaml:"server" validate:"required"`
	ZohoCRMConfig  ZohoCRMConfig  `yaml:"zohocrm" validate:"required"`
	RMSConfig      RMSConfig      `yaml:"rms" validate:"required"`
	LogConfig      LogConfig      `yaml:"logging" validate:"required"`
	SecurityConfig SecurityConfig  `yaml:"security" validate:"required"`
	mu            sync.RWMutex    // Protects concurrent access to configuration
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host     string `yaml:"host" validate:"required"`
	Port     int    `yaml:"port" validate:"required,min=1,max=65535"`
	Name     string `yaml:"name" validate:"required"`
	User     string `yaml:"user" validate:"required"`
	Password string `yaml:"password" validate:"required" encrypt:"true"`
	SSLMode  string `yaml:"ssl_mode" validate:"required,oneof=disable verify-full verify-ca require"`
}

// ServerConfig contains HTTP server settings
type ServerConfig struct {
	Host            string        `yaml:"host" validate:"required"`
	Port            int          `yaml:"port" validate:"required,min=1,max=65535"`
	ReadTimeout     time.Duration `yaml:"read_timeout" validate:"required"`
	WriteTimeout    time.Duration `yaml:"write_timeout" validate:"required"`
	ShutdownTimeout time.Duration `yaml:"shutdown_timeout" validate:"required"`
}

// ZohoCRMConfig holds Zoho CRM integration settings
type ZohoCRMConfig struct {
	BaseURL      string `yaml:"base_url" validate:"required,url"`
	ClientID     string `yaml:"client_id" validate:"required"`
	ClientSecret string `yaml:"client_secret" validate:"required" encrypt:"true"`
	RefreshToken string `yaml:"refresh_token" validate:"required" encrypt:"true"`
	Timeout      time.Duration `yaml:"timeout" validate:"required"`
}

// RMSConfig contains Restaurant Management System settings
type RMSConfig struct {
	BaseURL    string `yaml:"base_url" validate:"required,url"`
	APIKey     string `yaml:"api_key" validate:"required" encrypt:"true"`
	APIVersion string `yaml:"api_version" validate:"required"`
	Timeout    time.Duration `yaml:"timeout" validate:"required"`
}

// LogConfig defines logging configuration
type LogConfig struct {
	Level      string `yaml:"level" validate:"required,oneof=debug info warn error"`
	Format     string `yaml:"format" validate:"required,oneof=json text"`
	OutputPath string `yaml:"output_path" validate:"required"`
}

// SecurityConfig holds security-related settings
type SecurityConfig struct {
	EncryptionKey   string   `yaml:"encryption_key" validate:"required,min=32"`
	EnableAudit     bool     `yaml:"enable_audit" validate:"required"`
	AllowedOrigins  []string `yaml:"allowed_origins" validate:"required,dive,url"`
	TLSCertPath     string   `yaml:"tls_cert_path" validate:"required,file"`
	TLSKeyPath      string   `yaml:"tls_key_path" validate:"required,file"`
}

// LoadConfig loads and validates configuration from the specified path
func LoadConfig(configPath string) (*Config, error) {
	if configPath == "" {
		configPath = defaultConfigPath
	}

	// Verify file permissions
	info, err := os.Stat(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat config file: %w", err)
	}
	if info.Mode().Perm()&0077 != 0 {
		return nil, fmt.Errorf("config file has too permissive permissions: %v", info.Mode().Perm())
	}

	// Read configuration file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set default values
	if err := setDefaults(&cfg); err != nil {
		return nil, fmt.Errorf("failed to set defaults: %w", err)
	}

	// Override with environment variables
	if err := overrideFromEnv(&cfg); err != nil {
		return nil, fmt.Errorf("failed to override from environment: %w", err)
	}

	// Validate configuration
	if err := validate(&cfg); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	// Decrypt sensitive values
	if err := decryptSensitiveValues(&cfg); err != nil {
		return nil, fmt.Errorf("failed to decrypt sensitive values: %w", err)
	}

	return &cfg, nil
}

// validate performs comprehensive configuration validation
func validate(cfg *Config) error {
	validate := validator.New()

	// Register custom validators
	if err := registerCustomValidators(validate); err != nil {
		return fmt.Errorf("failed to register custom validators: %w", err)
	}

	if err := validate.Struct(cfg); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Version check
	if cfg.Version != configVersion {
		return fmt.Errorf("unsupported config version: %s (expected %s)", cfg.Version, configVersion)
	}

	return nil
}

// WatchConfig monitors the configuration file for changes
func WatchConfig(cfg *Config, done chan bool) error {
	watcher, err := newConfigWatcher(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize config watcher: %w", err)
	}
	defer watcher.Close()

	go func() {
		for {
			select {
			case event := <-watcher.Events:
				if event.Op&(os.Write|os.Create) != 0 {
					if err := handleConfigChange(cfg); err != nil {
						fmt.Printf("Error reloading config: %v\n", err)
					}
				}
			case err := <-watcher.Errors:
				fmt.Printf("Config watcher error: %v\n", err)
			case <-done:
				return
			}
		}
	}()

	return nil
}

// setDefaults sets default values for optional configuration fields
func setDefaults(cfg *Config) error {
	if cfg.ServerConfig.ReadTimeout == 0 {
		cfg.ServerConfig.ReadTimeout = defaultTimeouts.read
	}
	if cfg.ServerConfig.WriteTimeout == 0 {
		cfg.ServerConfig.WriteTimeout = defaultTimeouts.write
	}
	if cfg.ServerConfig.ShutdownTimeout == 0 {
		cfg.ServerConfig.ShutdownTimeout = defaultTimeouts.shutdown
	}
	if cfg.ZohoCRMConfig.Timeout == 0 {
		cfg.ZohoCRMConfig.Timeout = defaultTimeouts.integration
	}
	if cfg.RMSConfig.Timeout == 0 {
		cfg.RMSConfig.Timeout = defaultTimeouts.integration
	}
	return nil
}

// decryptSensitiveValues decrypts configuration values marked for encryption
func decryptSensitiveValues(cfg *Config) error {
	key := []byte(cfg.SecurityConfig.EncryptionKey)
	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt database password
	if cfg.DatabaseConfig.Password != "" {
		decrypted, err := decryptValue(cfg.DatabaseConfig.Password, gcm)
		if err != nil {
			return fmt.Errorf("failed to decrypt database password: %w", err)
		}
		cfg.DatabaseConfig.Password = decrypted
	}

	// Decrypt Zoho CRM credentials
	if cfg.ZohoCRMConfig.ClientSecret != "" {
		decrypted, err := decryptValue(cfg.ZohoCRMConfig.ClientSecret, gcm)
		if err != nil {
			return fmt.Errorf("failed to decrypt Zoho client secret: %w", err)
		}
		cfg.ZohoCRMConfig.ClientSecret = decrypted
	}

	// Decrypt RMS API key
	if cfg.RMSConfig.APIKey != "" {
		decrypted, err := decryptValue(cfg.RMSConfig.APIKey, gcm)
		if err != nil {
			return fmt.Errorf("failed to decrypt RMS API key: %w", err)
		}
		cfg.RMSConfig.APIKey = decrypted
	}

	return nil
}

// decryptValue decrypts a single encrypted value
func decryptValue(encrypted string, gcm cipher.AEAD) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(data) < gcm.NonceSize() {
		return "", fmt.Errorf("invalid encrypted value length")
	}

	nonce := data[:gcm.NonceSize()]
	ciphertext := data[gcm.NonceSize():]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// overrideFromEnv overrides configuration values from environment variables
func overrideFromEnv(cfg *Config) error {
	// Database configuration
	if host := os.Getenv("DB_HOST"); host != "" {
		cfg.DatabaseConfig.Host = host
	}
	if port := os.Getenv("DB_PORT"); port != "" {
		cfg.DatabaseConfig.Port = parseInt(port, cfg.DatabaseConfig.Port)
	}

	// Server configuration
	if port := os.Getenv("SERVER_PORT"); port != "" {
		cfg.ServerConfig.Port = parseInt(port, cfg.ServerConfig.Port)
	}

	// Integration configurations can be overridden similarly
	return nil
}

// parseInt safely parses an integer with fallback
func parseInt(s string, fallback int) int {
	if v, err := fmt.Sscanf(s, "%d", &fallback); err != nil || v != 1 {
		return fallback
	}
	return fallback
}

// registerCustomValidators registers custom validation functions
func registerCustomValidators(v *validator.Validate) error {
	if err := v.RegisterValidation("file", validateFile); err != nil {
		return fmt.Errorf("failed to register file validator: %w", err)
	}
	return nil
}

// validateFile validates file existence and permissions
func validateFile(fl validator.FieldLevel) bool {
	path := fl.Field().String()
	if path == "" {
		return false
	}

	info, err := os.Stat(path)
	if err != nil {
		return false
	}

	// Check file permissions (only owner should have access)
	return info.Mode().Perm()&0077 == 0
}