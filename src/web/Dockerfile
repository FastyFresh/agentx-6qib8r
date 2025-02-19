# syntax=docker/dockerfile:1.4
# Enable BuildKit features
ARG DOCKER_BUILDKIT=1
ARG BUILDKIT_INLINE_CACHE=1

# Build stage
FROM node:20-alpine AS builder

# Set build arguments and environment variables
ARG API_URL
ARG AUTH0_DOMAIN
ARG AUTH0_CLIENT_ID

ENV NODE_ENV=production \
    VITE_API_URL=${API_URL} \
    VITE_AUTH0_DOMAIN=${AUTH0_DOMAIN} \
    VITE_AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID} \
    NPM_CONFIG_LOGLEVEL=error \
    NPM_CONFIG_CACHE=/tmp/.npm \
    NODE_PATH=/app/node_modules

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    build-base \
    git \
    && npm config set ignore-scripts true \
    && npm config set unsafe-perm false

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production \
    && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build \
    && npm prune --production

# Production stage
FROM nginx:1.24-alpine

# Set environment variables
ENV TZ=UTC \
    NGINX_WORKER_PROCESSES=auto

# Install security updates and required packages
RUN apk update && apk upgrade \
    && apk add --no-cache \
    tzdata \
    curl \
    && rm -rf /var/cache/apk/*

# Create nginx user and set permissions
RUN addgroup -S nginx \
    && adduser -S -G nginx -h /var/cache/nginx -s /sbin/nologin nginx \
    && mkdir -p /var/cache/nginx /var/log/nginx \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx

# Copy nginx configuration
COPY --chown=nginx:nginx nginx/nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --chown=nginx:nginx nginx/compression.conf /etc/nginx/compression.conf

# Copy built assets from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Configure security headers
RUN echo "server_tokens off;" >> /etc/nginx/nginx.conf \
    && echo "add_header X-Content-Type-Options nosniff;" >> /etc/nginx/nginx.conf \
    && echo "add_header X-Frame-Options DENY;" >> /etc/nginx/nginx.conf \
    && echo "add_header X-XSS-Protection \"1; mode=block\";" >> /etc/nginx/nginx.conf \
    && echo "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';\";" >> /etc/nginx/nginx.conf

# Set up non-root user and permissions
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid

# Configure resource limits
RUN echo "nginx soft nofile 1024" >> /etc/security/limits.conf \
    && echo "nginx hard nofile 2048" >> /etc/security/limits.conf \
    && echo "nginx soft nproc 512" >> /etc/security/limits.conf \
    && echo "nginx hard nproc 1024" >> /etc/security/limits.conf

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]