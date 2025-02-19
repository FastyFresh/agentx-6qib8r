"""
Advanced entity extraction model using transformer-based deep learning with optimized performance.

Dependencies:
numpy==1.24.0 - Numerical operations for model processing
tensorflow==2.13.0 - Deep learning framework with GPU optimization
transformers==4.30.0 - Pre-trained transformer models
"""

import logging
from typing import Dict, List, Optional
import numpy as np
import tensorflow as tf
from transformers import TFAutoModelForTokenClassification

from ..utils.text_preprocessor import TextPreprocessor
from ..config.settings import NLPConfig

# Entity type mapping for consistent classification
ENTITY_TYPES = {
    'AGENT_NAME': 0,
    'INTEGRATION_TYPE': 1,
    'PARAMETER': 2,
    'SCHEDULE': 3,
    'ACTION': 4,
    'CONDITION': 5
}

# Cache for model instances to optimize memory usage
MODEL_CACHE = {}

# Performance optimization constants
MAX_BATCH_SIZE = 32
MEMORY_LIMIT = 0.9  # 90% GPU memory limit

@tf.function(experimental_compile=True)
def load_model(model_path: str, force_reload: bool = False) -> tf.keras.Model:
    """
    Loads and validates the pre-trained entity extraction model with optimization.
    
    Args:
        model_path (str): Path to pre-trained model
        force_reload (bool): Force model reload bypassing cache
        
    Returns:
        tf.keras.Model: Loaded and validated model
        
    Raises:
        RuntimeError: If model loading or validation fails
    """
    if model_path in MODEL_CACHE and not force_reload:
        return MODEL_CACHE[model_path]
        
    try:
        # Configure GPU memory growth
        gpus = tf.config.experimental.list_physical_devices('GPU')
        if gpus:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
                tf.config.experimental.set_virtual_device_configuration(
                    gpu,
                    [tf.config.experimental.VirtualDeviceConfiguration(
                        memory_limit=MEMORY_LIMIT
                    )]
                )
        
        # Load model with optimization flags
        model = TFAutoModelForTokenClassification.from_pretrained(
            model_path,
            from_pt=False,
            output_hidden_states=False
        )
        
        # Optimize model for inference
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
            loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
            metrics=['accuracy']
        )
        
        MODEL_CACHE[model_path] = model
        return model
        
    except Exception as e:
        logging.error(f"Failed to load model: {str(e)}")
        raise RuntimeError("Model loading failed") from e

class EntityExtractor:
    """
    Advanced entity extraction using deep learning with performance optimization
    and resource management.
    """
    
    def __init__(self, config: NLPConfig):
        """
        Initializes the entity extractor with optimized configuration.
        
        Args:
            config (NLPConfig): Configuration instance
            
        Raises:
            RuntimeError: If initialization fails
        """
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)
        
        try:
            # Initialize configuration
            self._config = config.get_model_config()
            self._confidence_threshold = config.CONFIDENCE_THRESHOLD
            self._batch_size = min(config.BATCH_SIZE, MAX_BATCH_SIZE)
            
            # Initialize preprocessor
            self._preprocessor = TextPreprocessor(config)
            
            # Load model with optimization
            self._model = load_model(self._config['model_path'])
            
            # Initialize performance metrics
            self._performance_metrics = {
                'processed_texts': 0,
                'successful_extractions': 0,
                'average_latency': 0.0
            }
            
        except Exception as e:
            self._logger.error(f"Initialization failed: {str(e)}")
            raise RuntimeError("Entity extractor initialization failed") from e

    def extract_entities(self, text: str) -> List[Dict]:
        """
        Extracts entities from input text with performance optimization.
        
        Args:
            text (str): Input text for entity extraction
            
        Returns:
            List[Dict]: Extracted entities with metadata
            
        Raises:
            ValueError: If input validation fails
            RuntimeError: If extraction fails
        """
        if not text or not isinstance(text, str):
            raise ValueError("Invalid input text")
            
        try:
            # Preprocess text
            processed = self._preprocessor.transform(text)
            
            # Generate predictions with performance optimization
            predictions = self._model(
                processed['input_ids'],
                attention_mask=processed['attention_mask'],
                training=False
            )
            
            # Process logits and apply confidence threshold
            logits = predictions.logits.numpy()
            probabilities = tf.nn.softmax(logits, axis=-1).numpy()
            
            # Extract entities above confidence threshold
            entities = []
            for idx, (probs, mask) in enumerate(zip(probabilities[0], processed['attention_mask'][0])):
                if mask == 0:  # Skip padding tokens
                    continue
                    
                max_prob = np.max(probs)
                if max_prob >= self._confidence_threshold:
                    entity_type = np.argmax(probs)
                    entity = {
                        'type': list(ENTITY_TYPES.keys())[entity_type],
                        'confidence': float(max_prob),
                        'position': idx,
                        'text': text[idx:idx + 1]  # Original text segment
                    }
                    entities.append(entity)
            
            # Update metrics
            self._performance_metrics['processed_texts'] += 1
            self._performance_metrics['successful_extractions'] += len(entities)
            
            return entities
            
        except Exception as e:
            self._logger.error(f"Entity extraction failed: {str(e)}")
            raise RuntimeError("Entity extraction failed") from e

    def extract_batch(self, texts: List[str]) -> List[List[Dict]]:
        """
        Optimized batch processing of multiple texts.
        
        Args:
            texts (List[str]): Batch of input texts
            
        Returns:
            List[List[Dict]]: Batch of extracted entities
            
        Raises:
            ValueError: If input validation fails
            RuntimeError: If batch processing fails
        """
        if not texts or not isinstance(texts, list):
            raise ValueError("Invalid input batch")
            
        try:
            # Process in optimal batch sizes
            results = []
            for i in range(0, len(texts), self._batch_size):
                batch = texts[i:i + self._batch_size]
                
                # Batch preprocessing
                processed_batch = self._preprocessor.batch_transform(batch)
                
                # Generate predictions for batch
                predictions = self._model(
                    processed_batch['input_ids'],
                    attention_mask=processed_batch['attention_mask'],
                    training=False
                )
                
                # Process batch results
                batch_probabilities = tf.nn.softmax(predictions.logits, axis=-1).numpy()
                
                # Extract entities for each text in batch
                batch_entities = []
                for idx, text in enumerate(batch):
                    text_entities = []
                    for token_idx, probs in enumerate(batch_probabilities[idx]):
                        if processed_batch['attention_mask'][idx][token_idx] == 0:
                            continue
                            
                        max_prob = np.max(probs)
                        if max_prob >= self._confidence_threshold:
                            entity_type = np.argmax(probs)
                            entity = {
                                'type': list(ENTITY_TYPES.keys())[entity_type],
                                'confidence': float(max_prob),
                                'position': token_idx,
                                'text': text[token_idx:token_idx + 1]
                            }
                            text_entities.append(entity)
                    batch_entities.append(text_entities)
                
                results.extend(batch_entities)
            
            return results
            
        except Exception as e:
            self._logger.error(f"Batch extraction failed: {str(e)}")
            raise RuntimeError("Batch extraction failed") from e

    def cleanup_resources(self) -> bool:
        """
        Manages system resources and cache cleanup.
        
        Returns:
            bool: Success status of cleanup operation
            
        Raises:
            RuntimeError: If cleanup fails
        """
        try:
            # Clear model cache
            MODEL_CACHE.clear()
            
            # Clear GPU memory
            tf.keras.backend.clear_session()
            
            # Reset performance metrics
            self._performance_metrics = {
                'processed_texts': 0,
                'successful_extractions': 0,
                'average_latency': 0.0
            }
            
            self._logger.info("Resource cleanup completed successfully")
            return True
            
        except Exception as e:
            self._logger.error(f"Resource cleanup failed: {str(e)}")
            raise RuntimeError("Resource cleanup failed") from e