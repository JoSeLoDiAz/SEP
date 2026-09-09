# Informe de Desarrollo — Configuración del Servidor Ubuntu
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Tipo:** Informe técnico de infraestructura

---

## 1. Descripción General

Se configuró desde cero un servidor Ubuntu Server 22.04 LTS para alojar el nuevo SEP en un entorno de desarrollo/pruebas controlado. El servidor corre en la máquina local del equipo de desarrollo con salida web habilitada, conectado al clon de la base de datos Oracle de producción.

---

## 2. Especificaciones del Servidor

| Parámetro | Valor |
|---|---|
| Sistema Operativo | Ubuntu Server 22.04 LTS (Jammy Jellyfish) |
| Tipo de entorno | Desarrollo / Pruebas privadas |
| Conectividad | Salida web desde máquina local |
| Base de datos conectada | Clon exacto de Oracle de producción |
| Acceso | SSH directo al servidor |

---

## 3. Software Instalado

### 3.1 Docker Engine
Motor de contenedores para orquestar todos los servicios del SEP.

```bash
# Instalación Docker Engine
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
systemctl enable docker
systemctl start docker
```

**Versión instalada:** Docker Engine 26.x + Docker Compose Plugin v2.x

---

### 3.2 Estructura del Proyecto

El código fuente del nuevo SEP se organizó en un monorepo gestionado con **pnpm workspaces**:

```
/opt/sep/SEPLocal/
├── backend/          # API NestJS
│   ├── src/
│   │   ├── auth/             # Autenticación y registro
│   │   ├── certificados/     # Generación de certificados PDF
│   │   ├── empresa/          # Módulo empresa/gremio
│   │   └── main.ts
│   └── Dockerfile
│
├── frontend/         # UI Next.js
│   ├── src/
│   │   ├── app/              # Rutas App Router
│   │   ├── components/       # Componentes reutilizables
│   │   └── lib/              # Utilidades, API client, auth
│   └── Dockerfile
│
├── docker/
│   └── nginx/
│       ├── nginx.conf        # Configuración del reverse proxy
│       └── ssl/              # Certificados SSL
│
├── docker-compose.yml        # Orquestación de servicios
└── pnpm-workspace.yaml
```

---

## 4. Docker Compose — Orquestación de Servicios

El archivo `docker-compose.yml` define los tres contenedores que componen el sistema:

```yaml
services:
  backend:
    build: ./backend
    container_name: sep-backend
    environment:
      - DB_HOST=<oracle_host>
      - DB_PORT=1521
      - DB_SERVICE=<service_name>
      - DB_USER=<usuario>
      - DB_PASSWORD=<password>
      - JWT_SECRET=<secreto>
    networks: [sep-net]

  frontend:
    build: ./frontend
    container_name: sep-frontend
    environment:
      - NEXT_PUBLIC_API_URL=/api
      - NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<key>
    depends_on: [backend]
    networks: [sep-net]

  nginx:
    image: nginx:alpine
    container_name: sep-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
    depends_on: [frontend, backend]
    networks: [sep-net]

networks:
  sep-net:
    driver: bridge
```

### Comandos de operación
```bash
# Construir y levantar todos los servicios
docker compose build && docker compose up -d

# Reconstruir solo un servicio
docker compose build backend && docker compose up -d backend

# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar nginx (aplicar cambios de config)
docker compose restart nginx

# Ver estado de contenedores
docker compose ps
```

---

## 5. Nginx — Reverse Proxy

Nginx actúa como punto de entrada único, distribuyendo el tráfico entre el frontend y el backend:

```nginx
server {
    listen 443 ssl;
    server_name <dominio_privado>;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Backend API
    location /api/ {
        proxy_pass http://sep-backend:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend (todo lo demás)
    location / {
        proxy_pass http://sep-frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Redirigir HTTP → HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

---

## 6. Backend — Dockerización (NestJS)

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3001
CMD ["node", "dist/main"]
```

### Configuración de la base de datos (TypeORM + Oracle)
```typescript
// app.module.ts
TypeOrmModule.forRoot({
  type: 'oracle',
  host: process.env.DB_HOST,
  port: 1521,
  serviceName: process.env.DB_SERVICE,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: false,   // NUNCA true con Oracle de producción
  logging: false,
})
```

> `synchronize: false` es crítico: garantiza que TypeORM **nunca modifique** el esquema de la base de datos Oracle institucional.

---

## 7. Frontend — Dockerización (Next.js)

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 8. Variables de Entorno (.env)

```env
# Base de datos Oracle
DB_HOST=<host>
DB_PORT=1521
DB_SERVICE=<service>
DB_USER=<user>
DB_PASSWORD=<password>

# JWT
JWT_SECRET=<secreto_largo_aleatorio>
JWT_EXPIRATION=8h

# Frontend
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<key>
```

---

## 9. Script de Recarga Nginx

Para aplicar cambios de configuración sin interrumpir los demás servicios:

```bash
# /opt/sep/SEPLocal/reload-nginx.sh
#!/bin/bash
docker compose -f /opt/sep/SEPLocal/docker-compose.yml restart nginx
echo "Nginx recargado: $(date)"
```

---

## 10. Flujo de Despliegue (Ciclo de Desarrollo)

```
1. Cambios en código fuente (Git)
        │
        ▼
2. docker compose build backend frontend
        │
        ▼
3. docker compose up -d backend frontend
        │
        ▼
4. docker compose restart nginx
        │
        ▼
5. Verificar: docker compose ps
              docker compose logs -f
```

---

## 11. Pantallazos sugeridos para este informe

| # | Qué capturar | Comando / Dónde |
|---|---|---|
| 1 | Contenedores corriendo | `docker compose ps` en terminal |
| 2 | Logs del backend arrancando | `docker compose logs backend` |
| 3 | Logs del frontend arrancando | `docker compose logs frontend` |
| 4 | Árbol de directorios del proyecto | `tree /opt/sep/SEPLocal -L 3` |
| 5 | Uso de recursos Docker | `docker stats` |
| 6 | Página web accesible en el navegador | URL del dominio privado |

---

## Correo Ejecutivo — Email 2

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Configuración del servidor y entorno de desarrollo completada

---

Cordial saludo,

Se informa que la **infraestructura base del nuevo SEP** ha sido configurada exitosamente desde cero sobre un servidor Ubuntu Server 22.04 LTS.

El entorno se compone de tres contenedores Docker orquestados con Docker Compose:

- **sep-backend**: API REST en NestJS conectada al clon de la base de datos Oracle de producción
- **sep-frontend**: Interfaz web en Next.js 15
- **sep-nginx**: Reverse proxy con enrutamiento de tráfico entre frontend y API

El sistema se encuentra operativo en el entorno de pruebas con acceso web desde la máquina local. La base de datos Oracle no ha sido modificada en ningún aspecto: el sistema se conecta de solo lectura/escritura mediante las mismas tablas del SEP actual.

Se adjunta informe técnico con el detalle de la configuración, Dockerfiles, variables de entorno y flujo de despliegue.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
