#!/usr/bin/env bash
# Resuelve llave SSH PRE (SEP). Preferir GitLab File DEPLOY_SSH_PRIVATE_KEY (env=pre).
resolve_deploy_ssh_key() {
  local candidate keyfile
  if [[ -n "${DEPLOY_SSH_KEY_FILE:-}" && -f "${DEPLOY_SSH_KEY_FILE}" ]]; then
    echo "${DEPLOY_SSH_KEY_FILE}"
    return 0
  fi
  if [[ -n "${DEPLOY_SSH_PRIVATE_KEY:-}" ]]; then
    if [[ -f "${DEPLOY_SSH_PRIVATE_KEY}" ]]; then
      export DEPLOY_SSH_KEY_FILE="${DEPLOY_SSH_PRIVATE_KEY}"
      chmod 600 "${DEPLOY_SSH_KEY_FILE}" 2>/dev/null || true
      echo "${DEPLOY_SSH_KEY_FILE}"
      return 0
    fi
    keyfile="${CI_PROJECT_DIR:-/tmp}/.ci-ssh-sep-pre.key"
    umask 077
    printf '%s\n' "${DEPLOY_SSH_PRIVATE_KEY}" | tr -d '\r' > "${keyfile}"
    chmod 600 "${keyfile}"
    export DEPLOY_SSH_KEY_FILE="${keyfile}"
    echo "${keyfile}"
    return 0
  fi
  for candidate in \
    "${HOME}/sep-ci/.ssh/sep-pre.key" \
    "/home/opc/sep-ci/.ssh/sep-pre.key" \
    "${HOME}/.ssh/sep-pre.key" \
    "/home/sacriud/Git/ssh/sena/pre-ci/sep-pre.key"
  do
    if [[ -f "${candidate}" ]]; then
      export DEPLOY_SSH_KEY_FILE="${candidate}"
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}
