# SEP — Sistema Especializado de Proyectos

Plataforma empresarial de gestión de proyectos para el **GGPC — SENA / DSNFT**, construida sobre un stack moderno y desplegada en producción en `https://sep.ggpcsena.com`.

> **Última actualización:** 26 abril 2026

---

## Índice

- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [URLs públicas](#urls-públicas)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Setup para desarrolladores](#setup-para-desarrolladores)
- [Estrategia de ramas](#estrategia-de-ramas)
- [Roles de base de datos](#roles-de-base-de-datos)
- [Despliegue a producción](#despliegue-a-producción)
- [Documentación detallada](#documentación-detallada)
- [Equipo](#equipo)

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | 15.x |
| Estilos / UI | Tailwind CSS + lucide-react | 3.4 / 0.x |
| Estado | TanStack Query / hooks nativos | 5.x |
| Backend | NestJS + TypeORM (queries crudos vía DataSource) | 11.x |
| Base de datos | Oracle Database 21c XE (`gvenzl/oracle-xe:21-slim`) | 21c |
| Proxy | Nginx | stable-alpine |
| Runtime | Node.js | 22 LTS |
| Contenedores | Docker + Compose | — |
| Gestor pkgs | pnpm (workspaces) | latest |
| Túnel público | Cloudflare Tunnel (HTTP + SSH + TCP) | — |
| Email | Nodemailer + SMTP Gmail | — |
| PDFs | PDFKit | — |
| Auth | JWT (Passport) | — |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  SERVIDOR (Hyper-V VM Ubuntu — i7-14700, 32 GB)              │
│  ───────────────────────────────────────────────             │
│  • Oracle XE        :1521  (DB centralizada)                  │
│  • Docker stack PROD                                         │
│      ├── nginx     :8080 → 80                                 │
│      ├── frontend  :3000  (Next.js standalone)                │
│      └── backend   :4000  (NestJS)                            │
│  • cloudflared     (expone HTTP + SSH + TCP)                  │
└─────────────────────────────────────────────────────────────┘
       ▲                ▲                       ▲
       │                │                       │
sep.ggpcsena.com   ssh.ggpcsena.com    sepdb.ggpcsena.com
(usuarios finales) (admin)             (devs vía cloudflared
                                        access tcp en local)
       │                │                       │
       │                │                       ├─ Josse (admin)
       │                │                       ├─ Rosa
       │                │                       ├─ Jhonatan
       │                │                       ├─ Javier
       │                │                       ├─ Julio
       │                │                       └─ Juliana
```

Cada desarrollador trabaja en **modo dev** (`pnpm dev`) en su PC local con hot-reload. Solo el líder técnico hace `docker compose up --build` en el servidor para desplegar a producción.

---

## URLs públicas

| Hostname | Servicio | Quién lo usa |
|---|---|---|
| `https://sep.ggpcsena.com` | App web SEP en producción | usuarios finales (empresas, SENA) |
| `ssh.ggpcsena.com:22` | SSH al servidor | admin |
| `sepdb.ggpcsena.com:1521` | Oracle DB (TCP vía Cloudflare Tunnel) | desarrolladores en local |

---

## Estructura del monorepo

```
SEPLocal/
├── backend/                          # NestJS API REST
│   ├── src/
│   │   ├── auth/                     # login, JWT, recuperación de contraseña
│   │   ├── empresa/                  # gestión de empresas proponentes
│   │   ├── contactos/                # contactos de empresa
│   │   ├── necesidades/              # necesidades de formación
│   │   ├── proyectos/                # módulo central — proyectos, AFs, rubros, UTs
│   │   ├── certificados/             # generación de PDFs (PDFKit)
│   │   └── main.ts
│   ├── package.json
│   └── .env                          # NO commitear — cada dev lo crea
├── frontend/                         # Next.js App Router
│   └── src/
│       ├── app/
│       │   ├── (public)/             # rutas sin login
│       │   ├── (dashboard)/          # rutas con login + sidebar
│       │   │   └── panel/
│       │   │       ├── proyectos/[id]/
│       │   │       │   ├── acciones/
│       │   │       │   │   └── [afId]/
│       │   │       │   │       ├── beneficiarios/
│       │   │       │   │       ├── unidades/
│       │   │       │   │       └── rubros/        # ← nuevo
│       │   │       ├── necesidades/
│       │   │       ├── datos/
│       │   │       └── ...
│       │   ├── login/
│       │   └── layout.tsx
│       ├── components/
│       │   ├── layout/               # AppSidebar, PanelTopbar
│       │   ├── public/               # registro empresa, eventos, login
│       │   └── ui/                   # NumberInput, NoScrollNumbers, ToastBetowa…
│       └── lib/                      # api.ts (axios), auth.ts
├── docker/
│   └── nginx/default.conf            # reverse proxy
├── docs/
│   ├── informes/                     # documentación funcional por módulo
│   │   ├── 00-A-contexto-proyecto.md
│   │   ├── 00-B-servidor-ubuntu.md
│   │   ├── 01-login.md … 09-…
│   │   ├── 10-setup-desarrolladores.md   # ← guía dev local
│   │   └── 11-setup-server-multi-dev.md  # ← guía admin del server
│   └── migraciones/                  # scripts SQL versionados
│       ├── v1_… v8_convocatoria10_rubros.sql
│       └── v9_usuario_lector_devs.sql    # ← SEP_LECTOR
├── docker-compose.yml
├── reload-nginx.sh
├── pnpm-workspace.yaml
└── .env.example
```

---

## Setup para desarrolladores

> **Lectura completa:** [`docs/informes/10-setup-desarrolladores.md`](docs/informes/10-setup-desarrolladores.md)

Resumen ultra-corto para devs ya configurados:

```bash
# 1. Asegúrate de que el túnel a la DB esté arriba
schtasks /Run /TN "SEP DB Tunnel"
Test-NetConnection -ComputerName 127.0.0.1 -Port 1521

# 2. Clona / actualiza el repo
git clone https://github.com/JoSeLoDiAz/SEP.git
cd SEP
git checkout dev
git pull
pnpm install

# 3. Crea backend/.env (pídele las claves al líder)
cp .env.example backend/.env

# 4. Levanta dev (2 terminales)
pnpm --filter backend run start:dev      # → http://localhost:4000
pnpm --filter frontend dev               # → http://localhost:3000
```

Cualquier cambio en código se ve en el navegador en ~200 ms. **No requiere Docker en local.**

---

## Estrategia de ramas

```
produccion ◀── (merge solo por Josse, despliega a sep.ggpcsena.com)
    ↑
   dev      ◀── (rama integradora del equipo, recibe los PRs de features)
    ↑
feature/<nombre-dev>-<descripción>  ◀── (cada dev en su rama personal)
```

**Reglas:**
- ❌ Nadie hace push directo a `produccion` ni `dev` (branch protection).
- ✅ Cada dev abre PR de su rama → `dev`. Josse revisa y mergea.
- ✅ Cuando `dev` está estable, Josse mergea `dev` → `produccion`.
- ✅ Solo Josse tiene rol `Admin` en GitHub; los demás son `Write`.

**Convenciones de mensaje:**
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `refactor:` reestructurar sin cambiar comportamiento
- `docs:` documentación
- `style:` formato / CSS
- `chore:` configs, deps, mantenimiento

---

## Roles de base de datos

| Usuario | Permisos | Quién lo usa |
|---|---|---|
| `SEPLOCAL` | Owner del schema — INSERT/UPDATE/DELETE/SELECT/DDL | Backend de cada dev en `.env` (la app necesita escribir) |
| `SEP_LECTOR` | Solo `SELECT` (180 tablas + sinónimos) | SQL Developer de cada dev (consulta segura) |
| `SYSTEM` | DBA del PDB | Solo Josse para tareas de mantenimiento |

> **Contraseñas:** no se comparten en el repo. Pídeselas a Josse por canal seguro (Bitwarden / pendrive — nunca por Slack ni email).
>
> **Importante:** los devs nunca usan `SEPLOCAL` en SQL Developer — solo en su `.env` del backend. Para consultar datos a mano usan `SEP_LECTOR`. Si intentan `DELETE` con `SEP_LECTOR` reciben `ORA-01031: insufficient privileges`.

Script de creación: [`docs/migraciones/v9_usuario_lector_devs.sql`](docs/migraciones/v9_usuario_lector_devs.sql)

---

## Despliegue a producción

> **Solo Josse.** Lectura completa: [`docs/informes/11-setup-server-multi-dev.md`](docs/informes/11-setup-server-multi-dev.md)

```bash
# 1. Mergea dev → produccion en local
git checkout produccion
git pull
git merge dev
git push origin produccion

# 2. Conéctate al server (VM Hyper-V Ubuntu)
ssh sepadmin@ssh.ggpcsena.com
cd /opt/sep/SEPLocal

# 3. Pull y deploy
git pull
docker compose up -d --build && bash reload-nginx.sh
```

⏱️ **Tiempo de build cached + deploy:** ~12 segundos en el servidor (Hyper-V + VT-x nativo).

---

## Variables de entorno requeridas (`backend/.env`)

```env
BACKEND_PORT=4000
NODE_ENV=development

ORACLE_USER=SEPLOCAL
ORACLE_PASSWORD=<pedir al líder>
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1   # vía cloudflared en local

JWT_SECRET=<64 caracteres random>
JWT_EXPIRES_IN=8h

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<correo>
SMTP_PASS=<app password>

APP_URL=http://localhost:3000   # en producción: https://sep.ggpcsena.com
```

Plantilla completa: [`.env.example`](.env.example)

---

## Documentación detallada

Toda la documentación funcional está en [`docs/informes/`](docs/informes/):

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
| [`10-setup-desarrolladores.md`](docs/informes/10-setup-desarrolladores.md) | **Guía completa para devs nuevos** |
| [`11-setup-server-multi-dev.md`](docs/informes/11-setup-server-multi-dev.md) | **Guía del lado server (admin)** |

---

## Equipo

| Rol | Nombre | Responsabilidad |
|---|---|---|
| **Líder técnico / Admin** | Josse Díaz (`josediazd40z@gmail.com`) | Arquitectura, infra, deploys, code review, BD |
| Desarrolladora | Rosa | Features asignadas |
| Desarrollador | Jhonatan | Features asignadas |
| Desarrollador | Javier | Features asignadas |
| Desarrollador | Julio | Features asignadas |
| Desarrolladora | Juliana | Features asignadas |

---

## Funcionalidades implementadas (highlights recientes)

- ✅ Multi-tenant: empresas, contactos, datos básicos
- ✅ Inscripción pública a eventos + certificados PDF
- ✅ Necesidades de formación
- ✅ Proyectos: generalidades, articulación, alineación
- ✅ Acciones de Formación: detalle completo con grupos, beneficiarios, sectores, niveles ocupacionales, CUOC, áreas funcionales
- ✅ Unidades Temáticas con perfiles de capacitador
- ✅ **Rubros AF** con prereqs (grupos, UTs, horas), GO, Transferencia
- ✅ Validaciones por campo (presencial / híbrida / virtual)
- ✅ Eliminación en cascada de AF (sectores, UTs, grupos, coberturas)
- ✅ NumberInput con separadores de miles y bloqueo de scroll
- ✅ Recarga parcial de secciones (no resetea formulario)
- ✅ Setup multi-dev con DB centralizada y permisos diferenciados

---

## Licencia

Software propietario — GGPC SENA / DSNFT. Uso interno autorizado.
