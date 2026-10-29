FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm install --workspace=@syntrix/api --workspace=@syntrix/shared --include-workspace-root=false || npm install
RUN npm run build -w @syntrix/shared && cd apps/api && npx prisma generate && npm run build

FROM node:22-alpine
RUN apk add --no-cache wget openssl libc6-compat
WORKDIR /app/apps/api
COPY --from=build /app /app
ENV NODE_ENV=production
ENV API_PORT=3001
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node dist/main.js"]
