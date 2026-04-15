# Informe de Desarrollo — Control de Versiones con Git
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Repositorio activo y al día

---

## 1. Descripción General

El proyecto nuevo SEP utiliza **Git** como sistema de control de versiones y **GitHub** como plataforma de alojamiento del repositorio remoto. Todo el código fuente —backend, frontend, infraestructura, configuración y documentación— vive en un único repositorio monorepo gestionado con **pnpm workspaces**.

Esto representa un cambio fundamental frente al sistema GeneXus anterior, donde el código generado automáticamente no tenía control de versiones estándar, no era auditable y no permitía trabajo colaborativo estructurado.

---

## 2. Repositorio

| Parámetro | Valor |
|---|---|
| Plataforma | GitHub |
| Repositorio | `github.com/JoSeLoDiAz/SEP` |
| Rama principal | `main` |
| Visibilidad | Privado |
| Autor | JoSeLoDiAz |
| Protocolo push | SSH (`git@github.com:...`) |

---

## 3. Estructura del Monorepo

El repositorio aloja el sistema completo en un único lugar:

```
SEPLocal/                        ← Raíz del repositorio
├── .gitignore                   ← Exclusiones: node_modules, .env, dist, .next
├── .env.example                 ← Plantilla de variables de entorno (SIN secretos)
├── README.md                    ← Documentación general del proyecto
├── pnpm-workspace.yaml          ← Configuración workspaces pnpm
├── docker-compose.yml           ← Orquestación de contenedores
├── reload-nginx.sh              ← Script de recarga de Nginx
│
├── backend/                     ← API NestJS
│   ├── Dockerfile
│   ├── src/
│   │   ├── auth/                ← Autenticación, registro, JWT
│   │   ├── certificados/        ← Generación de PDFs
│   │   ├── empresa/             ← Panel empresa/gremio
│   │   └── main.ts
│   └── package.json
│
├── frontend/                    ← UI Next.js
│   ├── Dockerfile
│   ├── public/                  ← Imágenes, logos, assets estáticos
│   └── src/
│       ├── app/                 ← Rutas App Router
│       │   ├── (public)/        ← Módulos públicos
│       │   ├── (dashboard)/     ← Módulos privados
│       │   └── login/           ← Página de acceso
│       ├── components/          ← Componentes reutilizables
│       └── lib/                 ← API client, auth, utils
│
└── docs/
    └── informes/                ← Informes de desarrollo por módulo
```

---

## 4. Archivos excluidos por `.gitignore`

El `.gitignore` garantiza que información sensible y artefactos generados **nunca** entren al repositorio:

```gitignore
# Dependencias (se instalan con pnpm install)
node_modules/
.pnpm-store/

# Builds (se generan con docker compose build)
dist/
build/
.next/
out/
*.tsbuildinfo

# Variables de entorno con secretos (BD, JWT, API keys)
.env
.env.local
.env.*.local
!.env.example     ← El ejemplo SÍ entra al repo (sin valores reales)

# Logs
*.log
logs/

# Editores y OS
.vscode/
.idea/
.DS_Store
```

El archivo `.env.example` documenta todas las variables necesarias sin revelar valores reales, permitiendo que cualquier colaborador sepa qué configurar.

---

## 5. Historial de Commits

El repositorio cuenta con **13 commits** desde el inicio del proyecto (25 de marzo de 2026) hasta la fecha.

### Línea de tiempo completa

```
25 mar 2026 ─────────────────────────────────────────────── 15 abr 2026
     │                                                            │
  [Inicio]                                              [Estado actual]
```

| Commit | Fecha | Descripción | Alcance |
|---|---|---|---|
| `3870bf4` | 25/03/2026 | **`chore: init monorepo structure`** | Estructura base del repositorio: `.gitignore`, `.env.example`, `README.md`, `pnpm-workspace.yaml` |
| `ad02ad2` | 25/03/2026 | **`feat: add docker infrastructure`** | Docker Compose, Nginx, Dockerfiles de backend y frontend, package.json de NestJS |
| `0baab07` | 25/03/2026 | **`feat: vue 3 frontend + nestjs backend with oracle connection`** | Primera versión funcional: frontend Vue 3 + backend NestJS conectado a Oracle |
| `8833d5b` | 25/03/2026 | **`fix: remove vite scss api prop, clean generated artifacts`** | Limpieza de artefactos generados automáticamente, fix de configuración Vite |
| `4b502e9` | 25/03/2026 | **`fix: monorepo root package.json, docker build context, all services running`** | Corrección del package.json raíz, contextos de build Docker, todos los servicios corriendo |
| `8894d40` | 02/04/2026 | **`Actualizado a Nest, Next.js`** | **Migración del frontend de Vue 3 → Next.js 15**. Cambio de arquitectura completo. Primer portal público en Next.js |
| `5b3d5cb` | 09/04/2026 | **`ajustes para conexion bd sirve pero necesito dejar todo full ok`** | Ajustes de conexión Oracle, validación de que la BD funciona correctamente |
| `3661e02` | 11/04/2026 | **`ajustes para el certificado, ok todo`** | Módulo de Certificados funcional: búsqueda por documento/código, generación PDF con PDFKit |
| `dabe891` | 12/04/2026 | **`ajustes tsconfig errores que behhh`** | Corrección de errores de TypeScript en tsconfig, limpieza de tipos |
| `ed23518` | 14/04/2026 | **`integracion de imagenes en el public state y responsividad ajustada`** | Assets estáticos del portal público (logos institucionales, imágenes de módulos), ajustes responsivos |
| `47dca0a` | 14/04/2026 | **`Registro de usuarios en el aplicativo melo`** | Registro de Proponente (empresa/gremio) y Registro de Usuario (persona natural), Habeas Data, wizard multi-paso |
| `ffccb0d` | 14/04/2026 | **`avance en el apartado de logica de la empresas, hasta datos basicos`** | Panel empresa completo: layout con preloader, sidebar dinámico desde Oracle, topbar, datos básicos (5 secciones, 14 endpoints) |
| `49f7591` | 15/04/2026 | **`estrucutar de informes avance mes de abril`** | Documentación técnica: 8 informes de desarrollo en `docs/informes/` |

---

## 6. Métricas del Repositorio

| Métrica | Valor |
|---|---|
| Total de commits | 13 |
| Días de desarrollo activo | ~21 días (25 mar → 15 abr 2026) |
| Archivos modificados (total) | ~140 archivos |
| Líneas de código añadidas | ~19.063 líneas |
| Líneas eliminadas/refactorizadas | ~18 líneas |
| Ramas | 1 (`main`) |

---

## 7. Evolución Técnica Visible en Git

El historial de commits refleja la evolución técnica del proyecto:

### Fase 1 — Fundación (25 marzo 2026)
Commits `3870bf4` → `4b502e9`: Se estableció la infraestructura base en un solo día. Monorepo, Docker, Nginx, primera conexión a Oracle. El frontend inicial fue **Vue 3** con Vite.

### Fase 2 — Decisión de arquitectura (2 abril 2026)
Commit `8894d40`: **Cambio de Vue 3 → Next.js 15**. Se tomó la decisión de migrar el frontend a Next.js para aprovechar el App Router, SSR nativo, y mejor integración con el ecosistema TypeScript del backend NestJS.

### Fase 3 — Módulos públicos (9–14 abril 2026)
Commits `5b3d5cb` → `47dca0a`: Módulos públicos completados: certificados, eventos, registro de proponentes y usuarios, portal de inicio.

### Fase 4 — Panel privado empresa (14 abril 2026)
Commit `ffccb0d`: Panel completo para empresas/gremios con lógica de negocio compleja (menú dinámico Oracle, formularios de actualización, cascadas de selección).

### Fase 5 — Documentación (15 abril 2026)
Commit `49f7591`: Informes técnicos de todos los módulos implementados hasta la fecha.

---

## 8. Flujo de Trabajo Git (Convención usada)

```bash
# 1. Trabajar en los archivos localmente

# 2. Ver qué cambió
git status
git diff

# 3. Agregar los cambios
git add .           # o agregar archivos específicos: git add backend/src/empresa/

# 4. Crear el commit
git commit -m "descripción de lo que se hizo"

# 5. Subir al repositorio remoto en GitHub
git push origin main
```

---

## 9. Estado Actual del Repositorio

```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

El repositorio está **completamente sincronizado** con GitHub. No hay archivos pendientes de commit ni cambios sin subir.

---

## 10. Comandos útiles para verificar el estado

```bash
# Ver el historial de commits completo con fechas
git log --pretty=format:"%h | %ad | %s" --date=short

# Ver qué archivos cambiaron en el último commit
git show --stat HEAD

# Ver el árbol de archivos del repositorio (sin node_modules)
git ls-tree -r --name-only HEAD | head -60

# Comparar estado local con GitHub
git fetch origin && git status

# Ver diferencias entre dos commits
git diff ffccb0d 49f7591 --stat
```

---

## 11. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Página del repositorio en GitHub | `github.com/JoSeLoDiAz/SEP` |
| 2 | Historial de commits en GitHub | Pestaña "Commits" del repositorio |
| 3 | Estructura de archivos en GitHub | Pestaña "Code" del repositorio |
| 4 | Historial en terminal | Correr `git log --oneline` |
| 5 | `git log --pretty=...` con fechas | Ver comando en sección 10 |
| 6 | Último commit con archivos cambiados | `git show --stat HEAD` |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Control de versiones con Git/GitHub implementado

---

Cordial saludo,

Se informa que el proyecto de renovación tecnológica del SEP está siendo gestionado con **Git** como sistema de control de versiones y **GitHub** como repositorio remoto (`github.com/JoSeLoDiAz/SEP`).

Desde el inicio del proyecto (25 de marzo de 2026) hasta la fecha se han realizado **13 commits** que documentan toda la evolución del sistema: configuración de infraestructura, conexión a Oracle, módulos públicos, panel privado para empresas/gremios y documentación técnica. En total, más de **140 archivos** y **19.000 líneas de código**.

El repositorio está configurado para excluir automáticamente información sensible (credenciales, variables de entorno, builds) garantizando la seguridad del código en GitHub. El estado actual del repositorio es completamente sincronizado y sin cambios pendientes.

Se adjunta informe técnico con el historial completo de commits, métricas del repositorio y la evolución técnica del proyecto.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
