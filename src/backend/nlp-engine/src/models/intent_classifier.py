"""
High-performance intent classifier using transformer models with GPU acceleration,
caching, and batch processing capabilities.

Dependencies:
torch==2.0.0 - Deep learning framework with GPU support
transformers==4.30.0 - Hugging Face transformers for intent classification
numpy==1.24.0 - Numerical operations for model inputs/outputs
cachetools==5.3.0 - Caching utilities for model predictions
"""

import logging
from typing import Dict, List, Optional
import torch
import torch.nn.functional as F
import numpy as np
from transformers import AutoModelForSequenceClassification
from cachetools import TTLCache

from ..utils.text_preprocessor import TextPreprocessor
from ..config.settings import NLPConfig

# Intent labels supported by the classifier
INTENT_LABELS = [
    'create_agent', 'modify_agent', 'delete_agent',
    'query_status', 'configure_integration', 'help'
]

# Configure logging
logger = logging.getLogger(__name__)

# Performance optimization constants
BATCH_SIZE = 32
MAX_RETRIES = 3
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

class IntentClassifier:
    """
    High-performance intent classifier using transformer models with caching,
    batch processing, and GPU acceleration capabilities.
    """

    def __init__(self, config: NLPConfig):
        """
        Initialize the intent classifier with optimized configuration and GPU support.

        Args:
            config (NLPConfig): Configuration instance for the classifier

        Raises:
            RuntimeError: If model initialization fails
        """
        self._config = config.get_model_config()
        self._device = DEVICE
        
        # Initialize cache with TTL from config
        self._cache = TTLCache(
            maxsize=1000,
            ttl=self._config.get('cache_ttl', 3600)
        )
        
        # Initialize model with retry mechanism
        for attempt in range(MAX_RETRIES):
            try:
                self._model = AutoModelForSequenceClassification.from_pretrained(
                    self._config['model_path'],
                    num_labels=len(INTENT_LABELS)
                )
                break
            except Exception as e:
                if attempt == MAX_RETRIES - 1:
                    logger.error(f"Failed to load model after {MAX_RETRIES} attempts: {str(e)}")
                    raise RuntimeError("Model initialization failed") from e
                logger.warning(f"Model loading attempt {attempt + 1} failed, retrying...")

        # Initialize text preprocessor
        self._preprocessor = TextPreprocessor(config)
        
        # Set confidence threshold
        self.confidence_threshold = self._config['confidence_threshold']
        
        # Move model to GPU if available
        self._model.to(self._device)
        self._model.eval()  # Set to evaluation mode
        
        logger.info(f"Intent classifier initialized successfully on {self._device}")

    def classify_intent(self, text: str) -> Dict:
        """
        Classify intent from text with caching and optimized inference.

        Args:
            text (str): Input text to classify

        Returns:
            Dict: Classification result with intent and confidence score

        Raises:
            ValueError: If input validation fails
            RuntimeError: If classification fails
        """
        # Check cache first
        cache_key = hash(text)
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            # Preprocess input text
            processed = self._preprocessor.transform(text)
            
            # Convert to torch tensors and move to device
            inputs = {
                'input_ids': torch.tensor(processed['input_ids']).to(self._device),
                'attention_mask': torch.tensor(processed['attention_mask']).to(self._device)
            }

            # Run inference with gradient disabled for performance
            with torch.no_grad():
                outputs = self._model(**inputs)
                
            # Get probabilities with softmax
            probs = F.softmax(outputs.logits, dim=-1)
            confidence, pred_idx = torch.max(probs, dim=-1)
            
            # Convert to Python types
            confidence = confidence.item()
            predicted_intent = INTENT_LABELS[pred_idx.item()]
            
            # Check confidence threshold
            if confidence < self.confidence_threshold:
                result = {
                    'intent': 'unknown',
                    'confidence': confidence,
                    'status': 'low_confidence'
                }
            else:
                result = {
                    'intent': predicted_intent,
                    'confidence': confidence,
                    'status': 'success'
                }

            # Cache the result
            self._cache[cache_key] = result
            return result

        except Exception as e:
            logger.error(f"Classification failed: {str(e)}")
            raise RuntimeError("Intent classification failed") from e

    def classify_batch(self, texts: List[str]) -> List[Dict]:
        """
        Perform memory-efficient batch classification with parallel processing.

        Args:
            texts (List[str]): Batch of texts to classify

        Returns:
            List[Dict]: Batch of classification results

        Raises:
            ValueError: If input validation fails
            RuntimeError: If batch processing fails
        """
        if not texts:
            return []

        try:
            results = []
            # Process in optimal batch sizes
            for i in range(0, len(texts), BATCH_SIZE):
                batch_texts = texts[i:i + BATCH_SIZE]
                
                # Process batch
                processed_batch = self._preprocessor.batch_transform(batch_texts)
                
                # Convert to torch tensors and move to device
                batch_inputs = {
                    'input_ids': torch.tensor(processed_batch['input_ids']).to(self._device),
                    'attention_mask': torch.tensor(processed_batch['attention_mask']).to(self._device)
                }

                # Batch inference with gradient disabled
                with torch.no_grad():
                    outputs = self._model(**batch_inputs)
                    probs = F.softmax(outputs.logits, dim=-1)
                    
                # Get predictions and confidences
                confidences, pred_indices = torch.max(probs, dim=-1)
                
                # Convert to Python types and format results
                batch_results = []
                for confidence, pred_idx, text in zip(confidences, pred_indices, batch_texts):
                    confidence = confidence.item()
                    predicted_intent = INTENT_LABELS[pred_idx.item()]
                    
                    result = {
                        'intent': predicted_intent if confidence >= self.confidence_threshold else 'unknown',
                        'confidence': confidence,
                        'status': 'success' if confidence >= self.confidence_threshold else 'low_confidence'
                    }
                    
                    # Update cache
                    self._cache[hash(text)] = result
                    batch_results.append(result)
                
                results.extend(batch_results)

            return results

        except Exception as e:
            logger.error(f"Batch classification failed: {str(e)}")
            raise RuntimeError("Batch classification failed") from e

    def predict_proba(self, text: str) -> Dict[str, float]:
        """
        Get probability distribution across all intents.

        Args:
            text (str): Input text

        Returns:
            Dict[str, float]: Mapping of intents to probabilities

        Raises:
            RuntimeError: If prediction fails
        """
        try:
            # Preprocess input
            processed = self._preprocessor.transform(text)
            
            # Convert to torch tensors and move to device
            inputs = {
                'input_ids': torch.tensor(processed['input_ids']).to(self._device),
                'attention_mask': torch.tensor(processed['attention_mask']).to(self._device)
            }

            # Run inference
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = F.softmax(outputs.logits, dim=-1)

            # Convert to dictionary mapping
            probabilities = {
                intent: prob.item()
                for intent, prob in zip(INTENT_LABELS, probs[0])
            }

            return probabilities

        except Exception as e:
            logger.error(f"Probability prediction failed: {str(e)}")
            raise RuntimeError("Probability prediction failed") from e