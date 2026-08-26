# ─────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Instalar dependencias del workspace (solo frontend)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json  ./backend/
# --ignore-scripts evita que pnpm 10 falle por scripts de postinstall sin aprobar
# (sharp 0.33+ trae binarios prebuilt via optional deps; @parcel/watcher solo
# se usa para file-watching en modo dev, irrelevante en el build de produccion)
RUN pnpm install --frozen-lockfile --filter frontend --ignore-scripts

# Copiar fuentes y compilar
COPY frontend/ ./frontend/

WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ─────────────────────────────────────────
# Stage 2: Runtime (standalone)
# ─────────────────────────────────────────
FROM node:22-alpine AS runner
# sin tzdata, alpine ignora TZ y el render del servidor usa UTC
RUN apk add --no-cache tzdata
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Crear usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copiar output standalone (contiene server.js + node_modules mínimos)
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/standalone ./
# Copiar assets estáticos generados
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
# Copiar public si existe
COPY --from=build --chown=nextjs:nodejs /app/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000

# Next.js standalone genera server.js en la raíz del standalone
CMD ["node", "frontend/server.js"]
