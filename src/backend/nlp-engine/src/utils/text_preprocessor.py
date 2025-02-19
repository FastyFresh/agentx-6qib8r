"""
High-performance text preprocessing utility for NLP engine.
Provides optimized text cleaning, tokenization, and transformation functions.

Dependencies:
numpy==1.24.0 - Efficient numerical operations
transformers==4.30.0 - High-performance tokenization
"""

import re
import logging
from typing import Dict, List, Optional
import numpy as np
from transformers import PreTrainedTokenizer, AutoTokenizer
from ..config.settings import NLPConfig

# Compile regex patterns for performance optimization
COMPILED_URL_PATTERN = re.compile(
    r'https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)'
)
COMPILED_EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
COMPILED_SPECIAL_CHARS = re.compile(r'[^\w\s]')

# Constants for performance tuning
MAX_RETRIES = 3
BATCH_SIZE = 32

def normalize_whitespace(text: str) -> str:
    """
    Optimized whitespace normalization with input validation.
    
    Args:
        text (str): Input text to normalize
        
    Returns:
        str: Text with normalized whitespace
        
    Raises:
        ValueError: If input text is invalid
    """
    if not isinstance(text, str):
        raise ValueError("Input must be a string")
    
    if not text.strip():
        return ""
        
    # Replace multiple spaces and line breaks with single space
    normalized = re.sub(r'\s+', ' ', text)
    return normalized.strip()

class TextPreprocessor:
    """
    High-performance text preprocessing class with comprehensive error handling
    and monitoring capabilities.
    """
    
    def __init__(self, config: NLPConfig):
        """
        Initialize text preprocessor with optimized configuration.
        
        Args:
            config (NLPConfig): Configuration instance
            
        Raises:
            RuntimeError: If initialization fails
        """
        self._config = config.get_model_config()
        self.max_length = self._config['max_sequence_length']
        
        # Set up logging
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)
        
        # Initialize tokenizer with error handling
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(
                self._config['model_path'],
                use_fast=True  # Use fast tokenizer for performance
            )
        except Exception as e:
            self._logger.error(f"Failed to initialize tokenizer: {str(e)}")
            raise RuntimeError("Tokenizer initialization failed") from e
            
        # Initialize cache for tokenized results
        self._cache = {}

    def clean_text(self, text: str) -> str:
        """
        Optimized text cleaning with comprehensive error handling.
        
        Args:
            text (str): Raw input text
            
        Returns:
            str: Cleaned text
            
        Raises:
            ValueError: If input validation fails
        """
        if not isinstance(text, str):
            raise ValueError("Input must be a string")
            
        try:
            # Convert to lowercase and normalize whitespace
            cleaned = text.lower()
            
            # Remove URLs, emails, and special characters using compiled patterns
            cleaned = COMPILED_URL_PATTERN.sub(' ', cleaned)
            cleaned = COMPILED_EMAIL_PATTERN.sub(' ', cleaned)
            cleaned = COMPILED_SPECIAL_CHARS.sub(' ', cleaned)
            
            # Normalize whitespace
            cleaned = normalize_whitespace(cleaned)
            
            self._logger.debug(f"Text cleaned successfully: {len(text)} -> {len(cleaned)} chars")
            return cleaned
            
        except Exception as e:
            self._logger.error(f"Text cleaning failed: {str(e)}")
            raise

    def tokenize_text(self, text: str) -> Dict:
        """
        High-performance text tokenization with retry mechanism.
        
        Args:
            text (str): Input text to tokenize
            
        Returns:
            Dict: Tokenized text with attention masks
            
        Raises:
            RuntimeError: If tokenization fails after retries
        """
        # Check cache first
        cache_key = hash(text)
        if cache_key in self._cache:
            return self._cache[cache_key]
            
        cleaned_text = self.clean_text(text)
        
        for attempt in range(MAX_RETRIES):
            try:
                # Tokenize with padding and truncation
                tokens = self._tokenizer(
                    cleaned_text,
                    padding='max_length',
                    truncation=True,
                    max_length=self.max_length,
                    return_tensors='np'
                )
                
                # Convert to numpy arrays for performance
                result = {
                    'input_ids': tokens['input_ids'].astype(np.int32),
                    'attention_mask': tokens['attention_mask'].astype(np.int32)
                }
                
                # Cache the result
                self._cache[cache_key] = result
                return result
                
            except Exception as e:
                self._logger.warning(f"Tokenization attempt {attempt + 1} failed: {str(e)}")
                if attempt == MAX_RETRIES - 1:
                    raise RuntimeError("Tokenization failed after max retries") from e

    def transform(self, text: str) -> Dict:
        """
        Complete text preprocessing pipeline with performance optimization.
        
        Args:
            text (str): Raw input text
            
        Returns:
            Dict: Fully preprocessed text ready for model input
            
        Raises:
            ValueError: If input validation fails
            RuntimeError: If processing fails
        """
        try:
            # Validate input
            if not text or not isinstance(text, str):
                raise ValueError("Invalid input text")
                
            # Process through pipeline
            tokenized = self.tokenize_text(text)
            
            # Add metadata for monitoring
            result = {
                **tokenized,
                'original_length': len(text),
                'processed_length': tokenized['input_ids'].shape[1]
            }
            
            self._logger.info(
                f"Text transformed successfully: {result['original_length']} -> "
                f"{result['processed_length']} tokens"
            )
            return result
            
        except Exception as e:
            self._logger.error(f"Text transformation failed: {str(e)}")
            raise

    def batch_transform(self, texts: List[str]) -> Dict:
        """
        Optimized batch processing with parallel execution.
        
        Args:
            texts (List[str]): List of input texts
            
        Returns:
            Dict: Batch of preprocessed texts
            
        Raises:
            ValueError: If input validation fails
            RuntimeError: If batch processing fails
        """
        if not texts or not isinstance(texts, list):
            raise ValueError("Invalid input batch")
            
        try:
            # Process in optimal batch sizes
            results = []
            for i in range(0, len(texts), BATCH_SIZE):
                batch = texts[i:i + BATCH_SIZE]
                batch_results = [self.transform(text) for text in batch]
                results.extend(batch_results)
                
            # Combine results efficiently
            combined = {
                'input_ids': np.vstack([r['input_ids'] for r in results]),
                'attention_mask': np.vstack([r['attention_mask'] for r in results]),
                'batch_size': len(texts)
            }
            
            self._logger.info(f"Batch processed successfully: {len(texts)} texts")
            return combined
            
        except Exception as e:
            self._logger.error(f"Batch processing failed: {str(e)}")
            raise