# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY apps/server/package.json /tmp/server-package.json
COPY packages/winterarc-core/package.json packages/winterarc-core/package.json
COPY packages/winterarc-protocol/package.json packages/winterarc-protocol/package.json
COPY packages/winterarc-profile/package.json packages/winterarc-profile/package.json
COPY packages/winterarc-gameplay/package.json packages/winterarc-gameplay/package.json
COPY packages/winterarc-world/package.json packages/winterarc-world/package.json
# Install only server dependencies. Frontend/editor are never sent in the build context.
RUN node -e "const fs=require('fs'),p=require('/tmp/server-package.json');fs.writeFileSync('package.json',JSON.stringify({name:'winterarc-runtime',private:true,type:'module',workspaces:['packages/*'],dependencies:p.dependencies,devDependencies:{tsx:p.devDependencies.tsx,esbuild:p.devDependencies.esbuild}}));"
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund
COPY packages/winterarc-core packages/winterarc-core
COPY packages/winterarc-protocol packages/winterarc-protocol
COPY packages/winterarc-profile packages/winterarc-profile
COPY packages/winterarc-gameplay packages/winterarc-gameplay
COPY packages/winterarc-world packages/winterarc-world
COPY apps/server apps/server
RUN cd apps/server && ../../node_modules/.bin/tsx build.ts
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=2567 ACCOUNT_DB_PATH=/data/accounts.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /build/package.json ./package.json
COPY --from=build --chown=node:node /build/node_modules ./node_modules
# Preserve npm workspace links; gameplay is bundled into dist.
COPY --from=build --chown=node:node /build/packages ./packages
COPY --from=build --chown=node:node /build/apps/server/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 2567
STOPSIGNAL SIGTERM
CMD ["node", "dist/index.js"]
