# Stage 1: Dependencies
FROM node:20-alpine AS deps

RUN apk add --no-cache openssl ca-certificates && \
    corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl ca-certificates && \
    corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json pnpm-lock.yaml tsconfig*.json nest-cli.json prisma.config.ts ./

COPY prisma ./prisma

COPY src ./src

# Set a dummy DATABASE_URL for prisma generate (it doesn't need a real connection)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy?schema=public
ENV DATABASE_URL=${DATABASE_URL}

RUN pnpm prisma generate

RUN pnpm build

# Verify build output exists
RUN ls -la dist/ || (echo "Build failed - dist directory not found" && exit 1)
RUN test -f dist/main.js || test -f dist/src/main.js || (echo "Build failed - main.js not found" && ls -la dist/ && exit 1)

# Stage 3: Production
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl ca-certificates && \
    corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

RUN pnpm add prisma@latest

COPY prisma.config.ts ./
COPY prisma ./prisma

# Set a dummy DATABASE_URL for prisma generate (it doesn't need a real connection)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy?schema=public
ENV DATABASE_URL=${DATABASE_URL}

RUN pnpm prisma generate

COPY --from=builder /app/dist ./dist

# Verify dist was copied correctly
RUN ls -la dist/ || (echo "dist directory not found after copy" && exit 1)

ENV NODE_ENV=production

EXPOSE 8000

# Try dist/main.js first, fallback to dist/src/main.js if needed
CMD ["sh", "-c", "if [ -f dist/main.js ]; then node dist/main.js; elif [ -f dist/src/main.js ]; then node dist/src/main.js; else echo 'Error: main.js not found in dist/' && ls -la dist/ && exit 1; fi"]
