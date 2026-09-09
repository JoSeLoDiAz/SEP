#!/usr/bin/env bash
# Resuelve llave SSH PRE (SEP). Preferir GitLab File DEPLOY_SSH_PRIVATE_KEY (env=pre).
#
# OpenSSH 9+ usa SFTP en scp. El gate de authorized_keys (command=) no habla SFTP
# y el cliente se queda colgado. Forzar protocolo legado: scp -O (si el binario lo tiene).
# El scp de OL8/vmpmgit no entiende -O; ahi el protocolo ya es el legado.
pre_ssh_opts() {
  PRE_SSH_OPTS=(
    -o BatchMode=yes
    -o StrictHostKeyChecking=accept-new
    -o ConnectTimeout=30
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=4
    -o IdentitiesOnly=yes
  )
}

pre_scp_opts() {
  pre_ssh_opts
  PRE_SCP_OPTS=()
  if ! scp -O 2>&1 | grep -q 'unknown option'; then
    PRE_SCP_OPTS+=(-O)
  fi
}

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
