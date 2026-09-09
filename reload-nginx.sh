#!/bin/bash
# Recarga nginx para que resuelva las IPs actualizadas de los contenedores
docker compose exec nginx nginx -s reload
echo "✓ Nginx recargado"
