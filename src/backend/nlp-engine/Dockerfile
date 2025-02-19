# Stage 1: Builder stage
FROM python:3.11-slim AS builder

# Set build arguments and environment variables
ENV PYTHONUNBUFFERED=1 \
    POETRY_VERSION=1.7.0 \
    POETRY_HOME=/opt/poetry \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    PYTHONPATH=/app

# Install system dependencies and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry for dependency management
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry

# Set working directory
WORKDIR /app

# Copy dependency files with strict version control
COPY pyproject.toml poetry.lock ./
COPY requirements.txt ./

# Install dependencies with Poetry
RUN poetry install --no-dev --no-root

# Copy application source code
COPY src/ ./src/

# Build application with optimizations
RUN poetry build

# Stage 2: Production stage
FROM nvidia/cuda:11.8.0-base-ubuntu22.04 AS production

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    TZ=UTC \
    SERVICE_USER=nlpservice \
    SERVICE_UID=10001

# Install Python and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3.11 /usr/bin/python

# Create non-root user for security
RUN groupadd -r ${SERVICE_USER} && \
    useradd -r -g ${SERVICE_USER} -u ${SERVICE_UID} -s /sbin/nologin -c "NLP Service User" ${SERVICE_USER}

# Set working directory
WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src

# Set ownership and permissions
RUN chown -R ${SERVICE_USER}:${SERVICE_USER} /app && \
    chmod -R 550 /app/src && \
    chmod -R 550 /app/.venv

# Set up enhanced health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Configure resource limits and optimization flags
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    OMP_NUM_THREADS=4 \
    TORCH_CUDA_ARCH_LIST="7.0;7.5;8.0;8.6" \
    MALLOC_TRIM_THRESHOLD_=100000

# Expose service port
EXPOSE 8000

# Switch to non-root user
USER ${SERVICE_USER}

# Set up entry point with optimized settings
ENTRYPOINT ["/app/.venv/bin/poetry", "run"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--limit-max-requests", "10000"]