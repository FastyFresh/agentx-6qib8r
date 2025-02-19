"""
Core language processing service that orchestrates natural language understanding
with optimized concurrent processing and enhanced validation.

Dependencies:
asyncio==3.4.3 - Asynchronous I/O support
logging==3.9.0 - Enhanced logging functionality
"""

import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime

from ..models.entity_extractor import EntityExtractor
from ..models.intent_classifier import IntentClassifier
from ..utils.text_preprocessor import TextPreprocessor
from ..config.settings import NLPConfig

# Configure structured logging
logger = logging.getLogger(__name__)

class LanguageProcessor:
    """
    Main service class that coordinates natural language understanding with 
    optimized concurrent processing and enhanced validation.
    """

    def __init__(self, config: NLPConfig):
        """
        Initializes the language processor with required components and enhanced configuration.

        Args:
            config (NLPConfig): Configuration instance

        Raises:
            RuntimeError: If initialization fails
        """
        try:
            # Initialize configuration
            self._config = config.get_model_config()
            self._confidence_threshold = config.CONFIDENCE_THRESHOLD
            self._batch_size_limit = config.BATCH_SIZE

            # Initialize core components
            self._entity_extractor = EntityExtractor(config)
            self._intent_classifier = IntentClassifier(config)
            self._preprocessor = TextPreprocessor(config)

            # Initialize performance metrics
            self._performance_metrics = {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'average_latency': 0.0,
                'last_error': None
            }

            # Initialize semaphore for resource management
            self._semaphore = asyncio.Semaphore(10)  # Limit concurrent processing

            logger.info("Language processor initialized successfully")

        except Exception as e:
            logger.error(f"Language processor initialization failed: {str(e)}")
            raise RuntimeError("Failed to initialize language processor") from e

    async def process_text(self, text: str) -> Dict:
        """
        Processes a single text input with concurrent intent and entity extraction.

        Args:
            text (str): Input text to process

        Returns:
            Dict: Processed result containing intent, entities, and confidence scores

        Raises:
            ValueError: If input validation fails
            RuntimeError: If processing fails
        """
        start_time = datetime.now()
        request_id = f"req_{start_time.timestamp()}"

        try:
            logger.info(f"Processing request {request_id}: length={len(text)}")

            # Input validation
            if not text or not isinstance(text, str):
                raise ValueError("Invalid input text")

            if len(text) > self._config['max_sequence_length']:
                raise ValueError("Input text exceeds maximum length")

            # Preprocess text
            processed_text = self._preprocessor.transform(text)

            # Create concurrent tasks for intent and entity processing
            async with self._semaphore:
                intent_task = asyncio.create_task(
                    asyncio.to_thread(self._intent_classifier.classify_intent, text)
                )
                entity_task = asyncio.create_task(
                    asyncio.to_thread(self._entity_extractor.extract_entities, text)
                )

                # Wait for both tasks with timeout
                intent_result, entities_result = await asyncio.gather(
                    intent_task, entity_task,
                    return_exceptions=True
                )

                # Check for exceptions
                for result in [intent_result, entities_result]:
                    if isinstance(result, Exception):
                        raise result

            # Validate and combine results
            validated_result = self._validate_results(intent_result, entities_result)

            # Update performance metrics
            processing_time = (datetime.now() - start_time).total_seconds()
            self._update_metrics(True, processing_time)

            # Prepare enriched output
            result = {
                'request_id': request_id,
                'processing_time': processing_time,
                'status': 'success',
                **validated_result
            }

            logger.info(f"Request {request_id} processed successfully in {processing_time:.3f}s")
            return result

        except Exception as e:
            logger.error(f"Request {request_id} failed: {str(e)}")
            self._update_metrics(False, 0, str(e))
            raise

    async def process_batch(self, texts: List[str]) -> List[Dict]:
        """
        Processes multiple texts concurrently with optimized batching.

        Args:
            texts (List[str]): Batch of input texts

        Returns:
            List[Dict]: Batch of processed results with validation metadata

        Raises:
            ValueError: If input validation fails
            RuntimeError: If batch processing fails
        """
        start_time = datetime.now()
        batch_id = f"batch_{start_time.timestamp()}"

        try:
            logger.info(f"Processing batch {batch_id}: size={len(texts)}")

            # Validate batch size
            if not texts or len(texts) > self._batch_size_limit:
                raise ValueError(f"Invalid batch size. Limit: {self._batch_size_limit}")

            # Process texts in parallel with semaphore control
            tasks = []
            for text in texts:
                task = asyncio.create_task(self.process_text(text))
                tasks.append(task)

            # Gather results with timeout
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results and handle exceptions
            processed_results = []
            for idx, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Batch item {idx} failed: {str(result)}")
                    processed_results.append({
                        'status': 'error',
                        'error': str(result),
                        'original_text': texts[idx]
                    })
                else:
                    processed_results.append(result)

            # Update batch metrics
            processing_time = (datetime.now() - start_time).total_seconds()
            success_rate = len([r for r in processed_results if r['status'] == 'success']) / len(texts)

            logger.info(
                f"Batch {batch_id} processed: {len(texts)} items, "
                f"success rate: {success_rate:.2%}, time: {processing_time:.3f}s"
            )

            return processed_results

        except Exception as e:
            logger.error(f"Batch {batch_id} failed: {str(e)}")
            raise RuntimeError(f"Batch processing failed: {str(e)}") from e

    def _validate_results(self, intent_result: Dict, entities_result: List[Dict]) -> Dict:
        """
        Enhanced validation with confidence scoring and business rules.

        Args:
            intent_result (Dict): Intent classification result
            entities_result (List[Dict]): Entity extraction results

        Returns:
            Dict: Validated and enriched results with confidence scores

        Raises:
            ValueError: If validation fails
        """
        try:
            # Validate confidence thresholds
            intent_confidence = intent_result.get('confidence', 0)
            entity_confidences = [e.get('confidence', 0) for e in entities_result]
            avg_entity_confidence = sum(entity_confidences) / len(entity_confidences) if entity_confidences else 0

            # Validate intent-entity compatibility
            intent = intent_result.get('intent', 'unknown')
            required_entities = {
                'create_agent': ['AGENT_NAME', 'INTEGRATION_TYPE'],
                'modify_agent': ['AGENT_NAME'],
                'delete_agent': ['AGENT_NAME'],
                'configure_integration': ['INTEGRATION_TYPE']
            }

            # Check for required entities
            if intent in required_entities:
                found_types = {e['type'] for e in entities_result}
                missing_types = set(required_entities[intent]) - found_types
                if missing_types:
                    logger.warning(f"Missing required entities for intent {intent}: {missing_types}")

            # Calculate overall confidence
            overall_confidence = (intent_confidence + avg_entity_confidence) / 2

            # Prepare validated result
            validated_result = {
                'intent': {
                    'name': intent,
                    'confidence': intent_confidence
                },
                'entities': entities_result,
                'overall_confidence': overall_confidence,
                'validation_details': {
                    'intent_valid': intent_confidence >= self._confidence_threshold,
                    'entities_valid': avg_entity_confidence >= self._confidence_threshold,
                    'missing_entities': list(missing_types) if intent in required_entities else []
                }
            }

            return validated_result

        except Exception as e:
            logger.error(f"Result validation failed: {str(e)}")
            raise ValueError(f"Result validation failed: {str(e)}") from e

    def _update_metrics(self, success: bool, processing_time: float, error: Optional[str] = None) -> None:
        """
        Updates performance metrics with thread safety.

        Args:
            success (bool): Whether the request was successful
            processing_time (float): Processing time in seconds
            error (Optional[str]): Error message if applicable
        """
        self._performance_metrics['total_requests'] += 1
        if success:
            self._performance_metrics['successful_requests'] += 1
        else:
            self._performance_metrics['failed_requests'] += 1
            self._performance_metrics['last_error'] = error

        # Update average latency
        current_avg = self._performance_metrics['average_latency']
        total_requests = self._performance_metrics['total_requests']
        self._performance_metrics['average_latency'] = (
            (current_avg * (total_requests - 1) + processing_time) / total_requests
        )