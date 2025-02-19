"""
Main entry point for the NLP Engine service providing FastAPI-based REST endpoints
for natural language processing capabilities with enhanced error handling and monitoring.

Dependencies:
fastapi==0.100.0 - FastAPI web framework
uvicorn==0.22.0 - ASGI server implementation
pydantic==2.0.0 - Data validation
prometheus_client==0.17.0 - Metrics collection
opentelemetry-api==1.18.0 - Distributed tracing
"""

import logging
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from prometheus_client import Counter, Histogram, generate_latest
from opentelemetry import trace
from opentelemetry.trace import TracerProvider

from config.settings import NLPConfig
from services.language_processor import LanguageProcessor

# Initialize FastAPI application
app = FastAPI(
    title="NLP Engine Service",
    description="Natural Language Processing service for AGENT AI Platform",
    version="1.0.0"
)

# Initialize configuration and services
config = NLPConfig()
language_processor = LanguageProcessor(config)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize tracing
tracer_provider = TracerProvider()
trace.set_tracer_provider(tracer_provider)
tracer = trace.get_tracer(__name__)

# Initialize metrics
REQUEST_COUNT = Counter('nlp_requests_total', 'Total NLP requests processed')
LATENCY_HISTOGRAM = Histogram('nlp_request_latency_seconds', 'Request latency in seconds')
ERROR_COUNT = Counter('nlp_errors_total', 'Total NLP processing errors')

# Request/Response Models
class ProcessTextRequest(BaseModel):
    text: str
    options: Optional[Dict] = None
    request_id: Optional[str] = None

class ProcessBatchRequest(BaseModel):
    texts: List[str]
    options: Optional[Dict] = None
    request_id: Optional[str] = None

class ProcessResponse(BaseModel):
    result: Dict
    confidence_score: float
    processing_time: float
    model_version: str
    request_id: str

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict] = None
    request_id: str

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process", response_model=ProcessResponse)
async def process_text(request: ProcessTextRequest):
    """Process single text input with enhanced error handling and monitoring."""
    REQUEST_COUNT.inc()
    with LATENCY_HISTOGRAM.time(), tracer.start_as_current_span("process_text") as span:
        try:
            # Validate request
            if not request.text.strip():
                raise HTTPException(status_code=400, detail="Empty text input")

            # Process text with monitoring
            span.set_attribute("text_length", len(request.text))
            result = await language_processor.process_text(request.text)

            # Prepare response
            response = ProcessResponse(
                result=result,
                confidence_score=result.get('overall_confidence', 0.0),
                processing_time=result.get('processing_time', 0.0),
                model_version="1.0.0",
                request_id=request.request_id or "default"
            )

            # Validate performance requirements
            if response.processing_time > 0.2:  # 200ms requirement
                logger.warning(f"Performance threshold exceeded: {response.processing_time}s")

            return response

        except Exception as e:
            ERROR_COUNT.inc()
            logger.error(f"Text processing failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=ErrorResponse(
                    error_code="PROCESSING_ERROR",
                    message=str(e),
                    request_id=request.request_id or "default"
                ).dict()
            )

@app.post("/process/batch", response_model=List[ProcessResponse])
async def process_batch(request: ProcessBatchRequest):
    """Process multiple texts in batch with monitoring."""
    REQUEST_COUNT.inc()
    with LATENCY_HISTOGRAM.time(), tracer.start_as_current_span("process_batch") as span:
        try:
            # Validate batch size
            if len(request.texts) > config.BATCH_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Batch size exceeds limit of {config.BATCH_SIZE}"
                )

            # Process batch with monitoring
            span.set_attribute("batch_size", len(request.texts))
            results = await language_processor.process_batch(request.texts)

            # Prepare responses
            responses = [
                ProcessResponse(
                    result=result,
                    confidence_score=result.get('overall_confidence', 0.0),
                    processing_time=result.get('processing_time', 0.0),
                    model_version="1.0.0",
                    request_id=request.request_id or f"batch_{i}"
                )
                for i, result in enumerate(results)
            ]

            return responses

        except Exception as e:
            ERROR_COUNT.inc()
            logger.error(f"Batch processing failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=ErrorResponse(
                    error_code="BATCH_PROCESSING_ERROR",
                    message=str(e),
                    request_id=request.request_id or "default"
                ).dict()
            )

@app.get("/health")
async def health_check():
    """Enhanced health check endpoint with detailed system metrics."""
    try:
        # Check language processor status
        processor_status = await language_processor.process_text("test")
        
        return {
            "status": "healthy",
            "processor_status": "operational",
            "metrics": {
                "requests_total": REQUEST_COUNT._value.get(),
                "errors_total": ERROR_COUNT._value.get(),
                "average_latency": LATENCY_HISTOGRAM._sum.get() / max(LATENCY_HISTOGRAM._count.get(), 1)
            },
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "error": str(e)}
        )

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return generate_latest()

def main():
    """Application entry point with enhanced initialization."""
    try:
        # Initialize tracing
        trace.get_tracer_provider().add_span_processor(
            trace.BatchSpanProcessor(trace.ConsoleSpanExporter())
        )

        # Start server with optimized settings
        import uvicorn
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            workers=4,
            log_level="info",
            timeout_keep_alive=30,
            limit_concurrency=100,
            limit_max_requests=10000
        )
    except Exception as e:
        logger.error(f"Server initialization failed: {str(e)}")
        raise

if __name__ == "__main__":
    main()