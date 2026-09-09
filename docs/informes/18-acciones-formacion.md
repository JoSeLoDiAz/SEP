# Informe de Desarrollo — Módulo Acciones de Formación (CRUD)
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP del módulo donde la empresa crea y administra las **Acciones de Formación** (AF) de cada proyecto. Una AF es la unidad de trabajo concreta dentro de un proyecto: un curso, taller, seminario o cualquier evento formativo específico que la empresa va a ejecutar para atender una de las necesidades detectadas en el diagnóstico.

Un proyecto puede tener una o varias AFs, cada una con su propia numeración correlativa, tipo de evento (curso, taller, conferencia, etc.), modalidad de formación (presencial, virtual, mixta) y número de beneficiarios. Conserva la lógica del SEP GeneXus e incorpora mejoras del nuevo stack: numeración correlativa **autocalculada en la misma transacción Oracle** (sin riesgo de duplicados por concurrencia), detalle completo de la AF resuelto en una sola query con todos los catálogos JOIN-eados (vs. múltiples postbacks del aplicativo viejo), eliminación en cascada manual robusta que limpia consistentemente las ~20 tablas dependientes, y bloqueo automático de mutaciones cuando el proyecto contenedor está radicado.

Este informe cubre el **CRUD básico** (listar, crear, ver, actualizar, eliminar). La formulación completa de cada AF — perfil de beneficiarios, áreas funcionales, niveles ocupacionales, sectores, unidades temáticas, alineación con la convocatoria, grupos de cobertura y material de formación — se documenta en el informe 19 (Formular Acción de Formación).

---

## 2. Flujo General

```
Usuario en /panel/proyectos/[id] → pestaña "Acciones de Formación"
         │
         ▼
GET /proyectos/:id/acciones  → lista de AFs del proyecto con tipo y modalidad
         │
         ▼
Render: tabla con número, nombre, tipo de evento, modalidad, num. beneficiarios
         │
         ├── Click "Crear nueva acción"
         │      │
         │      ▼
         │   Modal con campos: nombre, tipoEvento, modalidadFormacion, numBenef
         │      │
         │      ▼
         │   POST /proyectos/:id/acciones
         │      │
         │      ▼
         │   INSERT con número correlativo automático y SYSDATE
         │
         ├── Click en una fila → /panel/proyectos/[id]/acciones/[afId]
         │      │
         │      ▼
         │   GET /proyectos/:id/acciones/:afId  → detalle completo de la AF
         │      │
         │      ▼
         │   (continúa el flujo en Formular AF — informe 19)
         │
         ├── Editar (lápiz) → modal con todos los campos
         │      │
         │      ▼
         │   PUT /proyectos/:id/acciones/:afId
         │
         └── Eliminar (basura) → modal de confirmación
                │
                ▼
             DELETE /proyectos/:id/acciones/:afId
```

---

## 3. Frontend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `frontend/src/app/(dashboard)/panel/proyectos/[id]/page.tsx` | Pestaña "Acciones de Formación" con la tabla y el modal de creación |
| `frontend/src/app/(dashboard)/panel/proyectos/[id]/acciones/[afId]/page.tsx` | Vista de detalle de una AF específica |

### Lo que hace la pantalla

- **Tabla de acciones del proyecto** ordenadas por número correlativo. Cada fila muestra: número, nombre, tipo de evento, modalidad, número de beneficiarios y acciones (editar, eliminar, abrir).
- **Modal de creación** con 4 campos obligatorios: nombre, tipo de evento (dropdown), modalidad de formación (dropdown), número de beneficiarios. Los catálogos se cargan en paralelo al abrir el modal.
- **Modal de edición** con los mismos 4 campos pre-llenados desde la AF seleccionada.
- **Click en la fila** abre la vista de detalle / formulación, donde se continúa el armado de toda la AF.
- **Modal de confirmación de eliminación** con advertencia explícita: borrar una AF elimina también todos sus datos derivados (perfil de beneficiarios, unidades temáticas, alineación, grupos, rubros, etc.) en cascada.
- **Bloqueo cuando el proyecto está radicado**: si el proyecto está en estado 1, los botones de crear, editar y eliminar AFs se deshabilitan.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | Endpoints `:id/acciones*` (líneas 221-247) |
| `backend/src/proyectos/proyectos.service.ts` | Métodos `listarAFs`, `crearAF`, `getAFDetalle`, `actualizarAF`, `eliminarAF` |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/proyectos/:id/acciones`        | Lista las AFs del proyecto con tipo y modalidad |
| `POST`   | `/proyectos/:id/acciones`        | Crea una AF con número correlativo automático |
| `GET`    | `/proyectos/:id/acciones/:afId`  | Detalle completo de la AF (todos los campos para formulación) |
| `PUT`    | `/proyectos/:id/acciones/:afId`  | Actualiza los campos editables de la AF |
| `DELETE` | `/proyectos/:id/acciones/:afId`  | Elimina la AF y todos sus datos derivados (cascada manual) |

### Endpoints de catálogos relacionados

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/proyectos/tiposevento` | Tipos de evento activos (curso, taller, conferencia, etc.) |
| `GET` | `/proyectos/modalidadesformacion` | Modalidades activas (presencial, virtual, mixta) |
| `GET` | `/proyectos/metodologias` | Metodologías de aprendizaje (se usan en la formulación) |
| `GET` | `/proyectos/modelosaprendizaje` | Modelos de aprendizaje (se usan en la formulación) |

### Reglas de negocio

**Numeración correlativa automática.** El INSERT calcula el número directamente en SQL para evitar condiciones de carrera entre dos creaciones simultáneas:
```sql
INSERT INTO ACCIONFORMACION (..., ACCIONFORMACIONNUMERO, ...)
VALUES (..., (SELECT NVL(MAX(ACCIONFORMACIONNUMERO), 0) + 1
                FROM ACCIONFORMACION WHERE PROYECTOID = :2), ...)
```
La subquery se evalúa al momento del INSERT en la misma transacción Oracle, lo cual es razonable a la escala esperada (pocos clicks por usuario, no batch concurrente).

**Detalle con catálogos resueltos.** El endpoint `GET :id/acciones/:afId` hace JOIN con todos los catálogos (`TIPOEVENTO`, `MODALIDADFORMACION`, `METODOLOGIAAPRENDIZAJE`, `MODELOAPRENDIZAJE`, `NECESIDADFORMACION`, `PROYECTO`) en una sola query, devolviendo tanto los IDs como los nombres legibles. Esto permite que el frontend de formulación renderice todo de un solo viaje.

**Eliminación en cascada manual.** Una AF tiene muchas tablas dependientes: perfil de beneficiarios (`PERFILBENEFAF`), áreas (`AREAFUNCIONALAF`), niveles, CUOC, sectores beneficiarios y de la AF, unidades temáticas (`UNIDADTEMATICA` y sus actividades + perfiles), alineación (`AFCOMPONENTE`), grupos de cobertura (`GRUPOAF` y sus coberturas), material/recursos, rubros (`AFRUBRO` y submódulos GO/transferencia). El servicio borra todas estas tablas en orden inverso de dependencia antes de borrar la fila de `ACCIONFORMACION`. Es responsabilidad del servicio mantener este orden — no hay `ON DELETE CASCADE` en el modelo legacy.

### Aislamiento por empresa

La pertenencia se verifica indirectamente vía el proyecto: el `id` de la URL es del proyecto, y el frontend solo conoce ids de proyectos de su propia empresa porque el listado los filtra. Una validación explícita "esta AF pertenece a un proyecto de mi empresa" se puede agregar en una próxima iteración para defensa en profundidad.

---

## 5. Modelo de datos

### Tabla `ACCIONFORMACION` — columnas usadas en este módulo

| Columna | Notas |
|---|---|
| `ACCIONFORMACIONID` (PK) | Generado por secuencia `ACCIONFORMACIONID.NEXTVAL` |
| `PROYECTOID` (FK → PROYECTO) | A qué proyecto pertenece |
| `ACCIONFORMACIONNUMERO` | Número correlativo dentro del proyecto (autocalculado) |
| `ACCIONFORMACIONNOMBRE` | Nombre descriptivo de la AF |
| `ACCIONFORMACIONFECHAREGISTRO` | `SYSDATE` al crear |
| `TIPOEVENTOID` (FK → TIPOEVENTO) | Curso, taller, etc. |
| `MODALIDADFORMACIONID` (FK → MODALIDADFORMACION) | Presencial, virtual, mixta |
| `ACCIONFORMACIONNUMBENEF` | Beneficiarios totales esperados |
| `NECESIDADFORMACIONIDAF` (FK → NECESIDADFORMACION) | Necesidad del diagnóstico que sustenta esta AF |
| Múltiples campos cualitativos | `ACCIONFORMACIONJUSTNEC`, `ACCIONFORMACIONCAUSA`, `ACCIONFORMACIONRESULTADOS`, `ACCIONFORMACIONOBJETIVO` — se llenan en la formulación (informe 19) |
| `METODOLOGIAAPRENDIZAJEID`, `MODELOAPRENDIZAJEID` | Decisiones pedagógicas, formulación |
| Cifras agregadas | `ACCIONFORMACIONNUMHORAGRUPO`, `ACCIONFORMACIONNUMGRUPOS`, `ACCIONFORMACIONBENEFGRUPO`, `ACCIONFORMACIONBENEFVIGRUPO`, `ACCIONFORMACIONNUMTOTHORASGRUP` — totalizadores de la formulación |

### Catálogos

| Tabla | Filtro | Notas |
|---|---|---|
| `TIPOEVENTO` | `TIPOEVENTOACTIVO = 1` | Tipos de evento formativo |
| `MODALIDADFORMACION` | `MODALIDADFORMACIONACTIVO = 1` | Presencial, virtual, mixta |
| `METODOLOGIAAPRENDIZAJE` | — | Catálogo del SENA |
| `MODELOAPRENDIZAJE` | — | Catálogo del SENA |

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador |
| `ParseIntPipe` en `:id` y `:afId` | Rechaza IDs no numéricos |
| Pertenencia indirecta vía proyecto | El `proyectoId` solo lo conoce quien lo ve en su listado |
| Bloqueo de mutaciones cuando el proyecto está radicado | El frontend deshabilita los botones; refuerzo backend pendiente |
| `SYSDATE` para `ACCIONFORMACIONFECHAREGISTRO` | Reloj autoritativo del servidor |
| `synchronize: false` (TypeORM) | Schema inmutable desde la app |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Pestaña "Acciones de Formación" con varias AFs en el proyecto | `/panel/proyectos/[id]` → pestaña Acciones |
| 2 | Modal de creación de AF abierto | Click en "Crear nueva acción" |
| 3 | Dropdown de tipo de evento desplegado | Click en el select |
| 4 | Modal de edición pre-llenado | Click en lápiz de una AF |
| 5 | Modal de confirmación de eliminación con advertencia de borrado en cascada | Click en basura |
| 6 | Vista de detalle/formulación al entrar a una AF | Click en una fila |
| 7 | Botones deshabilitados cuando el proyecto está radicado | Vista del proyecto en estado 1 |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Acciones de Formación (CRUD) implementado

---

Cordial saludo,

Se informa que el **módulo de Acciones de Formación** del nuevo SEP, en su capa de listado, creación, edición y eliminación, conforme a la lógica del SEP GeneXus pero con la numeración correlativa autocalculada en transacción Oracle y el detalle resuelto en una sola query, ha sido finalizado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Listado de acciones de formación por proyecto, con número correlativo, nombre, tipo de evento, modalidad y número de beneficiarios
- Creación de nuevas acciones con numeración correlativa automática calculada en la misma transacción Oracle (sin riesgo de duplicados)
- Edición de los campos básicos de la acción
- Eliminación en cascada manual: al eliminar una acción se borran también todas sus tablas dependientes (perfil de beneficiarios, áreas, niveles, sectores, unidades temáticas, alineación, grupos, material, rubros)
- Carga del detalle completo de la acción en una sola query con todos los catálogos resueltos, lista para alimentar la pantalla de formulación
- Bloqueo de mutaciones cuando el proyecto contenedor está radicado, en cumplimiento de la regla SENA de "no editar lo entregado"

La formulación detallada de cada acción de formación (perfil de beneficiarios, áreas funcionales, niveles ocupacionales, sectores, unidades temáticas, alineación con la convocatoria, grupos de cobertura y material) se documenta en el informe siguiente del módulo.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
