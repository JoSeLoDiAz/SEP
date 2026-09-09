#!/usr/bin/env bash
# Genera /data/SEP/.env (PRE) a partir de variables CI/CD (environment=pre).
set -euo pipefail

OUT="${1:-.ci-artifacts/pre.env}"
mkdir -p "$(dirname "${OUT}")"

require() {
  local k="$1"
  if [[ -z "${!k:-}" ]]; then
    echo "ERROR: falta variable CI requerida: ${k}" >&2
    exit 1
  fi
}

require BACKEND_PORT
require FRONTEND_PORT
require ORACLE_USER
require ORACLE_PASSWORD
require ORACLE_CONNECT_STRING
require JWT_SECRET
require APP_URL

trim_space() {
  local v="${1:-}"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "${v}"
}

NODE_ENV_VAL="$(trim_space "${NODE_ENV:-production}")"
TZ_VAL="$(trim_space "${TZ:-UTC}")"
JWT_EXPIRES_IN="$(trim_space "${JWT_EXPIRES_IN:-30m}")"
SMTP_HOST="$(trim_space "${SMTP_HOST:-relay.sena.edu.co}")"
SMTP_PORT="$(trim_space "${SMTP_PORT:-587}")"
SMTP_USER="$(trim_space "${SMTP_USER:-sep@sena.edu.co}")"
SMTP_PASS="$(trim_space "${SMTP_PASS:-}")"
TURNSTILE_SECRET="$(trim_space "${TURNSTILE_SECRET:-}")"
NEXT_PUBLIC_API_URL="$(trim_space "${NEXT_PUBLIC_API_URL:-/api}")"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="$(trim_space "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}")"

umask 077
cat >"${OUT}" <<EOF
# Generado por CI $(date -u +%Y-%m-%dT%H:%M:%SZ) commit=${CI_COMMIT_SHORT_SHA:-local}

BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
NODE_ENV=${NODE_ENV_VAL}
TZ=${TZ_VAL}

ORACLE_USER=${ORACLE_USER}
ORACLE_PASSWORD=${ORACLE_PASSWORD}
ORACLE_CONNECT_STRING=${ORACLE_CONNECT_STRING}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN}

SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}

APP_URL=${APP_URL}
TURNSTILE_SECRET=${TURNSTILE_SECRET}

NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
EOF

chmod 600 "${OUT}"
echo "Rendered env -> ${OUT} (keys only):"
grep -E '^[A-Z]' "${OUT}" | cut -d= -f1
