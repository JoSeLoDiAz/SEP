#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# Despliegue del SEP con docker compose.
#
#   ./docker/desplegar.sh            reconstruye backend + frontend y recarga nginx
#   ./docker/desplegar.sh nginx      solo recarga nginx (config nueva, sin tocar la app)
#   ./docker/desplegar.sh estado     qué hay levantado y desde cuándo
#   ./docker/desplegar.sh logs       sigue los logs del backend
#
# Por qué un script y no los comandos sueltos, y por qué NO basta con
# `docker compose up -d --build`:
#
#   1. nginx resuelve `backend:3000` y `frontend:4000` UNA sola vez, al
#      arrancar. Al reconstruir, docker les da una IP nueva y nginx se queda
#      apuntando a la vieja: el sitio contesta 502 hasta que se recargue. Es un
#      502 que engaña, porque `docker compose ps` muestra todo "Up".
#   2. nginx se recarga en caliente, pero SOLO si la configuración es válida.
#      Recargar una rota deja el proxy caído y con él todo el sitio. Aquí
#      `nginx -t` corre siempre antes del reload y aborta si falla.
#
# Ejecutar desde la raíz del proyecto (donde está docker-compose.yml).
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

azul()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
rojo()  { printf '\033[1;31m%s\033[0m\n' "$*"; }

# `docker compose` (v2) o `docker-compose` (v1), lo que haya.
if docker compose version >/dev/null 2>&1; then dc() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then dc() { docker-compose "$@"; }
else rojo "No encuentro docker compose."; exit 1
fi

recargar_nginx() {
  azul "→ Validando la configuración de nginx"
  # El default.conf está montado como volumen de solo lectura: se edita en
  # disco y se recarga. No hace falta reconstruir ni reiniciar el contenedor.
  if ! dc exec -T nginx nginx -t; then
    rojo "✖ La configuración tiene errores. NO se recargó: nginx sigue con la anterior."
    exit 1
  fi
  azul "→ Recargando nginx en caliente"
  dc exec -T nginx nginx -s reload
  verde "✔ nginx recargado sin cortar conexiones"
}

case "${1:-todo}" in
  nginx)
    recargar_nginx
    ;;

  estado)
    dc ps
    ;;

  logs)
    dc logs -f --tail=100 backend
    ;;

  todo)
    # Este servidor NO llega a registry.npmjs.org: el puerto 443 ni siquiera
    # abre (github, debian y google sí, así que es un bloqueo específico de los
    # registros de paquetes). Mientras pnpm-lock.yaml y los package.json no
    # cambien da igual, porque docker reutiliza la capa del `pnpm install`.
    # Pero en cuanto se agregue o suba una dependencia, esa capa se invalida y
    # el build muere aquí — con un error de corepack que no dice nada de red.
    # Más vale avisarlo antes de esperar el build entero.
    if ! curl -fsS --max-time 8 https://registry.npmjs.org/pnpm >/dev/null 2>&1; then
      if ! git diff --quiet HEAD@{1} HEAD -- pnpm-lock.yaml '*/package.json' package.json 2>/dev/null; then
        rojo "✖ Cambiaron las dependencias y este servidor no llega a npm."
        echo "  El build fallará en 'corepack prepare'. Opciones:"
        echo "    · Pedir a la red que habilite registry.npmjs.org, o"
        echo "    · Construir la imagen donde sí haya salida y traerla:"
        echo "        docker save seplocal-backend | ssh sepadmin@este-host docker load"
        exit 1
      fi
      echo "  (sin salida a npm; se reutilizan las capas de dependencias ya construidas)"
    fi

    azul "→ Reconstruyendo backend y frontend"
    dc up -d --build

    azul "→ Esperando a que el proxy responda"
    # El health de nginx solo dice que el proxy está arriba; que el backend
    # conteste es lo que de verdad importa, y tarda más en arrancar.
    for i in $(seq 1 30); do
      if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then break; fi
      sleep 2
      [ "$i" = 30 ] && { rojo "✖ El proxy no respondió en 60 s"; dc ps; exit 1; }
    done

    recargar_nginx
    echo
    dc ps
    verde "✔ Desplegado — http://localhost:8080"
    echo
    echo "Recuerde: las variables del backend salen de backend/.env (env_file)."
    echo "Si cambió ese archivo, este script ya lo recogió al reconstruir."
    ;;

  *)
    rojo "Opción desconocida: $1"
    echo "Use: todo | nginx | estado | logs"
    exit 1
    ;;
esac
