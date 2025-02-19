# syntax=docker/dockerfile:1.4
# Enable BuildKit features
ARG DOCKER_BUILDKIT=1
ARG BUILDKIT_INLINE_CACHE=1

# Python Development Stage
FROM python-base AS python-dev

# Set development environment variables
ENV PYTHON_ENV=development \
    FLASK_ENV=development \
    FLASK_DEBUG=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBUGPY_LISTEN_PORT=5678

# Switch to root for development package installation
USER root

# Install development dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    vim \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Python development packages
RUN pip install --no-cache-dir \
    pytest==7.4.0 \
    pytest-cov==4.1.0 \
    black==23.7.0 \
    flake8==6.1.0 \
    mypy==1.4.1 \
    debugpy==1.6.7 \
    watchdog==3.0.0 \
    ipython==8.14.0

# Switch back to appuser
USER appuser

# Configure development volume mounts
VOLUME ["/app/src", "/app/.pytest_cache", "/app/.mypy_cache"]

# Expose development ports
EXPOSE 5678 8000

# Development entrypoint for hot reloading
CMD ["python", "-m", "debugpy", "--listen", "0.0.0.0:5678", "--wait-for-client", "/app/src/main.py"]

# Node.js Development Stage
FROM node-base AS node-dev

# Set development environment variables
ENV NODE_ENV=development \
    DEBUG=* \
    NPM_CONFIG_LOGLEVEL=info

# Switch to root for development package installation
USER root

# Install development dependencies
RUN apk add --no-cache \
    vim \
    git

# Install Node.js development packages
RUN npm install -g \
    nodemon@3.0.1 \
    typescript@5.1.6 \
    ts-node@10.9.1 \
    jest@29.6.2 \
    eslint@8.46.0 \
    prettier@3.0.1 \
    npm-check-updates@16.10.15

# Switch back to nodeuser
USER nodeuser

# Configure development volume mounts
VOLUME ["/app/src", "/app/node_modules", "/app/.npm"]

# Expose development ports
EXPOSE 3000 9229

# Development entrypoint for hot reloading
CMD ["nodemon", "--inspect=0.0.0.0:9229", "/app/src/index.js"]

# Go Development Stage
FROM go-base AS go-dev

# Set development environment variables
ENV GO_ENV=development \
    CGO_ENABLED=1 \
    GO111MODULE=on \
    DELVE_PORT=2345

# Switch to root for development package installation
USER root

# Install development dependencies
RUN apk add --no-cache \
    vim \
    git \
    gcc \
    musl-dev

# Install Go development tools
RUN go install github.com/go-delve/delve/cmd/dlv@latest && \
    go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.53.3 && \
    go install github.com/cosmtrek/air@latest && \
    go install github.com/golang/mock/mockgen@v1.6.0

# Switch back to gouser
USER gouser

# Configure development volume mounts
VOLUME ["/app/src", "/go/pkg/mod"]

# Expose development ports
EXPOSE 8080 2345

# Development entrypoint for hot reloading
CMD ["air", "-c", ".air.toml"]

# Health check overrides for development
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1