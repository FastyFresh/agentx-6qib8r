# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine

# Install production dependencies
RUN apk add --no-cache tini tzdata

# Create non-root user/group
RUN addgroup -g 1001 -S node && \
    adduser -u 1001 -S node -G node

# Set working directory
WORKDIR /usr/src/app

# Set timezone
ENV TZ=UTC

# Set production environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3003

# Copy package files
COPY package*.json ./

# Copy built files and production dependencies from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Create necessary directories with proper permissions
RUN mkdir -p /var/log/monitoring-service /etc/prometheus && \
    chown -R node:node /var/log/monitoring-service /etc/prometheus /usr/src/app

# Switch to non-root user
USER node

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Resource limits
ENV NODE_OPTIONS="--max-old-space-size=512"

# Expose service port
EXPOSE ${PORT}

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the service with proper signal handling
CMD ["node", "--enable-source-maps", "dist/index.js"]

# Labels for container metadata
LABEL org.opencontainers.image.source="https://github.com/agent-platform/monitoring-service" \
      org.opencontainers.image.description="AGENT AI Platform Monitoring Service" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="AGENT AI Platform" \
      org.opencontainers.image.title="monitoring-service" \
      org.opencontainers.image.created="2023-08-01"

# Security scanning during build
RUN npm audit && \
    npm cache clean --force