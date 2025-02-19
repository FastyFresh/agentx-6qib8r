"""
NLP Engine Initialization Module
Version: 1.0.0

Provides core language processing components with enhanced logging, monitoring,
and error handling capabilities for the AGENT AI Platform.

Dependencies:
logging==3.9.0 - Enhanced logging functionality
traceback==built-in - Detailed error tracking
atexit==built-in - Resource cleanup management
"""

import logging
import traceback
import atexit
from typing import Optional

from .services.language_processor import LanguageProcessor
from .config.settings import NLPConfig

# Initialize logger with default configuration
logger = logging.getLogger(__name__)

# Initialize configuration and core components
config = NLPConfig()
language_processor = LanguageProcessor(config)

# Package version
__version__ = '1.0.0'

def configure_logging(log_level: str = 'INFO', 
                     log_format: str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s') -> None:
    """
    Configures enhanced logging for the NLP engine module with structured formats
    and performance monitoring.

    Args:
        log_level (str): Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format (str): Format string for log messages

    Raises:
        ValueError: If invalid log level is provided
    """
    try:
        # Validate and set log level
        numeric_level = getattr(logging, log_level.upper(), None)
        if not isinstance(numeric_level, int):
            raise ValueError(f'Invalid log level: {log_level}')

        # Configure root logger
        logging.basicConfig(
            level=numeric_level,
            format=log_format,
            handlers=[
                logging.StreamHandler(),  # Console output
                logging.FileHandler(  # File output with rotation
                    filename='nlp_engine.log',
                    mode='a',
                    encoding='utf-8'
                )
            ]
        )

        # Set module-specific logger
        logger.setLevel(numeric_level)

        # Add performance monitoring handler
        perf_handler = logging.FileHandler(
            filename='nlp_performance.log',
            mode='a',
            encoding='utf-8'
        )
        perf_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        perf_handler.addFilter(lambda record: 'performance' in record.getMessage().lower())
        logger.addHandler(perf_handler)

        logger.info(f"Logging configured successfully at {log_level} level")

    except Exception as e:
        logger.error(f"Failed to configure logging: {str(e)}")
        logger.error(traceback.format_exc())
        raise

@atexit.register
def cleanup_resources() -> None:
    """
    Performs cleanup of module resources on shutdown.
    Registered with atexit to ensure proper cleanup.

    Raises:
        RuntimeError: If cleanup fails
    """
    try:
        logger.info("Starting NLP Engine cleanup...")

        # Clean up language processor resources
        if language_processor:
            language_processor._entity_extractor.cleanup_resources()
            logger.info("Entity extractor resources cleaned up")

        # Close file handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)

        # Clear any cached data
        if hasattr(language_processor, '_cache'):
            language_processor._cache.clear()

        logger.info("NLP Engine cleanup completed successfully")

    except Exception as e:
        logger.error(f"Failed to cleanup resources: {str(e)}")
        logger.error(traceback.format_exc())
        raise RuntimeError("Resource cleanup failed") from e

# Export core components and utilities
__all__ = [
    'LanguageProcessor',
    'config',
    '__version__',
    'configure_logging',
    'cleanup_resources'
]