#!/usr/bin/env bash
# Prepara caches pnpm + binario pnpm + imagen node para build PRE offline.
# Ejecutar en un host CON red, luego copiar a /data/SEP/offline e imagenes/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT="${SEP_OFFLINE_OUT:-${REPO_ROOT}/.ci-offline-seed}"
NODE_IMAGE="${SEP_NODE_IMAGE:-docker.io/library/node:22-bookworm-slim}"
PNPM_VERSION="${SEP_PNPM_VERSION:-10.15.1}"

mkdir -p "${OUT}/pnpm-store" "${OUT}/imagenes"
rm -rf "${REPO_ROOT}/node_modules" "${REPO_ROOT}/frontend/node_modules" "${REPO_ROOT}/backend/node_modules"

echo "=== pnpm standalone + install (con red) para sembrar store + node_modules ==="
if [[ ! -x "${OUT}/pnpm" ]]; then
  curl -fsSL "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linuxstatic-x64" -o "${OUT}/pnpm"
  chmod +x "${OUT}/pnpm"
fi
"${OUT}/pnpm" install --frozen-lockfile --ignore-scripts --store-dir "${OUT}/pnpm-store"
tar -C "${REPO_ROOT}" -czf "${OUT}/node_modules.tgz" \
  node_modules frontend/node_modules backend/node_modules
sha256sum "${REPO_ROOT}/pnpm-lock.yaml" | awk '{print $1}' > "${OUT}/.pnpm-lock.sha256"

if command -v podman >/dev/null; then
  if ! podman image exists "${NODE_IMAGE}"; then
    podman pull "${NODE_IMAGE}"
  fi
  podman save -o "${OUT}/imagenes/node-22-bookworm-slim.tar" "${NODE_IMAGE}"
fi

echo "=== Seed en ${OUT} ==="
ls -lh "${OUT}" "${OUT}/imagenes" || true
echo "Copiar a PRE:"
echo "  scp -i ~/Git/ssh/sena/pre-ci/sep-pre.key ${OUT}/node_modules.tgz ${OUT}/pnpm opc@172.24.129.65:/data/SEP/offline/"
echo "  rsync -az ${OUT}/pnpm-store/ opc@172.24.129.65:/data/SEP/offline/pnpm-store/"
echo "  scp ${OUT}/imagenes/node-22-bookworm-slim.tar opc@172.24.129.65:/data/SEP/imagenes/"
