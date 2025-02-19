# syntax=docker/dockerfile:1.4
# Enable BuildKit features
ARG DOCKER_BUILDKIT=1
ARG BUILDKIT_INLINE_CACHE=1

# Production Python Stage
FROM python-base AS python-prod

# Set production environment variables
ENV PYTHON_ENV=production \
    PYTHONOPTIMIZE=2 \
    PYTHONDONTWRITEBYTECODE=1 \
    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus

# Install production dependencies and security tools
RUN pip install --no-cache-dir \
    prometheus-client==0.17.1 \
    python-json-logger==2.0.7 \
    ddtrace==1.18.1 \
    sentry-sdk==1.29.2 \
    pytz==2023.3 \
    psutil==5.9.5

# Configure security settings
RUN mkdir -p /tmp/prometheus && \
    chmod 755 /tmp/prometheus && \
    chown appuser:appuser /tmp/prometheus

# Set resource limits
LABEL com.docker.container.memory-reservation="2G" \
      com.docker.container.memory-limit="4G" \
      com.docker.container.cpu-shares="1024"

# Production Node.js Stage
FROM node-base AS node-prod

# Set production environment variables
ENV NODE_ENV=production \
    NPM_CONFIG_PRODUCTION=true \
    NODE_OPTIONS='--max-old-space-size=2048' \
    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus

# Install production dependencies and security tools
RUN npm install -g \
    prom-client@14.2.0 \
    winston@3.10.0 \
    dd-trace@4.13.1 \
    @sentry/node@7.64.0 \
    helmet@7.0.0 \
    compression@1.7.4

# Configure security settings
RUN mkdir -p /tmp/prometheus && \
    chmod 755 /tmp/prometheus && \
    chown nodeuser:nodeuser /tmp/prometheus

# Set resource limits
LABEL com.docker.container.memory-reservation="1G" \
      com.docker.container.memory-limit="2G" \
      com.docker.container.cpu-shares="1024"

# Production Go Stage
FROM go-base AS go-prod

# Set production environment variables
ENV GO_ENV=production \
    CGO_ENABLED=0 \
    GOMEMLIMIT=2048MiB \
    GOMAXPROCS=4 \
    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus

# Install production dependencies and security tools
RUN go install github.com/prometheus/client_golang/prometheus@v1.16.0 && \
    go install go.uber.org/zap@v1.25.0 && \
    go install github.com/DataDog/dd-trace-go/v2@v2.2.0 && \
    go install github.com/getsentry/sentry-go@v0.23.0

# Configure security settings
RUN mkdir -p /tmp/prometheus && \
    chmod 755 /tmp/prometheus && \
    chown gouser:gouser /tmp/prometheus

# Set resource limits
LABEL com.docker.container.memory-reservation="1G" \
      com.docker.container.memory-limit="2G" \
      com.docker.container.cpu-shares="1024"

# Common security configurations for all stages
LABEL org.opencontainers.image.vendor="AGENT AI Platform" \
      org.opencontainers.image.title="Production Container" \
      org.opencontainers.image.description="Production-ready container with security and monitoring" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.created="2023-08-20" \
      security.capabilities.drop="ALL" \
      security.read-only-root-filesystem="true" \
      security.no-new-privileges="true"

# Security scanning configuration
LABEL com.docker.scan.enable="true" \
      com.docker.scan.severity.threshold="HIGH"

# Configure health checks with strict parameters
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Set secure defaults
STOPSIGNAL SIGTERM
USER nonroot
WORKDIR /app
EXPOSE 8080

# Enable production-ready configurations
ENV TZ=UTC \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TMPDIR=/tmp

# Configure security limits
COPY --chown=nonroot:nonroot security/limits.conf /etc/security/limits.d/99-app.conf
COPY --chown=nonroot:nonroot security/security.conf /etc/sysctl.d/99-security.conf

# Mount volumes for logs and temporary files
VOLUME ["/tmp", "/var/log"]

# Default command with security flags
CMD ["--security-opt=no-new-privileges", "--cap-drop=ALL", "--read-only"]