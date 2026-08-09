FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.18.0

COPY tsconfig.json pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --ignore-scripts
RUN pnpm --filter @trakt/types build
RUN pnpm --filter api build
RUN pnpm --filter api deploy --legacy --prod /deploy

# pnpm's workspace-package injection has silently broken across releases, so place
# @trakt/types in the runtime tree ourselves rather than trusting deploy to do it.
RUN rm -rf /deploy/node_modules/@trakt/types && mkdir -p /deploy/node_modules/@trakt/types
RUN cp -r /app/packages/types/dist /deploy/node_modules/@trakt/types/dist
RUN cp /app/packages/types/package.json /deploy/node_modules/@trakt/types/
RUN node -e "require.resolve('@trakt/types',{paths:['/deploy/node_modules']})"

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3002
CMD ["node", "dist/server.js"]
