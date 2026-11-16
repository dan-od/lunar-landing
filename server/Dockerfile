# Build the shared core + server, then run a slim production image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY core/package.json ./core/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci
COPY core ./core
COPY server ./server
RUN npm run build --workspace core && npm run build --workspace server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY core/package.json ./core/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --omit=dev
COPY --from=build /app/core/dist ./core/dist
COPY --from=build /app/server/dist ./server/dist
# The migration runner reads its .sql files from beside the compiled runner.
COPY server/src/db/migrations ./server/dist/db/migrations
# The prepared terrain profiles, read by the terrain loader on each deploy.
COPY tools/terrain/*_terrain.json ./server/dist/terrain/
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
