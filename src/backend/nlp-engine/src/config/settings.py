"""
Configuration settings module for the NLP Engine service.
Provides centralized configuration management with environment variable support and validation.

Dependencies:
pydantic==2.0.0 - Settings management and validation
python-dotenv==1.0.0 - Environment variable management
"""

import os
from typing import Dict, Any
from pydantic import BaseModel, Field, ValidationError
from dotenv import load_dotenv

# Default configuration values
DEFAULT_MODEL_PATH = 'models/nlp'
DEFAULT_MAX_SEQUENCE_LENGTH = 512
DEFAULT_BATCH_SIZE = 32
DEFAULT_CONFIDENCE_THRESHOLD = 0.95

# Load environment variables from .env file
load_dotenv()

class ModelParameters(BaseModel):
    """Model-specific parameter validation schema"""
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    max_tokens: int = Field(default=2048, ge=1)
    presence_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)

class APIConfig(BaseModel):
    """API configuration validation schema"""
    timeout_seconds: float = Field(default=10.0, ge=0.1)
    rate_limit_requests: int = Field(default=100, ge=1)
    rate_limit_period_seconds: int = Field(default=60, ge=1)
    max_retries: int = Field(default=3, ge=0)
    retry_delay_seconds: float = Field(default=1.0, ge=0.1)

class NLPConfig:
    """
    Pydantic settings class for NLP engine configuration management.
    Provides environment variable support and comprehensive validation.
    """

    def __init__(self):
        """Initialize NLP configuration with environment variables and defaults"""
        # Load model configuration from environment or defaults
        self.MODEL_PATH = os.getenv('NLP_MODEL_PATH', DEFAULT_MODEL_PATH)
        self.MAX_SEQUENCE_LENGTH = int(os.getenv('NLP_MAX_SEQUENCE_LENGTH', DEFAULT_MAX_SEQUENCE_LENGTH))
        self.BATCH_SIZE = int(os.getenv('NLP_BATCH_SIZE', DEFAULT_BATCH_SIZE))
        self.CONFIDENCE_THRESHOLD = float(os.getenv('NLP_CONFIDENCE_THRESHOLD', DEFAULT_CONFIDENCE_THRESHOLD))

        # Initialize model parameters with environment overrides
        self.MODEL_PARAMETERS = ModelParameters(
            temperature=float(os.getenv('NLP_TEMPERATURE', 0.7)),
            top_p=float(os.getenv('NLP_TOP_P', 0.9)),
            max_tokens=int(os.getenv('NLP_MAX_TOKENS', 2048)),
            presence_penalty=float(os.getenv('NLP_PRESENCE_PENALTY', 0.0)),
            frequency_penalty=float(os.getenv('NLP_FREQUENCY_PENALTY', 0.0))
        ).model_dump()

        # Initialize API configuration with environment overrides
        self.API_CONFIG = APIConfig(
            timeout_seconds=float(os.getenv('NLP_API_TIMEOUT', 10.0)),
            rate_limit_requests=int(os.getenv('NLP_RATE_LIMIT_REQUESTS', 100)),
            rate_limit_period_seconds=int(os.getenv('NLP_RATE_LIMIT_PERIOD', 60)),
            max_retries=int(os.getenv('NLP_MAX_RETRIES', 3)),
            retry_delay_seconds=float(os.getenv('NLP_RETRY_DELAY', 1.0))
        ).model_dump()

        # Validate the complete configuration
        self.validate_configuration()

    def get_model_config(self) -> Dict[str, Any]:
        """
        Returns validated model-specific configuration parameters.
        
        Returns:
            dict: Validated model configuration parameters
        
        Raises:
            ValidationError: If configuration validation fails
        """
        model_config = {
            'model_path': self.MODEL_PATH,
            'max_sequence_length': self.MAX_SEQUENCE_LENGTH,
            'batch_size': self.BATCH_SIZE,
            'confidence_threshold': self.CONFIDENCE_THRESHOLD,
            **self.MODEL_PARAMETERS
        }
        
        # Validate model configuration
        if not all(key in model_config for key in ['model_path', 'max_sequence_length', 'batch_size']):
            raise ValidationError("Missing required model configuration parameters")
            
        return model_config

    def get_api_config(self) -> Dict[str, Any]:
        """
        Returns validated API-specific configuration parameters.
        
        Returns:
            dict: Validated API configuration parameters
        
        Raises:
            ValidationError: If configuration validation fails
        """
        # Ensure API configuration meets performance requirements
        if self.API_CONFIG['timeout_seconds'] > 0.2:  # 200ms requirement
            raise ValidationError("API timeout exceeds performance requirements")
            
        return self.API_CONFIG

    def validate_configuration(self) -> bool:
        """
        Performs comprehensive validation of all configuration settings.
        
        Returns:
            bool: True if configuration is valid
        
        Raises:
            ValidationError: If configuration validation fails
        """
        # Validate model path exists
        if not os.path.exists(self.MODEL_PATH):
            raise ValidationError(f"Model path does not exist: {self.MODEL_PATH}")

        # Validate sequence length
        if not 0 < self.MAX_SEQUENCE_LENGTH <= 2048:
            raise ValidationError("Invalid max sequence length")

        # Validate batch size
        if not 0 < self.BATCH_SIZE <= 128:
            raise ValidationError("Invalid batch size")

        # Validate confidence threshold
        if not 0 < self.CONFIDENCE_THRESHOLD <= 1:
            raise ValidationError("Invalid confidence threshold")

        # Validate model parameters
        ModelParameters(**self.MODEL_PARAMETERS)

        # Validate API configuration
        APIConfig(**self.API_CONFIG)

        return True