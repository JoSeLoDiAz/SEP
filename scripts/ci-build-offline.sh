#!/usr/bin/env bash
# Build SEP (Next standalone + Nest dist) en runner GitLab (vmpmgit) — SOLO offline.
# Artefactos: .ci-artifacts/{frontend-standalone.tgz,backend-app.tgz,build-meta.txt}
# Los tarballs se publican por LAN a PRE (GitLab no admite artefactos de cientos de MB).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-lib-ssh.sh
source "${SCRIPT_DIR}/ci-lib-ssh.sh"
REPO_ROOT="${CI_PROJECT_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
OFFLINE_ROOT="${SEP_OFFLINE_ROOT:-/home/opc/sep-ci/offline}"
OUT_DIR="${REPO_ROOT}/.ci-artifacts"
NODE_IMAGE="${SEP_NODE_IMAGE:-docker.io/library/node:22-bookworm-slim}"
PNPM_STORE="${OFFLINE_ROOT}/pnpm-store"
NODE_TAR="${OFFLINE_ROOT}/imagenes/node-22-bookworm-slim.tar"
NODE_MODULES_TGZ="${OFFLINE_ROOT}/node_modules.tgz"
PNPM_BIN="${OFFLINE_ROOT}/pnpm"
REMOTE_APP="${DEPLOY_REMOTE_APP_DIR:-/data/SEP}"

[[ -f "${REPO_ROOT}/pnpm-lock.yaml" ]] || { echo "ERROR: falta pnpm-lock.yaml" >&2; exit 1; }
command -v podman >/dev/null || { echo "ERROR: podman requerido en runner build" >&2; exit 1; }

mkdir -p "${OUT_DIR}" "${OFFLINE_ROOT}/imagenes" "${PNPM_STORE}"

reuse_local_node_tar() {
  if podman image exists "${NODE_IMAGE}" 2>/dev/null; then
    echo "=== Imagen ${NODE_IMAGE} ya cargada en el runner ==="
    return 0
  fi
  [[ -f "${NODE_TAR}" ]] && return 0
  local src
  for src in \
    /home/opc/masamadre-ci/offline/imagenes/node-22-bookworm-slim.tar \
    /home/opc/sips-ci/offline/imagenes/node-22-bookworm-slim.tar
  do
    if [[ -f "${src}" ]]; then
      echo "=== Reusando tar Node local ${src} ==="
      cp -f "${src}" "${NODE_TAR}"
      return 0
    fi
  done
  return 1
}

seed_offline_from_pre_if_needed() {
  local lock_hash=""
  local lock_hash_file="${OFFLINE_ROOT}/.pnpm-lock.sha256"
  lock_hash="$(sha256sum "${REPO_ROOT}/pnpm-lock.yaml" | awk '{print $1}')"
  reuse_local_node_tar || true

  local need_image=0 need_pnpm=0 need_deps=0
  podman image exists "${NODE_IMAGE}" 2>/dev/null || [[ -f "${NODE_TAR}" ]] || need_image=1
  [[ -x "${PNPM_BIN}" && -f "${PNPM_BIN}" ]] || need_pnpm=1
  if [[ ! -f "${NODE_MODULES_TGZ}" ]]; then
    need_deps=1
  elif [[ -f "${lock_hash_file}" ]]; then
    local stored=""
    stored="$(tr -d '[:space:]' < "${lock_hash_file}")"
    [[ "${stored}" == "${lock_hash}" ]] || need_deps=1
  fi
  if [[ "${need_image}" -eq 0 && "${need_pnpm}" -eq 0 && "${need_deps}" -eq 0 ]]; then
    echo "=== Offline local OK (sin resembra) ==="
    return 0
  fi

  local key host user
  key="$(resolve_deploy_ssh_key)" || {
    echo "ERROR: faltan caches offline en ${OFFLINE_ROOT} y no hay llave SSH a PRE" >&2
    return 1
  }
  host="${DEPLOY_SSH_HOST:-172.24.129.65}"
  user="${DEPLOY_SSH_USER:-opc}"
  chmod 600 "${key}" 2>/dev/null || true
  pre_ssh_opts
  local ssh=(ssh -i "${key}" "${PRE_SSH_OPTS[@]}")
  # -O: SCP legado. Sin eso, OpenSSH 9+ (SFTP) se cuelga con el gate command=.
  local scp=(scp -O -i "${key}" "${PRE_SSH_OPTS[@]}")
  echo "=== Sembrando offline SEP desde ${user}@${host} (LAN, no Internet) ==="
  echo "faltantes: image=${need_image} pnpm=${need_pnpm} deps=${need_deps}"

  if [[ "${need_image}" -eq 1 ]]; then
    echo "=== scp imagen Node desde PRE (scp -O) ==="
    if "${ssh[@]}" "${user}@${host}" "test -f '${REMOTE_APP}/imagenes/node-22-bookworm-slim.tar'"; then
      "${scp[@]}" "${user}@${host}:${REMOTE_APP}/imagenes/node-22-bookworm-slim.tar" "${NODE_TAR}"
      echo "=== imagen Node OK ==="
    else
      echo "ERROR: no hay node-22-bookworm-slim.tar en PRE" >&2
      return 1
    fi
  fi
  if [[ "${need_pnpm}" -eq 1 ]]; then
    echo "=== scp binario pnpm desde PRE ==="
    if "${ssh[@]}" "${user}@${host}" "test -x '${REMOTE_APP}/offline/pnpm'"; then
      "${scp[@]}" "${user}@${host}:${REMOTE_APP}/offline/pnpm" "${PNPM_BIN}"
      chmod +x "${PNPM_BIN}"
      echo "=== pnpm OK ==="
    fi
  fi
  if [[ "${need_deps}" -eq 1 ]]; then
    echo "=== scp node_modules.tgz desde PRE ==="
    if "${ssh[@]}" "${user}@${host}" "test -f '${REMOTE_APP}/offline/node_modules.tgz'"; then
      "${scp[@]}" "${user}@${host}:${REMOTE_APP}/offline/node_modules.tgz" "${NODE_MODULES_TGZ}"
      echo "${lock_hash}" > "${lock_hash_file}"
      echo "=== node_modules.tgz OK (sin rsync del store) ==="
    else
      echo "ERROR: falta ${REMOTE_APP}/offline/node_modules.tgz" >&2
      return 1
    fi
  fi
}

ensure_image_from_tar() {
  local image="$1" tarpath="$2"
  if podman image exists "${image}" 2>/dev/null; then
    return 0
  fi
  [[ -f "${tarpath}" ]] || {
    echo "ERROR: falta imagen ${image} y no existe ${tarpath}" >&2
    return 1
  }
  echo "=== podman load ${tarpath} ==="
  podman load -i "${tarpath}"
  podman image exists "${image}" 2>/dev/null || {
    echo "ERROR: tras load no existe ${image}" >&2
    return 1
  }
}

seed_offline_from_pre_if_needed
ensure_image_from_tar "${NODE_IMAGE}" "${NODE_TAR}"

if [[ -f "${NODE_MODULES_TGZ}" ]] && [[ ! -d "${REPO_ROOT}/node_modules/.pnpm" ]]; then
  echo "=== Restaurando node_modules desde seed ==="
  tar -C "${REPO_ROOT}" -xzf "${NODE_MODULES_TGZ}"
fi

if [[ -z "$(ls -A "${PNPM_STORE}" 2>/dev/null || true)" ]] && [[ ! -d "${REPO_ROOT}/node_modules/.pnpm" ]]; then
  echo "ERROR: sin pnpm-store ni node_modules; no se permite install con red" >&2
  exit 1
fi

TURNSTILE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-0x4AAAAAADD6VVCyoP6eM5Ao}"
PUBLIC_API="${NEXT_PUBLIC_API_URL:-/api}"

pick_stage_root() {
  local d avail
  for d in /FS/maintenance/sep-tmp /home/opc/sep-ci/tmp /var/tmp; do
    mkdir -p "${d}" 2>/dev/null || continue
    [[ -w "${d}" ]] || continue
    avail="$(df -Pm "${d}" 2>/dev/null | awk 'NR==2 { print $4 }')"
    [[ -n "${avail}" && "${avail}" -gt 2048 ]] || continue
    echo "${d}"
    return 0
  done
  echo ""
}

STAGE_ROOT="$(pick_stage_root)"
if [[ -n "${STAGE_ROOT}" ]]; then
  echo "=== Stage backend en ${STAGE_ROOT} (fuera del disco raiz) ==="
  rm -rf "${STAGE_ROOT}/be-root"
fi

echo "=== CI build Next standalone + Nest dist offline ==="
PODMAN_VOLS=(-v "${REPO_ROOT}:/app:Z" -v "${PNPM_STORE}:/store:Z")
if [[ -x "${PNPM_BIN}" && -f "${PNPM_BIN}" ]]; then
  PODMAN_VOLS+=(-v "${PNPM_BIN}:/opt/pnpm:Z")
fi
if [[ -n "${STAGE_ROOT}" ]]; then
  PODMAN_VOLS+=(-v "${STAGE_ROOT}:/stage:Z")
fi
podman run --rm \
  "${PODMAN_VOLS[@]}" \
  -e CI=1 \
  -e NEXT_TELEMETRY_DISABLED=1 \
  -e NEXT_PUBLIC_API_URL="${PUBLIC_API}" \
  -e NEXT_PUBLIC_TURNSTILE_SITE_KEY="${TURNSTILE_KEY}" \
  -e PNPM_STORE_DIR=/store \
  "${NODE_IMAGE}" \
  bash -c '
    set -euo pipefail
    cd /app
    if [[ -x /opt/pnpm ]]; then
      PNPM=/opt/pnpm
    elif [[ -x node_modules/.bin/pnpm ]]; then
      PNPM=node_modules/.bin/pnpm
    else
      echo "ERROR: no hay binario pnpm offline" >&2
      exit 1
    fi
    if [[ ! -d node_modules/.pnpm ]]; then
      if "${PNPM}" install --frozen-lockfile --offline --store-dir /store --ignore-scripts; then
        echo "pnpm install offline OK"
      else
        echo "ERROR: pnpm install fallo (offline)" >&2
        exit 1
      fi
    else
      echo "Usando node_modules existente (sin pnpm install)"
    fi
    "${PNPM}" --filter frontend run build
    "${PNPM}" --filter backend run build
    test -f frontend/.next/standalone/frontend/server.js
    test -f backend/dist/main.js
    mkdir -p frontend/.next/standalone/frontend/.next
    mkdir -p frontend/.next/standalone/frontend/public
    cp -a frontend/.next/static frontend/.next/standalone/frontend/.next/static
    if [[ -d frontend/public ]]; then
      cp -a frontend/public/. frontend/.next/standalone/frontend/public/
    fi
    if [[ -d /stage && -w /stage ]]; then
      echo "=== pnpm deploy backend --prod (sin Next/SWC) ==="
      rm -rf /stage/be-root
      mkdir -p /stage/be-root
      if "${PNPM}" --filter backend deploy --prod /stage/be-root/backend \
        && test -f /stage/be-root/backend/dist/main.js; then
        echo "pnpm deploy backend OK"
      else
        echo "Aviso: pnpm deploy fallo; se usara fallback en el host"
        rm -rf /stage/be-root
      fi
    fi
  '

tar -C "${REPO_ROOT}/frontend/.next/standalone" -czf "${OUT_DIR}/frontend-standalone.tgz" .
test -f "${OUT_DIR}/frontend-standalone.tgz"
echo "=== Liberando frontend/.next del disco raiz ==="
rm -rf "${REPO_ROOT}/frontend/.next"

pack_backend_tarball() {
  if [[ -f "${STAGE_ROOT:-}/be-root/backend/dist/main.js" ]]; then
    echo "=== Empaquetando backend desde pnpm deploy ==="
    tar -C "${STAGE_ROOT}/be-root" -czf "${OUT_DIR}/backend-app.tgz" .
    rm -rf "${STAGE_ROOT}/be-root"
    return 0
  fi

  echo "=== Empaquetando backend (rsync sin Next/SWC; fallback) ==="
  local stage
  if [[ -n "${STAGE_ROOT}" ]]; then
    stage="${STAGE_ROOT}/be-root"
    rm -rf "${stage}"
    mkdir -p "${stage}"
  else
    stage="$(mktemp -d /var/tmp/sep-be-XXXXXX)"
  fi
  mkdir -p "${stage}/backend" "${stage}/frontend"
  cp -a "${REPO_ROOT}/package.json" "${REPO_ROOT}/pnpm-workspace.yaml" "${REPO_ROOT}/pnpm-lock.yaml" "${stage}/"
  cp -a "${REPO_ROOT}/frontend/package.json" "${stage}/frontend/"
  cp -a "${REPO_ROOT}/backend/package.json" "${REPO_ROOT}/backend/dist" "${stage}/backend/"
  if [[ -d "${REPO_ROOT}/node_modules" ]]; then
    rsync -a \
      --exclude='.pnpm/@next*' \
      --exclude='.pnpm/next@*' \
      --exclude='.pnpm/@swc*' \
      --exclude='.pnpm/react@*' \
      --exclude='.pnpm/react-dom@*' \
      --exclude='.pnpm/sharp@*' \
      --exclude='.pnpm/@esbuild*' \
      --exclude='.cache' \
      "${REPO_ROOT}/node_modules/" "${stage}/node_modules/"
  fi
  if [[ -d "${REPO_ROOT}/backend/node_modules" ]]; then
    rsync -a "${REPO_ROOT}/backend/node_modules/" "${stage}/backend/node_modules/"
  fi
  tar -C "${stage}" -czf "${OUT_DIR}/backend-app.tgz" .
  rm -rf "${stage}"
}

pack_backend_tarball
test -f "${OUT_DIR}/backend-app.tgz"

cat > "${OUT_DIR}/build-meta.txt" <<EOF
sha=${CI_COMMIT_SHA:-unknown}
short=${CI_COMMIT_SHORT_SHA:-unknown}
ref=${CI_COMMIT_REF_NAME:-unknown}
built_at=$(date -Is)
node_image=${NODE_IMAGE}
offline_pnpm=1
offline_mode=strict
next_public_api_url=${PUBLIC_API}
frontend_sha256=$(sha256sum "${OUT_DIR}/frontend-standalone.tgz" | awk '{print $1}')
backend_sha256=$(sha256sum "${OUT_DIR}/backend-app.tgz" | awk '{print $1}')
EOF

ls -lh "${OUT_DIR}"

publish_artifacts_to_pre() {
  local key host user
  key="$(resolve_deploy_ssh_key)" || {
    echo "ERROR: no hay llave SSH para publicar artefactos en PRE" >&2
    return 1
  }
  host="${DEPLOY_SSH_HOST:-172.24.129.65}"
  user="${DEPLOY_SSH_USER:-opc}"
  chmod 600 "${key}" 2>/dev/null || true
  pre_ssh_opts
  local ssh=(ssh -i "${key}" "${PRE_SSH_OPTS[@]}")
  local scp=(scp -O -i "${key}" "${PRE_SSH_OPTS[@]}")
  echo "=== Publicando artefactos por LAN a ${user}@${host}:${REMOTE_APP}/.ci-in ==="
  "${ssh[@]}" "${user}@${host}" "mkdir -p '${REMOTE_APP}/.ci-in'"
  "${scp[@]}" \
    "${OUT_DIR}/frontend-standalone.tgz" \
    "${OUT_DIR}/backend-app.tgz" \
    "${OUT_DIR}/build-meta.txt" \
    "${user}@${host}:${REMOTE_APP}/.ci-in/"
  "${ssh[@]}" "${user}@${host}" \
    "test -f '${REMOTE_APP}/.ci-in/frontend-standalone.tgz' && test -f '${REMOTE_APP}/.ci-in/backend-app.tgz' && grep -q 'short=${CI_COMMIT_SHORT_SHA:-unknown}' '${REMOTE_APP}/.ci-in/build-meta.txt'"
  echo "=== Artefactos en PRE (.ci-in) OK ==="
}

publish_artifacts_to_pre
echo "=== CI build OK (offline estricto) ==="
