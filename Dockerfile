# ---- Build stage ----
FROM node:20-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Runtime stage ----
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Chromium for whatsapp-web.js (puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json /app/bun.lock ./

RUN bun install --production --frozen-lockfile

COPY --from=build /app/start.js ./
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/tsconfig.json ./

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CHROMIUM_PATH=/usr/bin/chromium \
    TZ=America/Argentina/Buenos_Aires

EXPOSE 8080

CMD sh -c "bunx drizzle-kit push && bun run src/db/seed.ts && exec node start.js"
