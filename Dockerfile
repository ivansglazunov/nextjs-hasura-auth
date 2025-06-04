# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Build-time arguments with placeholder values (not embedded in final image)
ARG NEXT_PUBLIC_HASURA_GRAPHQL_URL="https://placeholder-hasura-url.com/v1/graphql"
ARG NEXTAUTH_SECRET="placeholder-nextauth-secret-for-build-only"
ARG NEXTAUTH_URL="http://localhost:3000"

# Set environment variables for build process only
ENV NEXT_PUBLIC_HASURA_GRAPHQL_URL=$NEXT_PUBLIC_HASURA_GRAPHQL_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy other necessary files
COPY --chown=nextjs:nodejs next.config.* ./
COPY --chown=nextjs:nodejs lib ./lib

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

# Start the application
CMD ["npm", "start"] 