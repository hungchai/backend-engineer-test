# Multi-stage build for optimized production image
FROM oven/bun:1-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S bun -u 1001

# Set working directory
WORKDIR /usr/src/app

# Copy built application from builder stage
COPY --from=builder --chown=bun:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=bun:nodejs /usr/src/app/src ./src
COPY --from=builder --chown=bun:nodejs /usr/src/app/package.json ./
COPY --from=builder --chown=bun:nodejs /usr/src/app/bun.lockb ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Switch to non-root user
USER bun

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run health-check || exit 1

# Start the application
CMD ["bun", "start"]
