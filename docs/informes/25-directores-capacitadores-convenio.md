# Informe de Desarrollo — Módulo Directores y Capacitadores del Convenio
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Junio 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación del **registro y validación de talento humano del convenio** en la etapa de ejecución: el **Director del proyecto** (uno activo a la vez) y los **Capacitadores** (naturales y jurídicos) que dictarán las acciones de formación.

Ambos comparten la misma página de Hoja de Vida (`/directores/hv`), que cambia su comportamiento según el parámetro `?modo=cap`. En el SEP GeneXus eran tres pantallas distintas con código duplicado; en el nuevo SEP la HV es un componente único reutilizado para director, capacitador natural y edición.

Aporta además un **flujo de validación por interventoría**: cada director o capacitador queda en estado "Pendiente" hasta que el interventor lo apruebe o rechace con observación. El historial completo se conserva en BD.

Pantallas: `/directores`, `/directores/hv`, `/capacitadores`, `/capacitadores/empresa`.

---

## 2. Flujo General

```
Empresa registra director / capacitador
        │
        ▼  POST /convenios/:id/director       (o POST /capacitadores/...)
        │   → persona nueva o referenciada por identificación
        │   → upsert HV con NVL(MAX(id),0)+1
        │
        ▼  Estado inicial: "Pendiente validación"
        │
        ▼  Interventor revisa
        │
        ├── Aprobar  →  estado = "Aprobado"  (queda activo)
        └── Rechazar →  estado = "Rechazado" + observación obligatoria
        │
        ▼  Si rechazado: empresa registra reemplazo
              El anterior pasa al historial; el nuevo queda Pendiente
```

---

## 3. Frontend

| Archivo | Rol |
|---|---|
| `panel/convenios/[id]/directores/page.tsx` | Director activo + historial |
| `panel/convenios/[id]/directores/hv/page.tsx` | HV reutilizable (director o capacitador) |
| `panel/convenios/[id]/capacitadores/page.tsx` | Listado de capacitadores naturales/jurídicos |
| `panel/convenios/[id]/capacitadores/empresa/page.tsx` | Alta de empresa capacitadora |

- **Página director**: card del director activo (datos + estado interventoría) y acordeón con historial. Botones "Validar (aprobar/rechazar)" visibles solo para perfiles interventor.
- **HV form**: tipo doc, identificación, nombres, apellidos, correo, celular, ciudad. Si la persona ya existe por identificación, **prellena** datos y los marca como editables.
- **Listado capacitadores**: tabla con tipo (natural/jurídico), nombre, identificación, estado y acciones. Filtra por estado.
- **Empresa capacitadora**: form para registrar la persona jurídica que provee capacitadores.

---

## 4. Backend

### Archivos

| Archivo | Rol |
|---|---|
| `convenios/convenios.service.ts` | Director: registrar, validar, historial |
| `capacitadores/capacitadores.service.ts` | Capacitadores: CRUD + validar |
| `personas/personas.service.ts` | Upsert de persona (compartido) |

### Endpoints clave

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/convenios/:id/director` | Director activo + historial + flag convenioEnEjecucion |
| `POST` | `/convenios/:id/director` | Registrar o reemplazar director |
| `POST` | `/convenios/:id/director/validar` | Aprobar/rechazar (interventoría) |
| `GET` | `/capacitadores/:proyectoId` | Listado naturales y jurídicos |
| `POST` | `/capacitadores/:proyectoId/natural` | Alta de capacitador natural |
| `POST` | `/capacitadores/:proyectoId/empresa` | Alta de empresa capacitadora |
| `POST` | `/capacitadores/:id/validar` | Aprobar/rechazar capacitador |

### Reglas críticas

- **Un solo director activo por convenio**: al registrar uno nuevo, el anterior pasa a estado "histórico". La consulta `getDirectorActivo` siempre devuelve el último.
- **Observación obligatoria al rechazar**: el backend valida `if (!aprobar && !observacion.trim()) throw BadRequestException`.
- **`assertConvenioEnEjecucion`** se invoca al inicio de cada POST/PUT/DELETE.
- **Director ≠ Capacitador**: aunque la persona puede ser la misma físicamente, son registros separados en BD (DIRECTOR y CAPACITADOR vinculan a PERSONA por `PERSONAID`).
- **Concatenación de nombres con NCHAR**: uso de `N' '` y `N''` para evitar `ORA-12704`.

---

## 5. Modelo de datos

| Tabla | Columnas clave |
|---|---|
| `PERSONA` | `PERSONAID` (PK), `PERSONANOMBRES`, `PERSONAPRIMERAPELLIDO`, `PERSONASEGUNDOAPELLIDO`, `PERSONAIDENTIFICACION`, `PERSONAEMAIL`, `CIUDADID` |
| `DIRECTOR` | `DIRECTORID`, `PERSONAID`, `PROYECTOID`, `DIRECTORESTADO`, `DIRECTOROBSERVACION`, `DIRECTORFECHAVALIDACION` |
| `CAPACITADOR` | `CAPACITADORID`, `PERSONAID` o `EMPRESAID`, `PROYECTOID`, `CAPACITADORTIPO` (1=natural, 2=jurídico), `CAPACITADORESTADO` |
| `EMPRESA` | Usada también para empresas capacitadoras (mismo schema que proponentes) |

Estados de validación: `0` pendiente · `1` aprobado · `2` rechazado.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a controladores |
| `assertConvenioEnEjecucion` | Bloqueo de escrituras si convenio no en ejecución |
| Validación de perfil al validar | Solo perfiles interventoría (10/11) y SENA (2/3) pueden aprobar/rechazar |
| `ParseIntPipe` en ids | Rechaza IDs no numéricos |
| Aislamiento por empresa | El convenio se valida contra la empresa del JWT |

---

## 7. Pantallazos sugeridos

| # | Qué capturar |
|---|---|
| 1 | Página de Director con director activo + estado "Pendiente" |
| 2 | Form de HV con persona pre-existente prellenada |
| 3 | Modal "Validar director" con campo de observación |
| 4 | Historial de directores (acordeón abierto) |
| 5 | Listado de capacitadores naturales y jurídicos |
| 6 | Toast rojo "Observación obligatoria para rechazar" |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Directores y Capacitadores del convenio implementado

---

Cordial saludo,

Se informa que el **módulo Directores y Capacitadores del convenio** del nuevo SEP ha sido finalizado y se encuentra en pruebas. Cubre el registro y la validación por interventoría del director del proyecto y de los capacitadores (naturales y jurídicos) que dictarán las acciones de formación.

**Funcionalidades entregadas:**
- Página de HV reutilizable para director y capacitador natural, con prellenado automático cuando la persona ya está registrada por identificación
- Registro y reemplazo del director del proyecto con conservación completa del historial
- Listado de capacitadores naturales y jurídicos con filtros por estado de validación
- Alta de empresa capacitadora vinculada al convenio
- **Flujo de validación por interventoría**: aprobación o rechazo con observación obligatoria, registro de fecha y usuario que valida
- Validación transversal "convenio en ejecución" aplicada a todas las escrituras
- Concatenación segura de nombres NCHAR (manejo de `ORA-12704` resuelto)

Se adjunta informe técnico con los **7 endpoints** del módulo, las reglas de unicidad del director activo y el flujo de validación.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
