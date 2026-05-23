FROM oven/bun:1.2.15-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

FROM deps AS test
COPY . .
RUN bun test

FROM deps AS runtime
ENV NODE_ENV=production
COPY . .
EXPOSE 8787
CMD ["bun", "src/index.ts"]
