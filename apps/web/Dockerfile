FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm install --workspace=@syntrix/web --include-workspace-root=false || npm install
RUN npm run build -w @syntrix/web
FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# In compose, api service name must be reachable; for standalone web image nginx proxies /api/ to api:3001 — override conf as needed.
EXPOSE 80
