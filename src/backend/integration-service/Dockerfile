# Builder stage
FROM golang:1.20-alpine AS builder

# Set build environment variables
ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64

# Install build dependencies
RUN apk add --no-cache \
    ca-certificates \
    git \
    build-base \
    tzdata

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build optimized binary
RUN go build -ldflags="-s -w" -o integration-service ./cmd/server

# Run security scan on binary
RUN apk add --no-cache trivy \
    && trivy filesystem --severity HIGH,CRITICAL --no-progress / \
    && apk del trivy

# Final stage
FROM alpine:3.18

# Set runtime environment variables
ENV TZ=UTC \
    PORT=8080

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl

# Create non-root user and setup directories
RUN adduser -D -u 1001 appuser \
    && mkdir -p /app/logs \
    && chown -R appuser:appuser /app \
    && chmod -R 755 /app

# Copy binary from builder
COPY --from=builder /app/integration-service /app/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

WORKDIR /app

# Configure security options
RUN chmod 755 /app/integration-service \
    && chown appuser:appuser /app/integration-service

# Set resource limits
ENV GOMAXPROCS=1

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose service port
EXPOSE 8080

# Set security options
USER appuser
ENTRYPOINT ["/app/integration-service"]

# Add metadata labels
LABEL maintainer="AGENT AI Platform Team" \
    org.opencontainers.image.source="https://github.com/agent-ai-platform/integration-service" \
    org.opencontainers.image.description="Integration Service for AGENT AI Platform" \
    org.opencontainers.image.version="1.0.0"