#!/usr/bin/env bash
# Sincroniza Variables CI/CD de PRE en GitLab (SEP project 350).
#
# Uso:
#   set -a; source /ruta/.env.gitlab-sync; set +a
#   SEP_PRE_ENV_FILE=/tmp/sep-pre.env GITLAB_PROJECT_ID=350 \
#     bash scripts/ci-sync-gitlab-pre-variables.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_SRC="${SEP_PRE_ENV_FILE:-}"
if [[ -z "${ENV_SRC}" ]]; then
  for candidate in \
    "${REPO_ROOT}/.env.pre.sep" \
    "/tmp/sep-pre.env" \
    "/tmp/sep-pre.env.from-vm"
  do
    if [[ -f "${candidate}" ]]; then
      ENV_SRC="${candidate}"
      break
    fi
  done
fi
ENV_SRC="${ENV_SRC:-${REPO_ROOT}/.env.pre.sep}"

SSH_KEY_SRC="${DEPLOY_SSH_KEY_FILE:-/home/sacriud/Git/ssh/sena/pre-ci/sep-pre.key}"

export GITLAB_URL="${GITLAB_URL:-https://projecthub.sena.edu.co}"
export GITLAB_TOKEN="${GITLAB_TOKEN:?Defina GITLAB_TOKEN}"
export GITLAB_PROJECT_ID="${GITLAB_PROJECT_ID:-350}"
export GITLAB_ENV_SCOPE="${GITLAB_ENV_SCOPE:-pre}"
export SEP_PRE_ENV_FILE="${ENV_SRC}"
export DEPLOY_SSH_KEY_FILE="${SSH_KEY_SRC}"

[[ -f "${ENV_SRC}" ]] || { echo "ERROR: falta ${ENV_SRC}" >&2; exit 1; }
[[ -f "${SSH_KEY_SRC}" ]] || { echo "ERROR: falta ${SSH_KEY_SRC}" >&2; exit 1; }

echo "Fuente .env: ${ENV_SRC}"
echo "SSH key:     ${SSH_KEY_SRC}"
echo "Proyecto:    ${GITLAB_PROJECT_ID} scope=${GITLAB_ENV_SCOPE}"

python3 <<'PY'
import json, os, re, urllib.parse, urllib.request

base = os.environ["GITLAB_URL"].rstrip("/")
token = os.environ["GITLAB_TOKEN"]
pid = os.environ["GITLAB_PROJECT_ID"]
scope = os.environ["GITLAB_ENV_SCOPE"]
env_path = os.environ["SEP_PRE_ENV_FILE"]
key_path = os.environ["DEPLOY_SSH_KEY_FILE"]
api = f"{base}/api/v4/projects/{pid}"

MASK_RE = re.compile(r"^[a-zA-Z0-9_+=/@:.-]{8,}$")

def load_env(path):
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out

env = load_env(env_path)

required = [
    "BACKEND_PORT", "FRONTEND_PORT",
    "ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_CONNECT_STRING",
    "JWT_SECRET", "APP_URL",
]
for k in required:
    if k not in env or env.get(k) in (None, ""):
        raise SystemExit(f"falta o vacia {k} en {env_path}")

masked_want = ["ORACLE_PASSWORD", "JWT_SECRET", "SMTP_PASS", "TURNSTILE_SECRET"]
plain = [
    "BACKEND_PORT", "FRONTEND_PORT", "NODE_ENV", "TZ",
    "ORACLE_USER", "ORACLE_CONNECT_STRING",
    "JWT_EXPIRES_IN",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER",
    "APP_URL",
    "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
]

def call(method, url, data=None):
    body = None
    headers = {"PRIVATE-TOKEN": token}
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw)
        except Exception:
            payload = raw
        return e.code, payload

def upsert(key, value, masked_flag, vtype="env_var"):
    if value == "":
        value = " "
    q = urllib.parse.urlencode({"filter[environment_scope]": scope})
    put_url = f"{api}/variables/{urllib.parse.quote(key, safe='')}?{q}"
    data = {
        "value": value,
        "masked": "true" if masked_flag else "false",
        "protected": "true",
        "environment_scope": scope,
        "variable_type": vtype,
    }
    code, payload = call("PUT", put_url, data)
    if code == 200:
        print(f"UPD {key} masked={masked_flag} type={vtype}")
        return True
    data2 = dict(data)
    data2["key"] = key
    code, payload = call("POST", f"{api}/variables", data2)
    if code == 201:
        print(f"NEW {key} masked={masked_flag} type={vtype}")
        return True
    return False, code, payload

def upsert_mask_fallback(key, value, want_masked, vtype="env_var"):
    if want_masked and (value == "" or value == " " or not MASK_RE.match(value)):
        want_masked = False
    ok = upsert(key, value, want_masked, vtype)
    if ok is True:
        return
    code, payload = ok[1], ok[2]
    if want_masked:
        print(f"AVISO: {key} no maskable ({code}); reintento protected sin mask")
        ok2 = upsert(key, value, False, vtype)
        if ok2 is True:
            return
        raise SystemExit(f"FAIL {key}: {ok2}")
    raise SystemExit(f"FAIL {key}: {code} {payload}")

for k in plain:
    upsert_mask_fallback(k, env.get(k, ""), False)

for k in masked_want:
    upsert_mask_fallback(k, env.get(k, ""), True)

with open(key_path, encoding="utf-8") as f:
    pem = f.read()
upsert_mask_fallback("DEPLOY_SSH_PRIVATE_KEY", pem, False, "file")

code, vars_ = call("GET", f"{api}/variables?per_page=100")
if code != 200:
    raise SystemExit(f"FAIL list variables: {code} {vars_}")
print(f"=== {len(vars_)} variables en proyecto {pid} ===")
for v in sorted(vars_, key=lambda x: x["key"]):
    print(
        f"{v['key']:36} masked={v.get('masked')} protected={v.get('protected')} "
        f"type={v.get('variable_type')} scope={v.get('environment_scope')}"
    )
PY
