# Build the SPA, then serve it with nginx (the only public-facing container).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY core/package.json ./core/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci
COPY core ./core
COPY client ./client
RUN npm run build --workspace core && npm run build --workspace client

FROM nginx:1.27-alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
