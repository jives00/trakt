FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm install --ignore-scripts

RUN pnpm --filter web build

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
