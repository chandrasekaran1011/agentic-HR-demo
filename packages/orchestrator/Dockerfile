FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/orchestrator/package*.json ./packages/orchestrator/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm --workspace=orchestrator run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/orchestrator/dist ./packages/orchestrator/dist
COPY --from=builder /app/packages/orchestrator/node_modules ./packages/orchestrator/node_modules
COPY --from=builder /app/packages/orchestrator/package.json ./packages/orchestrator/package.json
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/master-data ./master-data
COPY --from=builder /app/seed-data ./seed-data
EXPOSE 3001
CMD ["node", "packages/orchestrator/dist/server.js"]
