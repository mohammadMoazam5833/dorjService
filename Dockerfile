# goodarzi.isigpu.local (docs/superpowers/specs/2026-10-03-goodarzi-phase1-design.md)
FROM node:20-alpine AS build
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry "${NPM_CONFIG_REGISTRY}"
COPY . .
RUN npm test && npm run build && npm run check-dist

FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /src/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
