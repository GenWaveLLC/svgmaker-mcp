# syntax=docker/dockerfile:1

# ---- Build stage: compile TypeScript with full dev dependencies ----
FROM node:20-slim AS builder
WORKDIR /app

# Install all dependencies (incl. devDeps needed for tsc).
# --ignore-scripts skips the "prepare" build hook here; we run build explicitly.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Compile src/ -> build/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage: production deps only + compiled output ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Install only production dependencies. --ignore-scripts avoids the "prepare"
# build hook (tsc is not present here); sharp ships prebuilt binaries via
# optional dependencies, so it still works without running install scripts.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy the compiled server from the build stage.
COPY --from=builder /app/build ./build

EXPOSE 8080

# Cloud Run runs the HTTP entry point (not the stdio one used by the npm package).
CMD ["node", "build/http.js"]
