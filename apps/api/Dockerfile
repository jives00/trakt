FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY tsconfig.json pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --ignore-scripts
RUN pnpm --filter @trakt/types build
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod /deploy

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3002
CMD ["node", "dist/server.js"]
