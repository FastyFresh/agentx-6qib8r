# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies including devDependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    # Create non-root user
    adduser -D -H -s /sbin/nologin node && \
    # Set directory permissions
    chown -R node:node /usr/src/app && \
    # Clean npm cache
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder --chown=node:node /usr/src/app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER node

# Configure security options
RUN mkdir -p /usr/src/app/tmp && \
    chown node:node /usr/src/app/tmp

# Expose port
EXPOSE 3000

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:3000/health || exit 1

# Set security options
LABEL maintainer="AGENT AI Platform Team" \
      version="1.0.0" \
      description="API Gateway service for AGENT AI Platform" \
      security.hardened="true"

# Configure read-only filesystem and other security measures
VOLUME ["/usr/src/app/node_modules", "/usr/src/app/dist"]
TMPFS ["/tmp", "/run"]

# Set resource limits
ULIMIT nofile=65536:65536

# Drop all capabilities and prevent privilege escalation
SECURITY_OPT ["no-new-privileges:true"]
CAP_DROP ["ALL"]

# Start the application
CMD ["node", "dist/index.js"]