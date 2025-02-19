# syntax=docker/dockerfile:1.4
# Enable BuildKit features
ARG DOCKER_BUILDKIT=1
ARG BUILDKIT_INLINE_CACHE=1

# Python Base Stage
# python:3.11-slim v3.11.5
FROM python:3.11-slim AS python-base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LANG=C.UTF-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    ca-certificates \
    curl \
    netbase \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && mkdir -p /app \
    && chown -R appuser:appuser /app

# Set secure umask and resource limits
RUN echo "umask 0027" >> /etc/profile \
    && echo "appuser soft nofile 1024" >> /etc/security/limits.conf \
    && echo "appuser hard nofile 2048" >> /etc/security/limits.conf \
    && echo "appuser soft nproc 512" >> /etc/security/limits.conf \
    && echo "appuser hard nproc 1024" >> /etc/security/limits.conf

WORKDIR /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Node.js Base Stage
# node:20-alpine v20.5.1
FROM node:20-alpine AS node-base

# Set environment variables
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=error \
    NPM_CONFIG_CACHE=/tmp/.npm \
    NODE_PATH=/app/node_modules

# Install system dependencies
RUN apk add --no-cache \
    build-base \
    python3 \
    git \
    ca-certificates \
    curl

# Create non-root user
RUN addgroup -S nodeuser && adduser -S -G nodeuser -h /app nodeuser \
    && mkdir -p /app \
    && chown -R nodeuser:nodeuser /app

# Set secure umask and npm configurations
RUN echo "umask 0027" >> /etc/profile \
    && npm config set ignore-scripts true \
    && npm config set unsafe-perm false

# Configure resource limits
RUN echo "nodeuser soft nofile 1024" >> /etc/security/limits.conf \
    && echo "nodeuser hard nofile 2048" >> /etc/security/limits.conf \
    && echo "nodeuser soft nproc 512" >> /etc/security/limits.conf \
    && echo "nodeuser hard nproc 1024" >> /etc/security/limits.conf

WORKDIR /app
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Go Base Stage
# golang:1.20-alpine v1.20.7
FROM golang:1.20-alpine AS go-base

# Set environment variables
ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GOPATH=/go

# Install system dependencies
RUN apk add --no-cache \
    build-base \
    git \
    ca-certificates \
    tzdata

# Create non-root user
RUN addgroup -S gouser && adduser -S -G gouser -h /app gouser \
    && mkdir -p /app \
    && chown -R gouser:gouser /app

# Set secure umask and resource limits
RUN echo "umask 0027" >> /etc/profile \
    && echo "gouser soft nofile 1024" >> /etc/security/limits.conf \
    && echo "gouser hard nofile 2048" >> /etc/security/limits.conf \
    && echo "gouser soft nproc 512" >> /etc/security/limits.conf \
    && echo "gouser hard nproc 1024" >> /etc/security/limits.conf

# Configure Go security settings
RUN go env -w GOMODCACHE=/go/pkg/mod \
    && go env -w GOPROXY=https://proxy.golang.org,direct \
    && go env -w GOSUMDB=sum.golang.org

WORKDIR /app
USER gouser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1