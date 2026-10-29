FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm install --workspace=@syntrix/api --workspace=@syntrix/shared --include-workspace-root=false || npm install
RUN npm run build -w @syntrix/shared && cd apps/api && npx prisma generate && npm run build
FROM node:22-alpine
WORKDIR /app/apps/api
COPY --from=build /app /app
RUN apk add --no-cache wget
ENV NODE_ENV=production
CMD ["node","dist/main.js"]
