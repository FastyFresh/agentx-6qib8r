"""
Comprehensive test suite for the IntentClassifier class.
Tests intent classification functionality, model behavior, performance requirements,
error handling, and resource utilization across different environments.

Dependencies:
pytest==7.4.0 - Testing framework
numpy==1.24.0 - Numerical operations
time==built-in - Performance timing
memory-profiler==0.61.0 - Memory usage monitoring
pytest-asyncio==0.21.0 - Async test support
"""

import pytest
import numpy as np
import time
from memory_profiler import profile
import pytest_asyncio

from ..src.models.intent_classifier import IntentClassifier
from ..src.config.settings import NLPConfig

# Test data constants
TEST_TEXTS = [
    'create a new sales agent',
    'modify existing agent',
    'delete agent',
    'what is the status',
    'connect to zoho',
    'help me'
]

EXPECTED_INTENTS = [
    'create_agent',
    'modify_agent',
    'delete_agent',
    'query_status',
    'configure_integration',
    'help'
]

PERFORMANCE_THRESHOLDS = {
    'single_request': 0.200,  # 200ms max response time
    'batch_request': 0.500,   # 500ms max for batch
    'memory_increase': 50.0   # Maximum memory increase in MB
}

ERROR_TEXTS = [
    '',
    'invalid!@#$',
    'unknown command xyz'
]

@pytest.fixture(scope='module')
def setup_module():
    """
    Module-level setup for intent classifier tests.
    Configures test environment and initializes classifier instance.
    """
    try:
        # Initialize configuration with test settings
        config = NLPConfig()
        
        # Override confidence threshold for testing
        config.CONFIDENCE_THRESHOLD = 0.8
        
        # Initialize classifier
        classifier = IntentClassifier(config)
        
        # Verify model initialization
        assert classifier._model is not None, "Model failed to initialize"
        assert classifier._preprocessor is not None, "Preprocessor failed to initialize"
        
        return classifier
        
    except Exception as e:
        pytest.fail(f"Test setup failed: {str(e)}")

@pytest.mark.asyncio
async def test_classify_intent(setup_module):
    """
    Tests single text intent classification with comprehensive validation.
    Verifies accuracy, performance, and response format.
    """
    classifier = setup_module
    
    for text, expected_intent in zip(TEST_TEXTS, EXPECTED_INTENTS):
        # Measure response time
        start_time = time.time()
        result = classifier.classify_intent(text)
        response_time = time.time() - start_time
        
        # Validate response format
        assert isinstance(result, dict), "Result should be a dictionary"
        assert all(k in result for k in ['intent', 'confidence', 'status']), "Missing required fields"
        
        # Validate intent classification
        assert result['intent'] == expected_intent, f"Wrong intent for text: {text}"
        assert 0 <= result['confidence'] <= 1, "Confidence score out of range"
        assert result['confidence'] >= classifier.confidence_threshold, "Confidence below threshold"
        
        # Verify performance
        assert response_time < PERFORMANCE_THRESHOLDS['single_request'], \
            f"Response time {response_time}s exceeds threshold"

@pytest.mark.asyncio
async def test_classify_batch(setup_module):
    """
    Tests batch intent classification with varying batch sizes.
    Verifies performance scaling and result consistency.
    """
    classifier = setup_module
    
    # Test different batch sizes
    batch_sizes = [1, 10, 100]
    
    for batch_size in batch_sizes:
        # Create batch by repeating test texts
        batch_texts = TEST_TEXTS * (batch_size // len(TEST_TEXTS) + 1)
        batch_texts = batch_texts[:batch_size]
        
        # Measure batch processing time
        start_time = time.time()
        results = classifier.classify_batch(batch_texts)
        batch_time = time.time() - start_time
        
        # Validate results
        assert len(results) == batch_size, "Wrong number of results"
        assert all(isinstance(r, dict) for r in results), "Invalid result format"
        
        # Verify batch performance
        assert batch_time < PERFORMANCE_THRESHOLDS['batch_request'], \
            f"Batch processing time {batch_time}s exceeds threshold"
        
        # Verify first set of results matches expected intents
        for result, expected_intent in zip(results[:len(TEST_TEXTS)], EXPECTED_INTENTS):
            assert result['intent'] == expected_intent, "Incorrect batch classification"

@pytest.mark.asyncio
@pytest.mark.performance
@profile
async def test_performance(setup_module):
    """
    Comprehensive performance testing with resource monitoring.
    Validates response times and memory usage.
    """
    classifier = setup_module
    
    # Test single request performance
    start_time = time.time()
    result = classifier.classify_intent(TEST_TEXTS[0])
    single_time = time.time() - start_time
    assert single_time < PERFORMANCE_THRESHOLDS['single_request'], "Single request too slow"
    
    # Test batch request performance
    start_time = time.time()
    results = classifier.classify_batch(TEST_TEXTS)
    batch_time = time.time() - start_time
    assert batch_time < PERFORMANCE_THRESHOLDS['batch_request'], "Batch request too slow"
    
    # Test concurrent requests
    start_time = time.time()
    concurrent_results = await pytest.asyncio.gather(*[
        classifier.classify_intent(text) for text in TEST_TEXTS
    ])
    concurrent_time = time.time() - start_time
    assert concurrent_time < PERFORMANCE_THRESHOLDS['batch_request'], "Concurrent requests too slow"

@pytest.mark.asyncio
async def test_predict_proba(setup_module):
    """
    Tests probability distribution prediction with statistical validation.
    Verifies probability ranges and distribution properties.
    """
    classifier = setup_module
    
    for text in TEST_TEXTS:
        # Get probability distribution
        probabilities = classifier.predict_proba(text)
        
        # Validate probability format
        assert isinstance(probabilities, dict), "Invalid probability format"
        assert len(probabilities) == len(EXPECTED_INTENTS), "Wrong number of probabilities"
        
        # Verify probability properties
        prob_values = list(probabilities.values())
        assert all(0 <= p <= 1 for p in prob_values), "Probabilities out of range"
        assert abs(sum(prob_values) - 1.0) < 1e-6, "Probabilities don't sum to 1"
        
        # Verify highest probability intent matches classify_intent
        max_intent = max(probabilities.items(), key=lambda x: x[1])[0]
        result = classifier.classify_intent(text)
        assert result['intent'] == max_intent, "Probability prediction mismatch"

@pytest.mark.asyncio
async def test_error_handling(setup_module):
    """
    Comprehensive error case testing.
    Verifies proper handling of invalid inputs and edge cases.
    """
    classifier = setup_module
    
    # Test empty input
    with pytest.raises(ValueError):
        classifier.classify_intent("")
    
    # Test invalid inputs
    for error_text in ERROR_TEXTS:
        result = classifier.classify_intent(error_text)
        assert result['intent'] == 'unknown', "Invalid input not properly handled"
        assert result['status'] == 'low_confidence', "Wrong status for invalid input"
    
    # Test batch error handling
    with pytest.raises(ValueError):
        classifier.classify_batch([])
    
    with pytest.raises(ValueError):
        classifier.classify_batch(None)
    
    # Test invalid probability prediction
    with pytest.raises(RuntimeError):
        classifier.predict_proba(None)