FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY tsconfig.json pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --ignore-scripts

RUN pnpm --filter @trakt/types build
RUN pnpm --filter api build

EXPOSE 3002

CMD ["node", "apps/api/dist/server.js"]
