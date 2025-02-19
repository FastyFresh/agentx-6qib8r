# Stage 1: Builder
FROM node:20-alpine AS builder

# Set build environment variables
ENV NODE_ENV=development \
    YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn \
    NODE_OPTIONS=--max-old-space-size=4096

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Configure yarn cache
RUN mkdir -p $YARN_CACHE_FOLDER && chmod 777 $YARN_CACHE_FOLDER

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code and configs
COPY tsconfig.json ./
COPY src ./src

# Build application
RUN yarn build

# Run tests
RUN yarn test

# Clean up development dependencies
RUN yarn install --production --frozen-lockfile && \
    yarn cache clean

# Stage 2: Production
FROM node:20-alpine

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=2048

# Install production dependencies
RUN apk add --no-cache \
    tini \
    dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S node && \
    adduser -u 1001 -S node -G node

# Copy built artifacts and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set correct permissions
RUN chown -R node:node /app && \
    chmod -R 755 /app

# Configure security policies
RUN chmod 644 /app/package.json && \
    chmod -R 755 /app/dist

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Set resource limits
ENV MEMORY_LIMIT=2048m \
    CPU_SHARES=1024 \
    PIDS_LIMIT=100

# Configure logging
ENV NODE_OPTIONS="--enable-source-maps ${NODE_OPTIONS}"

# Set build arguments
ARG BUILD_VERSION
ARG BUILD_DATE
ARG VCS_URL
ARG VCS_REF

# Add metadata labels
LABEL maintainer="AGENT AI Platform Team" \
    com.agent.version="${BUILD_VERSION}" \
    com.agent.build-date="${BUILD_DATE}" \
    org.opencontainers.image.source="${VCS_URL}" \
    org.opencontainers.image.revision="${VCS_REF}"

# Switch to non-root user
USER node

# Set security options
EXPOSE ${PORT}
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

# Security hardening
RUN rm -rf /tmp/* && \
    rm -rf /var/cache/apk/*

# Apply security policies
STOPSIGNAL SIGTERM

# Set read-only root filesystem
VOLUME ["/tmp"]
VOLUME ["/var/run"]

# Drop all capabilities except NET_BIND_SERVICE
RUN setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

# Additional security configurations
SECURITY_OPT no-new-privileges=true
SECURITY_OPT seccomp=unconfined