"""
Unit test suite for EntityExtractor class with performance validation.

Dependencies:
pytest==7.4.0 - Testing framework with timing and performance plugins
numpy==1.24.0 - Numerical operations for test data
mock==5.0.0 - Mocking functionality for tests
time - Time measurements for performance assertions
"""

import pytest
import numpy as np
from mock import Mock, patch
import time
from typing import List, Dict

from ...src.models.entity_extractor import EntityExtractor, ENTITY_TYPES
from ...src.config.settings import NLPConfig

# Test data constants
TEST_TEXTS = [
    "create a sales agent for zoho crm",
    "schedule daily reports at 9am",
    "set up integration with restaurant management system"
]

EXPECTED_ENTITIES = [
    {
        "type": "AGENT_NAME",
        "value": "sales agent",
        "confidence": 0.95,
        "position": 2
    },
    {
        "type": "INTEGRATION_TYPE", 
        "value": "zoho crm",
        "confidence": 0.98,
        "position": 5
    }
]

# Performance thresholds from technical spec
PERFORMANCE_METRICS = {
    "max_response_time": 200,  # 200ms max response time
    "min_success_rate": 0.999, # 99.9% success rate
    "batch_size": 100  # Batch size for load testing
}

def setup_module(module):
    """Initialize test module configuration and resources."""
    # Configure logging for tests
    import logging
    logging.basicConfig(level=logging.INFO)
    
    # Set up GPU memory limits for testing
    import tensorflow as tf
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        tf.config.experimental.set_memory_growth(gpus[0], True)

def teardown_module(module):
    """Clean up test module resources."""
    import tensorflow as tf
    tf.keras.backend.clear_session()

class TestEntityExtractor:
    """Test suite for EntityExtractor with performance validation."""

    def setup_method(self, method):
        """Set up test environment before each test method."""
        self._config = NLPConfig()
        self._extractor = EntityExtractor(self._config)
        self._performance_metrics = {
            "total_time": 0,
            "successful_calls": 0,
            "total_calls": 0
        }

    def test_extract_entities(self):
        """Test single text entity extraction with performance validation."""
        # Arrange
        test_text = TEST_TEXTS[0]
        
        # Act
        start_time = time.time()
        entities = self._extractor.extract_entities(test_text)
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        # Assert functionality
        assert isinstance(entities, list)
        assert len(entities) > 0
        for entity in entities:
            assert "type" in entity
            assert "confidence" in entity
            assert entity["type"] in ENTITY_TYPES
            assert 0 <= entity["confidence"] <= 1
            
        # Assert performance
        assert response_time < PERFORMANCE_METRICS["max_response_time"], \
            f"Response time {response_time}ms exceeds maximum {PERFORMANCE_METRICS['max_response_time']}ms"
        
        # Update metrics
        self._performance_metrics["total_time"] += response_time
        self._performance_metrics["successful_calls"] += 1
        self._performance_metrics["total_calls"] += 1

    def test_extract_batch(self):
        """Test batch entity extraction with performance metrics."""
        # Arrange
        batch_metrics = {
            "total_time": 0,
            "successful_batches": 0,
            "total_batches": 0
        }
        
        # Act
        start_time = time.time()
        batch_results = self._extractor.extract_batch(TEST_TEXTS)
        batch_time = (time.time() - start_time) * 1000
        
        # Assert functionality
        assert isinstance(batch_results, list)
        assert len(batch_results) == len(TEST_TEXTS)
        for result in batch_results:
            assert isinstance(result, list)
            for entity in result:
                assert "type" in entity
                assert "confidence" in entity
                assert entity["type"] in ENTITY_TYPES
                assert 0 <= entity["confidence"] <= 1
        
        # Assert performance
        avg_time_per_text = batch_time / len(TEST_TEXTS)
        assert avg_time_per_text < PERFORMANCE_METRICS["max_response_time"], \
            f"Average batch processing time {avg_time_per_text}ms exceeds maximum {PERFORMANCE_METRICS['max_response_time']}ms"
        
        # Update metrics
        batch_metrics["total_time"] += batch_time
        batch_metrics["successful_batches"] += 1
        batch_metrics["total_batches"] += 1

    def test_performance_under_load(self):
        """Test entity extraction under high load conditions."""
        # Arrange
        load_test_texts = TEST_TEXTS * (PERFORMANCE_METRICS["batch_size"] // len(TEST_TEXTS))
        performance_results = {
            "total_time": 0,
            "successful_extractions": 0,
            "total_extractions": len(load_test_texts)
        }
        
        # Act
        start_time = time.time()
        for text in load_test_texts:
            try:
                entities = self._extractor.extract_entities(text)
                if entities:
                    performance_results["successful_extractions"] += 1
            except Exception as e:
                pytest.fail(f"Extraction failed under load: {str(e)}")
        total_time = (time.time() - start_time) * 1000
        
        # Calculate success rate
        success_rate = (
            performance_results["successful_extractions"] / 
            performance_results["total_extractions"]
        )
        
        # Assert performance requirements
        assert success_rate >= PERFORMANCE_METRICS["min_success_rate"], \
            f"Success rate {success_rate} below minimum {PERFORMANCE_METRICS['min_success_rate']}"
        
        avg_response_time = total_time / len(load_test_texts)
        assert avg_response_time < PERFORMANCE_METRICS["max_response_time"], \
            f"Average response time {avg_response_time}ms exceeds maximum {PERFORMANCE_METRICS['max_response_time']}ms"
        
        # Log performance metrics
        import logging
        logging.info(
            f"Load test results: Success rate: {success_rate:.3f}, "
            f"Avg response time: {avg_response_time:.2f}ms"
        )