# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Install Python and build tools for native dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    libc6-compat \
    vips-dev

# Copy package files and install all dependencies (including dev)
COPY package*.json ./

# Install dependencies with better error handling
RUN npm ci --legacy-peer-deps --prefer-offline --no-audit

# Copy source code and build
COPY . .

# Build-time environment variables with placeholder values (not embedded in final image)
ENV NEXT_PUBLIC_HASURA_GRAPHQL_URL="https://placeholder-hasura-url.com/v1/graphql"
ENV NEXTAUTH_SECRET="placeholder-nextauth-secret-for-build-only"
ENV NEXTAUTH_URL="http://localhost:3000"

RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install runtime dependencies including Python for native modules
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    libc6-compat \
    vips-dev \
    curl \
    dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies with better error handling
RUN npm ci --only=production --legacy-peer-deps --ignore-scripts --prefer-offline --no-audit || \
    (echo "First attempt failed, trying with --force" && npm ci --only=production --legacy-peer-deps --force --prefer-offline --no-audit)

# Rebuild native modules
RUN npm rebuild --quiet || echo "Some native modules failed to rebuild, continuing..."

# Clean npm cache
RUN npm cache clean --force --loglevel=error || echo "Cache clean failed, continuing..."

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy other necessary files
COPY --chown=nextjs:nodejs next.config.* ./
COPY --chown=nextjs:nodejs lib ./lib

# Clean up build dependencies to reduce image size (keep curl for healthcheck)
RUN apk del python3 py3-pip make g++ vips-dev

USER nextjs

# Always expose port 3000 internally
EXPOSE 3000

# Set default environment variables (will be overridden by runtime env vars)
ENV PORT=3000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"] 