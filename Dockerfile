# syntax=docker/dockerfile:1

# --- build ---
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# prune to production deps (keeps prisma CLI for migrate deploy)
RUN npm prune --omit=dev

# --- runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh \
  && chown -R node:node /app

EXPOSE 3000

USER node

ENTRYPOINT ["./docker/entrypoint.sh"]
