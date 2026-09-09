#!/usr/bin/env bash
# Publica FE+BE CI en PRE, escribe /data/SEP/.env y recrea sep-frontend / sep-backend.
# Runtime: imagen node:22-bookworm-slim ya cargada offline + artefactos montados.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${CI_PROJECT_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ARTIFACT_DIR="${ARTIFACT_DIR:-${REPO_ROOT}/.ci-artifacts}"

# shellcheck source=/dev/null
source "${SCRIPT_DIR}/ci-lib-ssh.sh"
resolve_deploy_ssh_key >/dev/null || { echo "ERROR: falta DEPLOY_SSH_PRIVATE_KEY (File, env=pre)" >&2; exit 1; }

SSH_HOST="${DEPLOY_SSH_HOST:-172.24.129.65}"
SSH_USER="${DEPLOY_SSH_USER:-opc}"
SSH_KEY="${DEPLOY_SSH_KEY_FILE}"
REMOTE_APP="${DEPLOY_REMOTE_APP_DIR:-/data/SEP}"
FE_CONTAINER="${DEPLOY_FE_CONTAINER:-sep-frontend}"
BE_CONTAINER="${DEPLOY_BE_CONTAINER:-sep-backend}"
FE_PORT="${FRONTEND_PORT:-8096}"
BE_PORT="${BACKEND_PORT:-8097}"
RUNTIME_IMAGE="${SEP_RUNTIME_IMAGE:-docker.io/library/node:22-bookworm-slim}"

[[ -f "${SSH_KEY}" ]] || { echo "ERROR: falta llave PRE (${SSH_KEY:-none})" >&2; exit 1; }

if [[ ! -f "${ARTIFACT_DIR}/frontend-standalone.tgz" && -f /home/opc/sep-ci/artifacts/frontend-standalone.tgz ]]; then
  mkdir -p "${ARTIFACT_DIR}"
  cp -f /home/opc/sep-ci/artifacts/frontend-standalone.tgz "${ARTIFACT_DIR}/"
  cp -f /home/opc/sep-ci/artifacts/backend-app.tgz "${ARTIFACT_DIR}/" 2>/dev/null || true
  cp -f /home/opc/sep-ci/artifacts/build-meta.txt "${ARTIFACT_DIR}/" 2>/dev/null || true
fi

ENV_FILE="${ARTIFACT_DIR}/pre.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  bash "${SCRIPT_DIR}/ci-render-env.sh" "${ENV_FILE}"
fi

p="$(grep -E '^FRONTEND_PORT=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
[[ -n "${p}" ]] && FE_PORT="${p}"
p="$(grep -E '^BACKEND_PORT=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
[[ -n "${p}" ]] && BE_PORT="${p}"

chmod 600 "${SSH_KEY}" "${ENV_FILE}" 2>/dev/null || true
SSH=(ssh -i "${SSH_KEY}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 -o IdentitiesOnly=yes)
SCP=(scp -i "${SSH_KEY}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 -o IdentitiesOnly=yes)
TARGET="${SSH_USER}@${SSH_HOST}"

ENV_BEFORE="$("${SSH[@]}" "${TARGET}" "sha256sum '${REMOTE_APP}/.env' 2>/dev/null | awk '{print \$1}' || true")"
echo "=== CI deploy PRE artifacts+env -> ${TARGET}:${REMOTE_APP} ==="
echo "commit=${CI_COMMIT_SHORT_SHA:-local} env_before=${ENV_BEFORE:-none}"
cat "${ARTIFACT_DIR}/build-meta.txt" 2>/dev/null || true
echo "env keys:"
grep -E '^[A-Z]' "${ENV_FILE}" | cut -d= -f1

"${SSH[@]}" "${TARGET}" "mkdir -p '${REMOTE_APP}/.ci-in' '${REMOTE_APP}/frontend' '${REMOTE_APP}/app' '${REMOTE_APP}/imagenes' '${REMOTE_APP}/offline'"
SCP_FILES=("${ENV_FILE}")
[[ -f "${ARTIFACT_DIR}/build-meta.txt" ]] && SCP_FILES+=("${ARTIFACT_DIR}/build-meta.txt")
if [[ -f "${ARTIFACT_DIR}/frontend-standalone.tgz" ]]; then
  SCP_FILES+=("${ARTIFACT_DIR}/frontend-standalone.tgz")
fi
if [[ -f "${ARTIFACT_DIR}/backend-app.tgz" ]]; then
  SCP_FILES+=("${ARTIFACT_DIR}/backend-app.tgz")
fi
if [[ ! -f "${ARTIFACT_DIR}/frontend-standalone.tgz" || ! -f "${ARTIFACT_DIR}/backend-app.tgz" ]]; then
  echo "Usando artefactos ya publicados en PRE/.ci-in (sin re-scp completo)"
  "${SSH[@]}" "${TARGET}" "test -f '${REMOTE_APP}/.ci-in/frontend-standalone.tgz' && test -f '${REMOTE_APP}/.ci-in/backend-app.tgz'"
fi
"${SCP[@]}" "${SCP_FILES[@]}" "${TARGET}:${REMOTE_APP}/.ci-in/"

REMOTE_CMD=$(cat <<EOF
set -euo pipefail
APP='${REMOTE_APP}'
FE='${FE_CONTAINER}'
BE='${BE_CONTAINER}'
FE_PORT='${FE_PORT}'
BE_PORT='${BE_PORT}'
IMAGE='${RUNTIME_IMAGE}'
IN="\$APP/.ci-in"

echo "=== Publish .env from CI secrets ==="
test -f "\$IN/pre.env"
if [[ -f "\$APP/.env" ]]; then
  cp -a "\$APP/.env" "\$APP/.env.bak.\$(date +%Y%m%d%H%M%S)"
fi
install -m 600 "\$IN/pre.env" "\$APP/.env"

echo "=== Publish frontend standalone ==="
ST="\$(mktemp -d /tmp/sep-fe-XXXXXX)"
tar -C "\$ST" -xzf "\$IN/frontend-standalone.tgz"
test -f "\$ST/frontend/server.js"
rm -rf "\$APP/frontend"
mkdir -p "\$APP/frontend"
rsync -a "\$ST"/ "\$APP/frontend/"
rm -rf "\$ST"

echo "=== Publish backend app ==="
BT="\$(mktemp -d /tmp/sep-be-XXXXXX)"
tar -C "\$BT" -xzf "\$IN/backend-app.tgz"
test -f "\$BT/backend/dist/main.js"
rm -rf "\$APP/app"
mkdir -p "\$APP/app"
rsync -a "\$BT"/ "\$APP/app/"
rm -rf "\$BT"
cp -f "\$IN/build-meta.txt" "\$APP/.deploy-build-meta.txt" 2>/dev/null || true

if ! podman image exists "\${IMAGE}" 2>/dev/null; then
  if [[ -f "\$APP/imagenes/node-22-bookworm-slim.tar" ]]; then
    podman load -i "\$APP/imagenes/node-22-bookworm-slim.tar"
  else
    echo "ERROR: falta imagen runtime \${IMAGE}" >&2
    exit 1
  fi
fi

echo "=== Recreate \${FE} + \${BE} (host network + mounts + env-file) ==="
podman rm -f "\${FE}" "\${BE}" 2>/dev/null || true

podman run -d --replace --name "\${BE}" \
  --network host \
  --env-file "\$APP/.env" \
  -e TZ=UTC \
  -e BACKEND_PORT="\${BE_PORT}" \
  -v "\$APP/app:/app:Z" \
  -w /app/backend \
  --restart unless-stopped \
  "\${IMAGE}" \
  node dist/main.js

podman run -d --replace --name "\${FE}" \
  --network host \
  -e TZ=America/Bogota \
  -e NODE_ENV=production \
  -e PORT="\${FE_PORT}" \
  -e HOSTNAME=0.0.0.0 \
  -e NEXT_TELEMETRY_DISABLED=1 \
  -v /usr/share/zoneinfo:/usr/share/zoneinfo:ro \
  -v "\$APP/frontend:/app:Z" \
  -w /app \
  --restart unless-stopped \
  "\${IMAGE}" \
  node frontend/server.js

sleep 6
curl -sS -o /dev/null -w "frontend:%{http_code}\\n" "http://127.0.0.1:\${FE_PORT}/" || true
curl -sS -o /dev/null -w "backend:%{http_code}\\n" "http://127.0.0.1:\${BE_PORT}/docs" || true
podman ps --filter "name=sep-" --format '{{.Names}} {{.Status}}'
echo "=== CI deploy PRE OK ==="
EOF
)

"${SSH[@]}" "${TARGET}" "${REMOTE_CMD}"
echo "App: https://pre-sep.sena.edu.co"
