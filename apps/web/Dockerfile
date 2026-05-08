FROM node:24-alpine

ARG NEXT_PUBLIC_API_URL

WORKDIR /app

RUN npm install -g pnpm

COPY tsconfig.json pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm install --ignore-scripts

RUN pnpm --filter @trakt/types build
RUN NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL pnpm --filter web build

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
