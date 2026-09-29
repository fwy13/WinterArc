# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS native-base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Native runtime dependencies, installed against the same Node/glibc as runtime.
FROM native-base AS runtime-deps
WORKDIR /deps
COPY apps/server/package.json /tmp/server-package.json
RUN node -e "const fs=require('fs');const p=require('/tmp/server-package.json');const dependencies=Object.fromEntries(Object.entries(p.dependencies).filter(([n])=>!n.startsWith('winterarc-')));fs.writeFileSync('package.json',JSON.stringify({name:'winterarc-server-runtime',private:true,type:'module',dependencies}));"
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

FROM native-base AS build
WORKDIR /build
COPY apps/server/package.json /tmp/server-package.json
COPY packages/winterarc-core ./packages/winterarc-core
COPY packages/winterarc-protocol ./packages/winterarc-protocol
COPY packages/winterarc-profile ./packages/winterarc-profile
COPY packages/winterarc-gameplay ./packages/winterarc-gameplay
COPY packages/winterarc-world ./packages/winterarc-world
# Isolated server workspace: no React, editor, noa or Babylon installation.
RUN node -e "const fs=require('fs');const p=require('/tmp/server-package.json');fs.writeFileSync('package.json',JSON.stringify({name:'winterarc-server-build',private:true,type:'module',workspaces:['packages/*'],dependencies:p.dependencies,devDependencies:{tsx:p.devDependencies.tsx,esbuild:p.devDependencies.esbuild}}));"
RUN npm install --no-audit --no-fund
COPY apps/server ./apps/server
WORKDIR /build/apps/server
RUN /build/node_modules/.bin/tsx build.ts

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=2567 ACCOUNT_DB_PATH=/data/accounts.sqlite
WORKDIR /app
COPY --from=runtime-deps --chown=node:node /deps/package.json ./package.json
COPY --from=runtime-deps --chown=node:node /deps/node_modules ./node_modules
COPY --from=build --chown=node:node /build/apps/server/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 2567
STOPSIGNAL SIGTERM
CMD ["node", "dist/index.js"]
