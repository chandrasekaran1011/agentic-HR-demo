# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/portal/package*.json ./packages/portal/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm --workspace=portal run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/packages/portal/.next/standalone ./
COPY --from=builder /app/packages/portal/.next/static ./packages/portal/.next/static
COPY --from=builder /app/packages/portal/public ./packages/portal/public
COPY --from=builder /app/master-data ./master-data
COPY --from=builder /app/seed-data ./seed-data
EXPOSE 3000
CMD ["node", "packages/portal/server.js"]
