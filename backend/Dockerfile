FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter backend
COPY backend/ ./backend/
WORKDIR /app/backend
RUN pnpm run build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter backend --prod
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/src/certificados/assets ./backend/dist/certificados/assets
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
