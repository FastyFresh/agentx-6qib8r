# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including dev dependencies for build
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Clean npm cache
RUN npm cache clean --force

# Stage 2: Production
FROM node:20-alpine

# Create non-root user
RUN addgroup -S authservice && \
    adduser -S -G authservice authservice

# Set working directory
WORKDIR /usr/src/app

# Copy built artifacts and dependencies from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Set production environment
ENV NODE_ENV=production
ENV PORT=3002
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Set resource limits
LABEL com.docker.resource.cpu="1"
LABEL com.docker.resource.memory="2Gi"
LABEL com.docker.resource.pids="50"

# Add metadata labels
LABEL maintainer="AGENT AI Platform Team" \
      version="1.0.0" \
      description="Authentication Service Container"

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Security headers and configurations
ENV NODE_TLS_REJECT_UNAUTHORIZED=1
ENV NPM_CONFIG_AUDIT=true

# Expose service port
EXPOSE 3002

# Switch to non-root user
USER authservice

# Start the service
CMD ["node", "dist/index.js"]