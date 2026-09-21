# SEP — Sistema Especializado de Proyectos

Plataforma de gestión de proyectos para el **GGPC — SENA / DSNFT**: formulación, aprobación, ejecución de convenios, certificación y banco de evaluadores.

> **Última actualización:** 21 septiembre 2026
>
> **Estado en una línea.** Producción está en **Oracle** (Exadata del SENA, solo por VPN). La rama `dev` lleva la **migración a PostgreSQL**, que está a medias: **`dev` no se despliega**. Para trabajar contra Oracle se usa `produccion` / `sep-oracle`. Detalle en [Estado de la migración](#estado-de-la-migración-a-postgresql).

---

## Índice

- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura) · [URLs públicas](#urls-públicas)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Setup para desarrolladores](#setup-para-desarrolladores) · [Variables de entorno](#variables-de-entorno)
- [Estrategia de ramas](#estrategia-de-ramas) · [Despliegue](#despliegue)
- [Roles de base de datos](#roles-de-base-de-datos)
- [Estado de la migración a PostgreSQL](#estado-de-la-migración-a-postgresql)
- [Pendientes externos](#pendientes-externos)
- [Documentación detallada](#documentación-detallada)
- [Equipo](#equipo)
- [Funcionalidades implementadas](#funcionalidades-implementadas)

---

## Stack tecnológico

Versiones que resuelve `pnpm-lock.yaml` en `dev`.

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js (App Router, salida `standalone`, Turbopack en dev) + TypeScript | 15.5 / 5.9 |
| UI | React | 19.2 |
| Estilos / iconos | Tailwind CSS + lucide-react | 3.4 / 0.447 |
| Estado y datos | TanStack Query + Zustand + Axios | 5.96 / 5.0 / 1.13 |
| Calendario | FullCalendar (cronograma) | 6.1 |
| Backend | NestJS + TypeORM (SQL crudo vía `DataSource`) | 11.1 / 0.3.28 |
| Documentación API | Swagger (`@nestjs/swagger`) en `/docs` | 11.2 |
| Base de datos — producción | Oracle en el Exadata del SENA (solo con VPN) | 19 |
| Base de datos — migración (`dev`) | PostgreSQL en Docker (`sep_db`, esquema `sep`) | 17 |
| Drivers | `oracledb` (modo thin) / `pg` | 6.10 / 8.23 |
| Proxy | Nginx: `nginx:stable-alpine` en el servidor propio; Nginx del host en PRE | stable |
| Runtime | Node.js: `node:22-alpine` (servidor propio) / `node:22-bookworm-slim` (PRE) | 22 LTS |
| Contenedores | Docker + Compose (servidor propio) · Podman con build offline (PRE) | — |
| Gestor de paquetes | pnpm workspaces (lockfile v9, sin `packageManager` fijado) | 10.x |
| Captcha | Cloudflare Turnstile (`@marsidev/react-turnstile` + `siteverify` en el backend), apagable | 1.5 |
| Email | Nodemailer + SMTP (por defecto, el relay del SENA) | 8.0 |
| PDFs | PDFKit | 0.18 |
| Excel | ExcelJS + SheetJS (`xlsx`) | 4.4 / 0.18 |
| Auth | JWT (`@nestjs/jwt` + Passport); claves compatibles con Encrypt64 de GeneXus (`twofish`) | 11.0 / 0.7 |
| Pruebas | Jest + ts-jest | 30.3 / 29.4 |

**Qué motor usa cada rama.** `produccion`, `sep-oracle` y la rama `PRE` de GitLab solo tienen Oracle (no traen `pg`). En `dev` el motor lo elige `DB_TIPO` y, en la práctica, solo funciona con PostgreSQL: ver [Setup](#setup-para-desarrolladores).

---

## Arquitectura

El SEP tiene hoy cuatro piezas que conviene no confundir:

| | Qué es | Rama | Cómo se despliega |
|---|---|---|---|
| **(a) Servidor propio** | VM Hyper-V con Ubuntu y Docker Compose; por ip interna. Su base es el Oracle XE, que no recibe escrituras desde el traslado al Exadata (10 sep 2026) | `produccion` | `./docker/desplegar.sh` en el servidor (solo Josse) |
| **(b) Preproducción del SENA** | VM del SENA en red cerrada, contenedores con Podman; publica `pre-sep.sena.edu.co` | `PRE` (GitLab institucional) | pipeline: `build:pre` automático, `deploy:pre` manual |
| **(c) Exadata del SENA** | Oracle de pre-producción. Sin URL pública: se llega por VPN | — | scripts `docs/migraciones/v69`–`v71` |
| **(d) PostgreSQL de la migración** | Base de destino al dar de baja GeneXus (`sep_db`, esquema `sep`); documentos en un volumen propio | solo `dev` | aún no se despliega; no está en ningún compose del repo |

```
usuarios ──▶ https://pre-sep.sena.edu.co
┌─────────────────────────────────────────────────────────────┐
│ (b) PREPRODUCCIÓN — VM SENA · rama PRE                  │
│   GitLab: push a PRE → build:pre (offline) → deploy:pre     │
│   nginx del host ─┬─ /     → sep-frontend                   │
│                   └─ /api/ → sep-backend                    │
│   sin salida a internet · captcha apagado                   │
└─────────────────────────────────────────────────────────────┘

(c) Exadata SENA — Oracle de producción
(d) PostgreSQL de la migración — solo dev (DB_TIPO=postgres)
```

- **A qué base habla cada backend no está en el repo.** Lo fija `ORACLE_CONNECT_STRING`: en `backend/.env` del servidor propio y en las variables de CI del entorno `pre` para PRE. En `dev`, lo fijan `DB_TIPO=postgres` y las `PG_*`.
- En el servidor propio solo nginx publica puerto; el backend llega al XE por la red `sep-shared-network`, con el nombre del contenedor.
- **`MODO_MIGRACION`** en `backend/.env` cierra todas las rutas menos `/estado`: es la pausa que se usa para trasladar datos.
- **La compatibilidad con el Exadata** (ids por `RETURNING` en las tablas con trigger de GeneXus, fechas en UTC, pool con keepalive; `b86aa43`, `772df83`) solo está en la historia de `dev`. `produccion`, `sep-oracle` y `PRE` no la tienen.

---

## URLs públicas

| Hostname | Servicio | Entorno | Quién lo usa |
|---|---|---|---|
| `https://pre-sep.sena.edu.co` | App web SEP en preproducción | (b) VM del SENA, rama `PRE` | pruebas con el SENA (por VPN institucional) |

El Exadata (c) y PostgreSQL (d) no tienen URL pública.

---

## Estructura del monorepo

Árbol de `dev`. Lo marcado **(dev)** todavía no está en `produccion`.

```
SEP/                                  # raíz del repo (en el servidor: /opt/sep/SEPLocal)
├── backend/                          # NestJS API REST
│   ├── src/
│   │   ├── auth/                     # login, JWT, multirol (seleccionar/cambiar perfil), registro, recuperar clave, correo
│   │   ├── empresa/                  # datos básicos de la empresa proponente, catálogos geográficos y CIIU
│   │   ├── contactos/                # contactos de empresa
│   │   ├── necesidades/              # diagnóstico y necesidades de formación
│   │   ├── proyectos/                # módulo central — proyectos, AFs, rubros, UTs, versiones, aprobación, Excel
│   │   ├── importar-proyecto/        # importación desde el Excel del formulador (vista previa + confirmar)
│   │   ├── convocatoria-proyectos/   # proyectos guardados por convocatoria, sin importarlos (admin)
│   │   ├── convenios/                # listado, panel del convenio, beneficiarios y empresas beneficiarias
│   │   ├── personas/                 # registro/actualización de personas (HV)
│   │   ├── capacitadores/            # capacitadores naturales y jurídicos
│   │   ├── cronograma/               # cronograma presencial/virtual + radicado
│   │   ├── grupos/                   # AF·grupos, cobertura, asociar beneficiarios
│   │   ├── certificacion/            # certificación por UT y reporte de asistencia
│   │   ├── modificaciones/           # otrosíes/ajustes/prórrogas (lado conveniente)
│   │   ├── plataformas-virtuales/    # accesos a plataformas del convenio
│   │   ├── certificados/             # PDFs de certificados (PDFKit) y búsqueda pública
│   │   ├── usuarios-admin/           # usuarios internos y sus perfiles (multirol)
│   │   ├── evaluadores/              # banco de evaluadores: fichas, ciclos, documentos, certificados,
│   │   │                             #   reportes, control de cambios, «mi expediente», verificación pública
│   │   ├── retroalimentacion/        # retroalimentación 360 entre evaluadores
│   │   ├── common/
│   │   │   ├── db/                   # binds.ts, errores.ts; (dev) motor.ts, postgres-sql.ts (traductor),
│   │   │   │                         #   postgres-runner.ts, postgres-tipos.ts, tipos-entidad.ts, ids.ts, fecha-utc.ts
│   │   │   ├── documentos/           # (dev) documentos desde disco con respaldo al BLOB
│   │   │   ├── filters/              # errores de BD y de subida traducidos al usuario
│   │   │   ├── crypto/  text/        # clave heredada de GeneXus; nombres de archivo, title case
│   │   │   ├── migracion.guard.ts    # pausa global durante una migración (+ estado.controller.ts)
│   │   │   └── perfiles.ts           # (dev) ids de perfil que cambian entre bases (+ perfiles.controller.ts)
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── scripts/                      # (dev) migrar SQL a PostgreSQL, restos de Oracle, probar correo
│   ├── test/                         # e2e (jest)
│   ├── Dockerfile
│   └── .env                          # NO commitear — cada dev lo crea
├── frontend/                         # Next.js App Router
│   ├── public/images/                # logos institucionales, banners
│   └── src/
│       ├── app/
│       │   ├── (public)/             # rutas sin login
│       │   │   ├── inicio/  eventos/  certificados/
│       │   │   ├── login/{seleccionar-perfil}/
│       │   │   ├── registro/{proponente,usuario}/
│       │   │   ├── recuperar-contrasena/  restablecer-contrasena/
│       │   │   ├── verificar/[codigo]/                # versión de proyecto
│       │   │   └── verificar-certificado/[codigo]/    # certificado de evaluador
│       │   ├── (dashboard)/          # rutas con login + sidebar
│       │   │   └── panel/
│       │   │       ├── datos/  contactos/  analisis/  mi-clave/
│       │   │       ├── necesidades/[id]/{reporte}/
│       │   │       ├── proyectos/[id]/
│       │   │       │   ├── acciones/[afId]/{beneficiarios,unidades,rubros}/
│       │   │       │   └── presupuesto/  reporte/  versiones/
│       │   │       ├── convenios/[id]/                # ← ejecución del convenio
│       │   │       │   ├── directores/  capacitadores/  cronograma/
│       │   │       │   ├── beneficiarios/{registrar,empresas}/
│       │   │       │   ├── grupos/[afGrupoId]/{certificar,asistencia}/
│       │   │       │   ├── modificaciones/
│       │   │       │   └── plataformas/
│       │   │       ├── evaluadores/                   # ← banco de evaluadores
│       │   │       │   ├── [id]/  nuevo/  catalogos/
│       │   │       │   └── convocatorias/{nueva,[cid],[cid]/matriz}/
│       │   │       ├── mi-expediente/                 # el evaluador consulta y actualiza su ficha
│       │   │       ├── retroalimentacion/{formulario}/
│       │   │       └── admin/
│       │   │           ├── usuarios/{nuevo,[id]/perfiles}/
│       │   │           ├── convocatorias/  convocatoria-proyectos/  importar-proyecto/
│       │   │           ├── aprobacion/proyectos/  reportes/proyectos/
│       │   │           └── cambiar-clave/
│       │   └── layout.tsx
│       ├── components/
│       │   ├── layout/               # AppSidebar, PanelTopbar, ConvenioNav
│       │   ├── convenios/            # modales: asociar, grupos, modificación, plataforma…
│       │   ├── cronograma/           # calendario de sesiones
│       │   ├── evaluadores/          # tarjeta, filtros, ficha, trayectoria, control de cambios
│       │   ├── mi-expediente/        # pestañas perfil, hoja de vida, documentos, trayectoria
│       │   ├── convocatoria/  importar/
│       │   ├── public/               # cabecera institucional, carruseles, eventos, registro, login
│       │   ├── accessibility/  auth/ # panel de accesibilidad; cierre por inactividad
│       │   └── ui/                   # NumberInput, NoScrollNumbers, ToastBetowa, ConfirmModal…
│       └── lib/                      # api.ts (axios), auth.ts, descargar-archivo.ts, types/
├── docker/
│   ├── nginx/default.conf            # reverse proxy
│   └── desplegar.sh                  # build + recarga de nginx, con `nginx -t` antes
├── deploy/pre/                       # nginx y gate del servidor de preproducción
├── scripts/
│   ├── ci-*.sh                       # pipeline PRE: build offline, .env, despliegue, llave SSH, variables
│   ├── prepare-offline-caches.sh     # cachés pnpm + imagen node para el build sin internet
│   └── install-sep-tunnel.ps1        # túnel al XE como servicio de Windows (devs)
├── docs/
│   ├── informes/                     # documentación funcional por módulo (00-A … 30)
│   ├── evaluador/                    # diseño del banco de evaluadores y guía del gestor
│   ├── migraciones/                  # SQL de Oracle versionado v1 … v71, reversas y utilitarios
│   └── DEPLOY-PRE-CI.md              # pipeline de preproducción (rama PRE)
├── .gitlab-ci.yml                    # build:pre + deploy:pre (manual); solo corre en la rama PRE
├── docker-compose.yml
├── reload-nginx.sh                   # antiguo; usar docker/desplegar.sh
├── package.json  pnpm-workspace.yaml  pnpm-lock.yaml
├── .env.example                      # plantilla de backend/.env
└── .env.pre.example                  # plantilla del .env de PRE (sin valores reales)
```

Los respaldos con datos de personas **no** se versionan: van fuera del repo (ver `.gitignore`).

---

## Setup para desarrolladores

> La guía [`docs/informes/10-setup-desarrolladores.md`](docs/informes/10-setup-desarrolladores.md) es de abril de 2026 y solo cubre Oracle XE + cloudflared. Donde choque con esta sección, manda esta sección.

### Qué base usa cada rama

| Rama | Motor | `DB_TIPO` |
|---|---|---|
| `dev` | PostgreSQL (`sep_db`, esquema `sep`) | `postgres`, **obligatoria y en el entorno** |
| `produccion`, `sep-oracle` | Oracle | no aplica (el código no la lee) |

`DB_TIPO` decide el conector de TypeORM, los tipos de las entidades, el traductor de SQL y cómo se obtiene el id de un `INSERT`. En el código su valor por defecto sigue siendo `oracle`, pero `dev` ya no tiene camino de Oracle (`e02a0ea`): sin `DB_TIPO=postgres` no arranca.

> **`DB_TIPO` va en el entorno del proceso, no solo en `backend/.env`.** `common/db/tipos-entidad.ts` la lee al importarse, antes de que Nest cargue el `.env`. Si solo está en el `.env`, el conector sale de PostgreSQL pero las entidades se declaran con tipos de Oracle y el arranque falla con `Data type "number" ... is not supported by "postgres"`.

### Arranque en local (`dev` + PostgreSQL)

```bash
# 1. Repo y dependencias
git clone https://github.com/JoSeLoDiAz/SEP.git
cd SEP
git checkout dev && git pull
pnpm install

# 2. backend/.env — la plantilla aún no trae el bloque de PostgreSQL: añádelo a mano
cp .env.example backend/.env          # PowerShell: Copy-Item .env.example backend/.env
#    → ver «Variables de entorno». Host y credenciales de sep_db: pedir al líder.

# 3. Levantar (2 terminales)
DB_TIPO=postgres pnpm dev:backend     # PowerShell: $env:DB_TIPO='postgres'; pnpm dev:backend
pnpm dev:frontend                     # next dev --turbopack → http://localhost:3000
```

El backend queda en `http://localhost:4000` (Swagger en `/docs`). No hace falta Docker en local. Cuando arranca bien, imprime:

```
🐘 PostgreSQL <host>:<puerto>/<base>
🧭 Triggers de id: <n> tablas · perfil gestor de evaluadores: <id> (<origen>)
🚀 SEP API corriendo en puerto 4000
```

| Síntoma | Causa probable |
|---|---|
| `Data type "number" ... is not supported by "postgres"` | `DB_TIPO` solo estaba en `backend/.env`, no en el entorno |
| Aparece `🔑 ORACLE_USER` en vez de `🐘 PostgreSQL` | Falta `DB_TIPO=postgres` |
| `No se pudo resolver el perfil gestor de evaluadores` | Fijar `PERFIL_GESTOR_EVALUADORES` |
| El login da 404 en `localhost:4000/api/...` | `NEXT_PUBLIC_API_URL` con `/api` en local (el backend no tiene ese prefijo) |
| Todo responde 503 `EN_MIGRACION` | `MODO_MIGRACION` puesto en `backend/.env` |

**Código nuevo en `dev`:** los servicios escriben SQL de PostgreSQL. Para un `INSERT` con id generado se usa `insertarConId` (`backend/src/common/db/ids.ts`), sin mandar la llave.

### Contra Oracle en local

- **Desde `dev` no se puede**: el SQL de los servicios ya es de PostgreSQL y el arranque consulta `information_schema`.
- **`produccion` y `sep-oracle`** apuntan al mismo commit (`95d81d7`) y hablan con Oracle, pero **no** traen la compatibilidad con el Exadata (`b86aa43`, `772df83`), que solo está en la historia de `dev`.
- **El Exadata solo se alcanza con la VPN del SENA.** El túnel cloudflared (servicio `SEPDBTunnel`, [`scripts/install-sep-tunnel.ps1`](scripts/install-sep-tunnel.ps1)) lleva a `localhost:1521/XEPDB1`, que es el XE antiguo.

### Otros comandos

| Comando | Qué hace | Estado |
|---|---|---|
| `pnpm --filter backend test` | Jest, pruebas unitarias (sin base ni red) | 24 de 214 en rojo, ver [migración](#estado-de-la-migración-a-postgresql) |
| `pnpm --filter backend lint` | ESLint **con `--fix`**: reescribe archivos | — |
| `pnpm build` | Build de backend y frontend (`pnpm -r build`) | — |

---

## Variables de entorno

Nest carga `backend/.env` (y, si no existe, el `.env` de la raíz). Next.js lee `frontend/.env.local`. Las `NEXT_PUBLIC_*` se incrustan al compilar: cambiarlas exige volver a compilar. Los valores reales se piden al líder por canal seguro y nunca van al repo.

### `backend/.env` (dev con PostgreSQL)

```env
DB_TIPO=postgres               # además, en el entorno al arrancar (ver Setup)
PG_HOST=<pedir al líder>
PG_PORT=<pedir al líder>
PG_USER=<pedir al líder>
PG_PASSWORD=<pedir al líder>
PG_DATABASE=sep
PG_SCHEMA=sep

BACKEND_PORT=4000
NODE_ENV=development
APP_URL=http://localhost:3000

JWT_SECRET=<64 caracteres random>
JWT_EXPIRES_IN=30m
TURNSTILE_SECRET=              # vacía en local = no se verifica el captcha

SMTP_HOST=<pedir al líder>
SMTP_PORT=587
SMTP_USER=<pedir al líder>
SMTP_PASS=<pedir al líder>

# Opcionales
# DOCUMENTOS_EN_DISCO=1
# DOCUMENTOS_RUTA=<ruta al volumen de documentos>
# PERFIL_GESTOR_EVALUADORES=
```

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `DB_TIPO` | Motor: `postgres` u `oracle` (por defecto en el código: `oracle`) | Sí en `dev` |
| `PG_HOST` / `PG_PORT` | Servidor PostgreSQL (por defecto `127.0.0.1` / `5435`) | Con `postgres` |
| `PG_USER` / `PG_PASSWORD` | Credenciales de `sep_db` | Con `postgres` |
| `PG_DATABASE` / `PG_SCHEMA` | Base y esquema (por defecto `sep` / `sep`) | No |
| `ORACLE_USER` / `ORACLE_PASSWORD` / `ORACLE_CONNECT_STRING` | Conexión a Oracle (ramas Oracle y PRE) | Con `oracle` |
| `DOCUMENTOS_EN_DISCO` | Lee los documentos del volumen en vez del BLOB; si un archivo falta, vuelve al BLOB. Apagado por defecto | No |
| `DOCUMENTOS_RUTA` | Raíz del volumen: `<raíz>/<tabla>/<columna>/<id>.<ext>` | Si hay `DOCUMENTOS_EN_DISCO` |
| `PERFIL_GESTOR_EVALUADORES` | Id del perfil «Gestor de evaluadores». Sin ella se busca por nombre; si no hay exactamente uno, el backend no arranca | No |
| `BACKEND_PORT` | Puerto del API (por defecto `4000`) | No |
| `NODE_ENV` | `development` imprime el SQL en la consola | No |
| `APP_URL` | Base de los enlaces de correo y de la verificación de certificados; también entra en CORS | Sí |
| `JWT_SECRET` | Firma del JWT, 64 caracteres o más. Nunca vacía fuera de local | Sí |
| `JWT_EXPIRES_IN` | Vida del token (por defecto `30m`; sesión deslizante por `X-New-Token`) | No |
| `TURNSTILE_SECRET` | Secreto del captcha. Vacía = no se verifica (se avisa una vez en el log) | En producción |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Correo saliente. Por defecto en el código: relay del SENA, puerto 587. Prueba: `cd backend && node scripts/probar-correo.js <destino>` | Para enviar correo |
| `MODO_MIGRACION` | Pausa: cierra todo menos `/estado` (503) y oculta Swagger. Vacía = normal | No; no ponerla en local |
| `MIGRACION_LLAVE` | Durante la pausa, deja pasar las peticiones con ese valor en `X-Migracion-Llave` | No |

### `frontend/.env.local`

En local puede no existir: los valores por defecto del código sirven.

| Variable | Para qué | En local |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base del API. El backend **no** tiene prefijo `/api`: lo pone y lo quita nginx en los servidores | Sin definir (usa `http://localhost:4000`) o `http://localhost:4000`, **sin** `/api` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key pública de Turnstile; el código trae la del SEP | Sin definir |
| `NEXT_PUBLIC_CAPTCHA` | `off` quita el captcha del login (entornos sin salida a Cloudflare) y lo avisa en pantalla | Sin definir |

### Plantillas

- [`.env.example`](.env.example) se copia a `backend/.env`. **Está atrasada respecto a `dev`**: no trae `DB_TIPO`, `PG_*` ni `DOCUMENTOS_*`, y aún dice `smtp.gmail.com`.
- En PRE el `.env` lo genera el pipeline con las variables de CI/CD del entorno `pre` ([`scripts/ci-render-env.sh`](scripts/ci-render-env.sh)); la plantilla es [`.env.pre.example`](.env.pre.example).

---

## Estrategia de ramas

| Remoto | Host | Para qué |
|---|---|---|
| `origin` | github.com (`JoSeLoDiAz/SEP`) | Repositorio del equipo. Rama por defecto: `produccion` |
| `gitlab` | projecthub.sena.edu.co (GitLab institucional) | Despliegue a PRE. Solo la rama `PRE` dispara el pipeline. Se empuja con el usuario institucional |

| Rama | Remoto | Qué es |
|---|---|---|
| `dev` | origin | Integración y trabajo en curso. Hoy lleva la migración a PostgreSQL: **no se despliega** |
| `produccion` | origin | Lo estable y desplegable. Recibe `dev` cuando está listo y los arreglos hechos en PRE |
| `sep-oracle` | origin | Respaldo del último `produccion` 100 % Oracle, anterior a la migración (hoy, el mismo commit que `produccion`) |
| `PRE` | gitlab | Lo que corre en `pre-sep.sena.edu.co`. Cada push lanza el build |

```
feature/<nombre>-<descripción>      (aportes del equipo)
        │ PR
        ▼
       dev ────────────── trabajo en curso (hoy: migración a PostgreSQL)
        │ merge --no-ff «merge(dev): …»
        ▼
   produccion ◀── merge gitlab/PRE (arreglos hechos en PRE)
        │ push produccion:PRE
        ▼
   gitlab PRE ──▶ build:pre ──▶ deploy:pre (manual) ──▶ pre-sep.sena.edu.co
```

**Reglas:**
- ❌ Nadie hace push directo a `produccion`. Solo Josse mergea a `produccion` y empuja a `PRE`.
- ✅ Antes de empujar a `PRE`, `produccion` tiene que contener `gitlab/PRE`; si no, el push no es fast-forward y GitLab lo rechaza. Cada cambio de `produccion` se trae después a `dev`.
- ✅ `dev` no va a PRE mientras dure la migración: el pipeline arma el `.env` con `ORACLE_*` y `dev` trae dependencias (`pg`) que la caché offline no tiene.

**Convenciones de mensaje:** `tipo(ámbito): frase que dice qué cambia`, en español; el cuerpo explica el porqué. Ejemplo: `fix(ci): el build offline no le pasaba NEXT_PUBLIC_CAPTCHA al contenedor`.

| Tipo | Uso |
|---|---|
| `feat` | funcionalidad nueva |
| `fix` | corrección de bug |
| `refactor` | reestructurar sin cambiar comportamiento |
| `docs` | documentación e informes |
| `style` | formato, CSS, textos de pantalla |
| `chore` | configuración, dependencias, mantenimiento |
| `revert` | deshacer un commit anterior |
| `merge(dev)` | merge `--no-ff` de `dev` a `produccion`, con el resumen de lo que entra |

---

## Despliegue

| Entorno | URL | Cómo | Quién |
|---|---|---|---|
| PRE (SENA) | `https://pre-sep.sena.edu.co` | pipeline del GitLab institucional sobre la rama `PRE` | Josse |

### PRE — GitLab institucional

> Detalle (runner, cachés offline, sincronizar variables): [`docs/DEPLOY-PRE-CI.md`](docs/DEPLOY-PRE-CI.md)

```bash
# 1. produccion al día con lo que ya está en PRE
git checkout produccion
git pull origin produccion
git fetch gitlab
git merge gitlab/PRE

# 2. Publicar
git push origin produccion
git push gitlab produccion:PRE      # lanza build:pre

# 3. En GitLab → CI/CD → Pipelines → ejecutar deploy:pre (manual)

# 4. De vuelta a dev
git checkout dev
git merge produccion
```

| Job | Disparo | Qué hace |
|---|---|---|
| `build:pre` | cada push a `PRE` | Build **offline** (`scripts/ci-build-offline.sh`): Next standalone + Nest dist dentro de Podman, `pnpm install --offline` desde la caché del runner |
| `deploy:pre` | manual | Arma el `.env` con las variables de CI (`scripts/ci-render-env.sh`), publica frontend y backend y recrea sus contenedores |

Variables de CI/CD del entorno `pre` (solo nombres; los valores están en GitLab):

| Tipo | Variables |
|---|---|
| Obligatorias | `BACKEND_PORT`, `FRONTEND_PORT`, `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING`, `JWT_SECRET`, `APP_URL` |
| Con valor por defecto | `NODE_ENV`, `TZ`, `JWT_EXPIRES_IN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `TURNSTILE_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| De build | `NEXT_PUBLIC_CAPTCHA` (`off` en PRE: la red no llega a Cloudflare) |
| Acceso | `DEPLOY_SSH_PRIVATE_KEY` (tipo File) |

**Cuidados:**
- Las variables del pipeline suben como *protected*: la rama `PRE` tiene que estar protegida o llegan vacías.
- Las `NEXT_PUBLIC_*` se hornean al compilar: si cambian, hace falta un `build:pre` nuevo; repetir `deploy:pre` no basta.
- `NEXT_PUBLIC_CAPTCHA` solo la pasa al build el `ci-build-offline.sh` de `gitlab/PRE` (`e858190`); por eso el paso 1 trae `gitlab/PRE` a `produccion` antes de empujar.
- El runner no tiene salida a internet. Si cambia `pnpm-lock.yaml`, antes de empujar hay que volver a sembrar la caché con `scripts/prepare-offline-caches.sh` desde un equipo con red.

### Servidor propio (`sep.ggpcsena.com`)

> Guía: [`docs/informes/11-setup-server-multi-dev.md`](docs/informes/11-setup-server-multi-dev.md) (abril 2026).

```bash
ssh sepadmin@ssh.ggpcsena.com
cd /opt/sep/SEPLocal
git checkout produccion
git pull
./docker/desplegar.sh
```

| Orden | Qué hace |
|---|---|
| `./docker/desplegar.sh` | Reconstruye backend y frontend, espera a que responda `/health` y recarga nginx (valida con `nginx -t` antes) |
| `./docker/desplegar.sh nginx` | Solo valida y recarga nginx |
| `./docker/desplegar.sh estado` | Qué contenedores están arriba y desde cuándo |
| `./docker/desplegar.sh logs` | Sigue los logs del backend |

- No basta con `docker compose up -d --build`: nginx se queda con la IP vieja de los contenedores y el sitio da 502 aunque `docker compose ps` diga «Up».
- La VM no llega a `registry.npmjs.org`: si cambian las dependencias, el build falla. El script lo avisa antes de empezar.

---

## Roles de base de datos

### Oracle — producción

| Usuario | Base | Permisos | Quién lo usa |
|---|---|---|---|
| `SEPLOCAL` | XE | Dueño del esquema: todo, DDL incluido | Solo Josse, migraciones v1–v68 |
| `SEP_APP` | XE | `SELECT/INSERT/UPDATE/DELETE` sin DDL, por sinónimos a `SEPLOCAL`. Un logon trigger lo rechaza fuera de Node; sesiones auditadas | `ORACLE_USER` del backend |
| `SEP_LECTOR` | XE | Solo `SELECT`, con sinónimos | SQL Developer de cada dev |
| `SYSTEM` | XE | DBA del PDB | Solo Josse, mantenimiento |

- **Excepciones de `SEP_APP`:** `EVALUADORLOG` solo tiene `SELECT, INSERT` (v35), para que el log sea inmutable, y `EVALUADORCERTIFICADO` no tiene `DELETE` (v37). El código cuenta con las dos.
- **Tablas nuevas en el XE:** cada una lleva su `GRANT` (tabla y secuencia a `SEP_APP`, `SELECT` a `SEP_LECTOR`). Sin él, el backend no la ve.
- **Exadata:** v69–v71 crean las tablas, columnas y llaves del SEP, sin `GRANT` ni sinónimos; el backend busca las tablas en el esquema de su sesión. En el repo no hay equivalentes de `SEP_APP` / `SEP_LECTOR` para el Exadata.

> **Contraseñas:** no se comparten en el repo. Pídeselas a Josse por canal seguro (Bitwarden o pendrive; nunca por Slack ni por email).

### PostgreSQL — migración (`dev`)

- Conexión por `DB_TIPO` + `PG_*` (ver [Variables de entorno](#variables-de-entorno)). Las tablas están en minúscula y el SQL crudo en MAYÚSCULA sigue valiendo sin comillas.
- **Pendiente:** no hay en el repo ningún script de roles de PostgreSQL. Falta el equivalente de `SEP_APP` (DML sin DDL) y de `SEP_LECTOR` (solo lectura para devs). El rol del backend necesita permiso sobre las secuencias: 166 tablas toman el id de un `nextval` por defecto.

### Scripts

| Script | Base | Qué hace |
|---|---|---|
| [`v9_usuario_lector_devs.sql`](docs/migraciones/v9_usuario_lector_devs.sql) | XE | Crea `SEP_LECTOR` |
| [`v10_usuario_sep_app.sql`](docs/migraciones/v10_usuario_sep_app.sql) | XE | Crea `SEP_APP` con logon trigger y auditoría |
| [`v19_usuario_perfil_multirol.sql`](docs/migraciones/v19_usuario_perfil_multirol.sql) | XE | Tabla `USUARIOPERFIL` (multirol) |
| [`v69_tablas_sep_en_exadata.sql`](docs/migraciones/v69_tablas_sep_en_exadata.sql) (+ `_REVERSA`, `_COMPROBACION`) | Exadata | 39 tablas y 26 secuencias del SEP |
| [`v70_columnas_sep_en_exadata.sql`](docs/migraciones/v70_columnas_sep_en_exadata.sql) | Exadata | 24 columnas en 11 tablas |
| [`v71_llaves_externas_sep.sql`](docs/migraciones/v71_llaves_externas_sep.sql) | Exadata | 9 llaves externas (solo en `dev`) |
| [`backend/scripts/`](backend/scripts/) | PostgreSQL | `migrar-sql-a-postgres.ts`, `migrar-sql-pruebas.ts`, `restos-oracle.ts` |

Las herramientas de carga de datos y el mapa de ids están fuera del repo, junto a los respaldos.

---

## Estado de la migración a PostgreSQL

> **Solo en `dev`** (desde `07761d9`, 17 sep 2026). `produccion` y PRE siguen en Oracle y no tienen nada de esto.

GeneXus se da de baja y el SEP deja Oracle por PostgreSQL. Los datos ya están cargados en `sep_db` (PostgreSQL 17, esquema `sep`, 220 tablas verificadas contra el Exadata) y los documentos tienen su propio volumen. Lo que falta es terminar la aplicación.

### Hecho

| Pieza | Dónde | Qué hace |
|---|---|---|
| Conector conmutable | `backend/src/app.module.ts` | `DB_TIPO=postgres` conecta con las `PG_*` |
| Traductor de SQL | `common/db/postgres-sql.ts`, `postgres-runner.ts` | En un solo punto (el ejecutor de consultas): `:n`→`$n`, `NVL`→`COALESCE`, hora UTC, `ROWNUM`→`LIMIT` cuando es seguro, columnas de vuelta en MAYÚSCULA |
| Números | `common/db/postgres-tipos.ts` | `bigint` y `numeric` llegan como número, igual que con oracledb |
| Entidades TypeORM | `common/db/tipos-entidad.ts` | Tipo y nombre de tabla según `DB_TIPO` |
| SQL de los servicios | `12f931d` | 33 servicios reescritos en SQL de PostgreSQL con `scripts/migrar-sql-a-postgres.ts` |
| Ids | `common/db/ids.ts` (`e02a0ea`) | Un solo camino: la llave la pone el `DEFAULT nextval(...)` y vuelve por `RETURNING` |
| Documentos | `common/documentos/documentos-disco.ts` | Con `DOCUMENTOS_EN_DISCO` se leen del volumen; si falta el archivo, del BLOB |

**Probado de punta a punta contra PostgreSQL: solo el flujo público de certificados** (búsqueda por cédula y PDF). Los demás módulos no se han recorrido.

### Pendiente

| Qué | Estado al 21 sep 2026 |
|---|---|
| Pruebas del backend | **24 de 214 en rojo** (11 de 22 suites). Todas esperan el SQL de Oracle —llave en `NULL`, `RETURNING ... INTO`, binds `:n`— y hay que reescribirlas |
| Consultas con criterio | 20 de 1.103 según `scripts/restos-oracle.ts`: 8 `TO_DATE`, 8 `TO_CHAR` con máscara, 2 `GREATEST`, 2 `RETURNING ... INTO`, 1 `NVL2`, 1 `LISTAGG` |
| Lo que ese contador no ve | 36 sentencias `SELECT X_SEQ.NEXTVAL` que quedaron sin `FROM` al migrar (evaluadores, retroalimentación, usuarios-admin, auth, importar-proyecto, convocatoria-proyectos). El traductor no convierte `NEXTVAL`, así que fallan en PostgreSQL |
| Binds de oracledb | 8 archivos usan binds propios de `oracledb`: BLOB/NCLOB al subir documentos, `BIND_OUT`, `conn.execute` con `fetchInfo`. El conector `pg` no los entiende |
| Mensajes de error | `common/db/errores.ts`, `auth` y `evaluadores` reconocen códigos `ORA-`; con PostgreSQL esos errores salen sin traducir |
| Retirar Oracle | Ramas duales en `app.module.ts`, `main.ts`, `motor.ts` y `tipos-entidad.ts`; `oracledb` sigue en `backend/package.json` junto a `pg` |
| Configuración | `.env.example`, `docker-compose.yml` y los guiones de CI no conocen `DB_TIPO`, `PG_*` ni `DOCUMENTOS_*` |
| Documentos nuevos | Antes del cambio definitivo hay que volver a extraer a disco los documentos subidos a Oracle después de la carga |

### Cómo probarlo en local

```bash
# 1. Acceso a sep_db (túnel o red; host, puerto y credenciales: pedir al líder)

# 2. Backend contra PostgreSQL — DB_TIPO en el entorno, no solo en backend/.env
cd backend
DB_TIPO=postgres pnpm run start:dev
#    PowerShell: $env:DB_TIPO='postgres'; pnpm run start:dev

# 3. Medir lo que queda y correr las pruebas (ninguna de las dos toca la base)
pnpm exec ts-node scripts/restos-oracle.ts     # sus compilados quedan ignorados por .gitignore
pnpm test
```

---

## Pendientes externos

| Qué | Estado |
|---|---|
| Correo por el relay del SENA | La configuración está bien; falla la salida de red desde PRE. Solicitud pendiente con el SENA |
| Commit desplegado contra el Exadata | `produccion` y `PRE` no incluyen la compatibilidad con el Exadata (`b86aa43`, `772df83`). Confirmar qué corre y contra qué base |

---

## Documentación detallada

Los informes por módulo están en [`docs/informes/`](docs/informes/):

| Documento | Contenido |
|---|---|
| [`00-A-contexto-proyecto.md`](docs/informes/00-A-contexto-proyecto.md) | Contexto general del SEP y GGPC |
| [`00-B-servidor-ubuntu.md`](docs/informes/00-B-servidor-ubuntu.md) | Setup base del servidor Ubuntu |
| [`01-login.md`](docs/informes/01-login.md) | Módulo de autenticación |
| [`02-inicio-publico.md`](docs/informes/02-inicio-publico.md) | Landing pública |
| [`03-certificados.md`](docs/informes/03-certificados.md) | Generación de certificados PDF |
| [`04-eventos.md`](docs/informes/04-eventos.md) | Inscripción a eventos |
| [`05-inicio-empresa-panel.md`](docs/informes/05-inicio-empresa-panel.md) | Dashboard empresa |
| [`06-datos-basicos-empresa.md`](docs/informes/06-datos-basicos-empresa.md) | Datos básicos / contactos |
| [`07-control-versiones-git.md`](docs/informes/07-control-versiones-git.md) | Convenciones Git |
| [`08-registro-proponente.md`](docs/informes/08-registro-proponente.md) | Registro de proponente |
| [`09-registro-usuario-persona.md`](docs/informes/09-registro-usuario-persona.md) | Registro de persona |
| [`10-setup-desarrolladores.md`](docs/informes/10-setup-desarrolladores.md) | Guía para devs nuevos (abril 2026: XE + cloudflared) |
| [`11-setup-server-multi-dev.md`](docs/informes/11-setup-server-multi-dev.md) | Guía del lado server (abril 2026: XE + cloudflared) |
| [`12-contactos.md`](docs/informes/12-contactos.md) | Contactos de empresa |
| [`13-analisis-empresarial.md`](docs/informes/13-analisis-empresarial.md) | Análisis empresarial / gremial |
| [`14-diagnostico-necesidades.md`](docs/informes/14-diagnostico-necesidades.md) | Diagnóstico de necesidades |
| [`15-listado-proyectos.md`](docs/informes/15-listado-proyectos.md) | Listado de proyectos |
| [`16-crear-proyecto.md`](docs/informes/16-crear-proyecto.md) | Creación de proyecto |
| [`17-gestionar-proyecto.md`](docs/informes/17-gestionar-proyecto.md) | Gestión del proyecto |
| [`18-acciones-formacion.md`](docs/informes/18-acciones-formacion.md) | Acciones de formación |
| [`19-formular-accion-formacion.md`](docs/informes/19-formular-accion-formacion.md) | Formular acción de formación |
| [`20-rubros-accion-formacion.md`](docs/informes/20-rubros-accion-formacion.md) | Rubros por AF |
| [`21-versiones-proyecto.md`](docs/informes/21-versiones-proyecto.md) | Versiones del proyecto |
| [`22-descargar-proyecto.md`](docs/informes/22-descargar-proyecto.md) | Descargar proyecto en Excel |
| [`23-aprobacion-proyectos.md`](docs/informes/23-aprobacion-proyectos.md) | Aprobación y publicación de resultados |
| [`24-convenios-vista-general.md`](docs/informes/24-convenios-vista-general.md) | **Convenios — vista general y panel del convenio** |
| [`25-directores-capacitadores-convenio.md`](docs/informes/25-directores-capacitadores-convenio.md) | **Directores y capacitadores del convenio** |
| [`26-cronograma-convenio.md`](docs/informes/26-cronograma-convenio.md) | **Cronograma del convenio** |
| [`27-beneficiarios-convenio.md`](docs/informes/27-beneficiarios-convenio.md) | **Beneficiarios del convenio** |
| [`28-grupos-certificacion-asistencia.md`](docs/informes/28-grupos-certificacion-asistencia.md) | **AF·Grupos, certificación y reporte de asistencia** |
| [`29-modificaciones-plataformas-virtuales.md`](docs/informes/29-modificaciones-plataformas-virtuales.md) | **Modificaciones y plataformas virtuales del convenio** |
| [`30-banco-evaluadores.md`](docs/informes/30-banco-evaluadores.md) | **Banco de Evaluadores y retroalimentación 360** |

### Otras carpetas de documentación

| Ruta | Contenido |
|---|---|
| [`docs/evaluador/`](docs/evaluador/) | Diseño del Banco de Evaluadores: propuesta del módulo y del multirol (00), ajustes por hallazgos (01), panel por año (02) y la Guía del Gestor de Evaluadores |
| [`docs/migraciones/`](docs/migraciones/) | SQL de Oracle versionado, v1 a v71, con sus `REVERSA` y `COMPROBACION`, más utilitarios de diagnóstico y limpieza |
| [`docs/DEPLOY-PRE-CI.md`](docs/DEPLOY-PRE-CI.md) | Despliegue a preproducción: rama `PRE`, jobs `build:pre` / `deploy:pre`, build offline |

---

## Equipo

| Rol | Nombre | Responsabilidad |
|---|---|---|
| Josse Díaz (`josediazd40z@gmail.com`) | Arquitectura, infra, deploys, code review, BD |
| Desarrolladora | Rosa | Features asignadas |
| Desarrollador | Jhonatan | Features asignadas |
| Desarrollador | Javier | Features asignadas |
| Desarrollador | Julio | Features asignadas |
| Desarrolladora | Juliana | Features asignadas |

---

## Funcionalidades implementadas

> Todo lo de esta sección está en `produccion`, salvo el último apartado, que solo está en `dev`.

### Portal público y acceso
- ✅ Portal institucional: cabecera, barra GOV.CO y pie con el diseño de sena.edu.co; carrusel en el inicio y en el login
- ✅ Inscripción pública a eventos
- ✅ Certificados: búsqueda por documento o por código; una sola consulta trae los de beneficiario y los de evaluador
- ✅ Verificación sin sesión: proyecto por código de versión (`/verificar`) y certificado de evaluador (`/verificar-certificado/<código>`)
- ✅ Registro de proponente y de persona; recuperación y restablecimiento de contraseña
- ✅ Captcha apagable (`NEXT_PUBLIC_CAPTCHA=off`) para redes sin salida a Cloudflare; la contraseña se verifica siempre
- ✅ Pausa por migración (`MODO_MIGRACION`): el login explica el motivo

### Usuarios y multirol
- ✅ Tabla `USUARIOPERFIL` (v19): un usuario con varios perfiles, uno predeterminado
- ✅ Con dos o más perfiles, el login pide elegir; si no se elige, a los 10 s entra con el predeterminado
- ✅ Cambio de perfil sin cerrar sesión, desde la barra superior
- ✅ Administración de usuarios: crear, activar/inactivar, restablecer clave y asignar perfiles
- ✅ Cada usuario cambia su contraseña en `/panel/mi-clave` (máximo 16 caracteres, por el cifrado heredado)

### Formulación (etapa propuesta)
- ✅ Multi-tenant: empresas, contactos, datos básicos
- ✅ Análisis empresarial y necesidades de formación
- ✅ Proyectos: generalidades, articulación, alineación
- ✅ Acciones de Formación: grupos, beneficiarios, sectores, niveles ocupacionales, CUOC, áreas funcionales
- ✅ Unidades Temáticas con perfiles de capacitador
- ✅ **Rubros AF** con prerrequisitos (grupos, UTs, horas), GO, Transferencia
- ✅ Validaciones por campo (presencial / híbrida / virtual)
- ✅ Eliminación en cascada de AF (sectores, UTs, grupos, coberturas)
- ✅ Versiones del proyecto con una sola FINAL que lo congela; descarga en Excel desde ese snapshot
- ✅ Aprobación SENA en una sola transacción, con el hash de la versión
- ✅ Importación masiva desde el Excel del formulador, con vista previa imprimible antes de importar

### Proyectos de convocatoria (administración)
- ✅ Guarda en la convocatoria el proyecto leído del Excel del formulador, sin importarlo
- ✅ Dashboard de entregas; analítica de cofinanciación por evento, modalidad y proponente; cobertura por departamento y ciudad
- ✅ Reporte consolidado imprimible y sábana Excel que respeta los filtros

### Convenios — ejecución
- ✅ Listado de convenios con estados y panel principal por convenio
- ✅ **Directores** del proyecto: registro, validación de interventoría, historial
- ✅ **Capacitadores** naturales y jurídicos con sus HV y empresas capacitadoras
- ✅ **Cronograma** presencial/virtual con calendario, modalidades 1/2/3 (presencial) y 4 (virtual), radicación por cortes
- ✅ **Beneficiarios**: registro (Habeas Data), empresa beneficiaria en línea, asociación rápida a grupos, activos/inactivos, validación del 5 % de repetidos por AF
- ✅ **AF·Grupos**: cupos vs. registrados vs. certificados, cobertura geográfica, un grupo por AF
- ✅ **Certificación** por UT: beneficiario × sesión, certificación masiva, CERTIFICA = SI con ≥ 80 % de las horas
- ✅ **Reporte de Asistencia** en Excel con el formato F2.x/F3.1 heredado
- ✅ **Modificaciones** del convenio (otrosíes, ajustes, prórrogas), con bloqueo cuando interventoría o el SENA ya respondieron
- ✅ **Plataformas Virtuales**: accesos con clave oculta y botón de copiar
- ✅ Validación transversal «convenio en ejecución» (CONVENIOSESTADO = 1) en todas las escrituras

### Banco de Evaluadores y retroalimentación 360

> Implementado y en pruebas. Detalle en [`30-banco-evaluadores.md`](docs/informes/30-banco-evaluadores.md).

- ✅ **Banco** (`/panel/evaluadores`): tarjetas con foto, métricas que filtran (sin cédula, sin foto, sin prueba vigente), filtros en la URL, exportación a Excel
- ✅ **Registro** que busca a la persona por documento antes de crearla y no sobrescribe lo que el SEP ya tenía
- ✅ **Ficha** por pestañas: trayectoria año por año, perfil, documentos y control de cambios; ficha en PDF
- ✅ **Ciclo anual** sobre una convocatoria: rol, área, proceso, autorización del jefe, curso, prueba, proyectos y grupos
- ✅ **Prueba de conocimiento** aprobada por porcentaje; el recorrido toma la mejor del año
- ✅ **Certificado de participación** emitido por el sistema, individual o por lote, con consecutivo anual, código de verificación y firma congelada; se anula con motivo
- ✅ **Control de cambios** inmutable: cada operación con su estado antes y después
- ✅ **Portal del evaluador** (`/panel/mi-expediente`): mantiene su expediente y descarga ficha y certificados
- ✅ **Retroalimentación 360** por convocatoria: matriz del ciclo, alertas, avance por persona, Excel, histórico y calificación del dinamizador

### Plataforma
- ✅ `NumberInput` con separadores de miles y bloqueo de scroll
- ✅ Recarga parcial de secciones (no resetea el formulario)
- ✅ `ToastBetowa` y `ConfirmModal` reutilizables
- ✅ Tope único de 8 MB por archivo, validado en el backend
- ✅ Las fechas de calendario se tratan aparte de los timestamps: ya no se corren un día
- ✅ Exportes Excel comprimidos (SheetJS / ExcelJS)

### En `dev`, pendiente de pasar a `produccion`

| Cambio | Commits |
|---|---|
| Compatibilidad con el Exadata: ids con `RETURNING` en las tablas con trigger, fechas en UTC, perfil gestor resuelto al arrancar (`PERFIL_GESTOR_EVALUADORES`, `GET /perfiles/claves`) | `b86aa43` |
| Pool de Oracle con keepalive para la VPN del Exadata | `772df83` |
| Migración v71: las 9 llaves externas del SEP en el Exadata | `e7b72b2` |
| `fechaSolo` rechaza años fuera de 1000–9999 | `7cc15c3` |
| Migración a PostgreSQL, **en curso** (ver [estado](#estado-de-la-migración-a-postgresql)) | `07761d9` … `e02a0ea` |

---

## Licencia

Software propietario — GGPC SENA / DSNFT. Uso interno autorizado.
