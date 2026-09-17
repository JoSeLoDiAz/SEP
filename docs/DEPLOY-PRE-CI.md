# Despliegue automatizado a PRE (rama `PRE`) — ProjectHub SEP

## Qué hace

1. Rama **`PRE`**.
2. Pipeline:
   - **`build:pre`** — Next.js standalone + NestJS dist offline; publica tarballs por LAN a `/data/SEP/.ci-in/` (GitLab no admite artefactos de cientos de MB)
   - **`deploy:pre`** (manual) — escribe `/data/SEP/.env` desde CI secrets, publica FE/BE y recrea `sep-frontend` + `sep-backend`

**Secretos PRE ≠ PRD.** Fuente canónica en CI/CD Variables (environment `pre`).

Oracle: cadena propia de PRE (`ORACLE_*`). No usa LinuxFarm_DBs (PostgreSQL).

## Flujo

```text
PRE push
  → build:pre
  → Play deploy:pre  (render .env + artefactos + recreate)
```

## Secretos CI/CD (scope `pre`)

```bash
set -a; source /ruta/.env.gitlab-sync; set +a
scp -i ~/Git/ssh/sena/pre-ci/sep-pre.key \
  opc@172.24.129.65:/data/SEP/.env /tmp/sep-pre.env.from-vm
SEP_PRE_ENV_FILE=/tmp/sep-pre.env.from-vm GITLAB_PROJECT_ID=350 \
  bash scripts/ci-sync-gitlab-pre-variables.sh
```

Variables: `ORACLE_*`, `JWT_SECRET`, `SMTP_*`, `APP_URL`, `TURNSTILE_*`, `NEXT_PUBLIC_*`, más `DEPLOY_SSH_PRIVATE_KEY` (File).

## URLs / paths

| Recurso | Valor |
|---------|--------|
| VM PRE | `172.24.129.65` (`vmpmci-734605`) / `/data/SEP` |
| Contenedores | `sep-frontend` **8096**, `sep-backend` **8097** (host network) |
| URL | https://pre-sep.sena.edu.co |
| Project ID | `350` |
| SSH gate | llave `sep-pre.key` → solo `/data/SEP` + `sep-frontend`/`sep-backend` |

## Offline (build)

Cachés en el runner (`SEP_OFFLINE_ROOT=/home/opc/sep-ci/offline`) o sembradas por LAN desde PRE:

| Recurso PRE | Uso |
|-------------|-----|
| `/data/SEP/imagenes/node-22-bookworm-slim.tar` | imagen Node (build y runtime) |
| `/data/SEP/offline/pnpm-store/` | `pnpm install --offline` |
| `/data/SEP/offline/node_modules.tgz` | seed si el store no basta |
| `/data/SEP/offline/pnpm` | binario pnpm (sin corepack/red) |

Sin salida a Internet en el job de build. Siembra inicial:

```bash
bash scripts/prepare-offline-caches.sh
```

## Runtime en PRE

- Frontend: `/data/SEP/frontend` (standalone Next) → `node frontend/server.js`
- Backend: `/data/SEP/app` (workspace + `backend/dist`) → `node dist/main.js`
- Env: `/data/SEP/.env`
- Contenedores: `node:22-bookworm-slim` con `--network host`

Nginx: `pre-sep.sena.edu.co` → `/` a `127.0.0.1:8096` y `/api/` a `127.0.0.1:8097/`. El certificado wildcard `*.sena.edu.co` ya cubre el host.
