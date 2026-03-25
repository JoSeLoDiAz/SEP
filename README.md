# SEP Local — Sistema Especializado de Proyectos

Sistema de gestión de Proyectos que lleve a cabo el GGPC - SENA  y la DSNFT modernizado a nuevas tecnologias.

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Vue 3 + Vite + TypeScript | 3.5 / 6.x |
| Backend | NestJS + TypeORM | 11.x |
| Base de datos | Oracle XE | 21c |
| Proxy | Nginx | stable-alpine |
| Runtime | Node.js | 22 LTS |
| Contenedores | Docker + Compose | 29.x / 5.x |

## Levantar entorno
```bash
docker compose up -d --build
```

La app queda en `http://localhost:8080`
