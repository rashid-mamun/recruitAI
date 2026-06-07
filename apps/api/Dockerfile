# ─── API Dockerfile ──
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# ─── Development stage ────────────
FROM base AS development
COPY . .
WORKDIR /app/apps/api
EXPOSE 5000
CMD ["pnpm", "run", "dev"]

# ─── Build stage ─────
FROM base AS builder
COPY . .
RUN pnpm --filter @recruiting/api build

# ─── Production stage
FROM node:20-alpine AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/apps/api/dist apps/api/dist
RUN mkdir -p apps/api/node_modules/@ \
    && ln -s ../../dist/app.js apps/api/node_modules/@/app.js \
    && ln -s ../../dist/worker.js apps/api/node_modules/@/worker.js \
    && ln -s ../../dist/config apps/api/node_modules/@/config \
    && ln -s ../../dist/middleware apps/api/node_modules/@/middleware \
    && ln -s ../../dist/modules apps/api/node_modules/@/modules \
    && ln -s ../../dist/queues apps/api/node_modules/@/queues \
    && ln -s ../../dist/services apps/api/node_modules/@/services \
    && ln -s ../../dist/utils apps/api/node_modules/@/utils \
    && ln -s ../../dist/workers apps/api/node_modules/@/workers

WORKDIR /app/apps/api
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
