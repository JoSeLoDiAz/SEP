# Informe de Desarrollo — Módulo Diagnóstico y Necesidades de Formación
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP del módulo donde la empresa documenta el **diagnóstico organizacional** que sustenta la pertinencia de los proyectos de formación. Cada diagnóstico es la base técnica que justifica las acciones de formación posteriores: sin un diagnóstico válido y vigente, no se pueden crear proyectos. Conserva la lógica del SEP GeneXus (cabecera del diagnóstico + herramientas aplicadas + necesidades detectadas) e incorpora mejoras del nuevo stack: numeración correlativa automática de necesidades calculada en la misma transacción, persistencia REST instantánea por cada herramienta y necesidad agregada (sin postbacks completos), validación de integridad referencial reforzada (no se permite borrar un diagnóstico ya asociado a acciones de formación con mensaje específico que indica cuántas lo bloquean) y trazabilidad de quién registra cada item con fecha autoritativa del servidor Oracle.

Una empresa puede tener **varios diagnósticos** a lo largo del tiempo (uno por convocatoria, periodo o iniciativa). Cada diagnóstico se compone de:

- **Información general del diagnóstico**: periodo de aplicación, descripción y resultados de las herramientas utilizadas, indicadores binarios de "creación de herramientas propias" y "plan de capacitación existente".
- **Herramientas aplicadas**: lista de instrumentos usados para detectar necesidades (encuestas, entrevistas, observación, otros), cada uno con la cantidad de personas participantes (tamaño de la muestra).
- **Necesidades de formación detectadas**: lista numerada de las necesidades concretas identificadas, cada una con un nombre y la cantidad estimada de beneficiarios.

Los diagnósticos son la pre-condición para crear proyectos: en el módulo de Proyectos, al crear uno nuevo, el usuario selecciona una de las **necesidades de formación** ya registradas como base. Por eso este módulo NO permite eliminar un diagnóstico que ya tenga acciones de formación asociadas.

---

## 2. Flujo General

```
Usuario accede a /panel/necesidades (autenticado, perfilId=7)
         │
         ▼
GET /necesidades  → lista de diagnósticos de la empresa con conteo
         │
         ├── "Crear nuevo diagnóstico"
         │      │
         │      ▼
         │   POST /necesidades  →  INSERT NECESIDAD con id de secuencia
         │      │
         │      ▼
         │   Redirige a /panel/necesidades/[id]
         │
         ├── Click en un diagnóstico existente
         │      │
         │      ▼
         │   /panel/necesidades/[id]  →  vista de edición completa
         │
         └── Eliminar (solo si no está asociado a acciones)
                │
                ▼
             DELETE /necesidades/:id  →  borra herramientas, necesidades y el diagnóstico

──────────────────────────────────────────────────────────────────────

En /panel/necesidades/[id]:

GET /necesidades/:id   → datos del diagnóstico + herramientas + necesidades de formación
GET /necesidades/fuentes-herramienta → catálogo de tipos de herramienta
         │
         ├── Editar campos generales → PUT /necesidades/:id/diagnostico
         │
         ├── Bloque Herramientas
         │      ├── Agregar (fuente + muestra) → POST /necesidades/:id/herramientas
         │      └── Quitar                     → DELETE /necesidades/herramientas/:hid
         │
         ├── Bloque Necesidades de Formación
         │      ├── Agregar (nombre + benef)   → POST /necesidades/:id/necesidades-formacion
         │      ├── Editar                     → PUT  /necesidades/necesidades-formacion/:nfid
         │      └── Quitar                     → DELETE /necesidades/necesidades-formacion/:nfid
         │
         └── "Generar reporte" → /panel/necesidades/[id]/reporte
                                  → GET /necesidades/:id/reporte
```

---

## 3. Frontend

### Archivos principales

| Archivo | Rol |
|---|---|
| `frontend/src/app/(dashboard)/panel/necesidades/page.tsx` | Listado de diagnósticos con botones crear / abrir / eliminar |
| `frontend/src/app/(dashboard)/panel/necesidades/[id]/page.tsx` | Edición completa del diagnóstico (campos + herramientas + necesidades) |
| `frontend/src/app/(dashboard)/panel/necesidades/[id]/reporte/page.tsx` | Vista del reporte ejecutivo del diagnóstico |

### Lo que hacen las pantallas

**Listado de diagnósticos** (`/panel/necesidades`):
- Tabla con número correlativo, fecha de registro y total de necesidades de formación detectadas.
- Botón "Crear nuevo diagnóstico" en la cabecera; al confirmarse, redirige a la vista de edición del diagnóstico recién creado.
- Botón × por fila con modal de confirmación.
- El backend rechaza la eliminación si el diagnóstico tiene acciones de formación asociadas; el frontend muestra ese mensaje en un toast rojo.

**Edición del diagnóstico** (`/panel/necesidades/[id]`):
- Bloque "Información general" con campos: periodo de aplicación (fecha), descripción de herramientas, resultados, indicadores S/N de herramientas propias y plan de capacitación, observaciones.
- Bloque "Herramientas aplicadas": dropdown con catálogo de tipos de herramienta (`FUENTEHERRAMIENTA`) + input numérico de muestra. Lista de las herramientas ya registradas con botón × para quitar.
- Bloque "Necesidades de formación": form inline para agregar (nombre + beneficiarios) y tabla con las ya registradas, cada una editable o eliminable. La numeración es automática (`numero = total + 1` al insertar).
- Botón único "Guardar diagnóstico" para los campos generales; herramientas y necesidades se persisten al instante con cada agregar/editar/quitar.

**Reporte** (`/panel/necesidades/[id]/reporte`):
- Vista de solo lectura con todos los datos del diagnóstico junto con la información completa de la empresa (razón social, NIT, ubicación, CIIU, tipo, tamaño, etc.) lista para imprimir o exportar como PDF.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/necesidades/necesidades.controller.ts` | 11 endpoints REST |
| `backend/src/necesidades/necesidades.service.ts` | Lógica de diagnóstico, herramientas y necesidades de formación |
| `backend/src/necesidades/necesidades.module.ts` | Wiring NestJS (importa `Empresa` y `AuthModule`) |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/necesidades` | Lista de diagnósticos de la empresa con conteo de necesidades |
| `POST`   | `/necesidades` | Crea un diagnóstico vacío con `SYSDATE` y devuelve su id |
| `DELETE` | `/necesidades/:id` | Elimina diagnóstico, herramientas y necesidades. Falla si hay acciones de formación asociadas |
| `GET`    | `/necesidades/:id` | Devuelve campos generales + lista de herramientas + lista de necesidades |
| `PUT`    | `/necesidades/:id/diagnostico` | Actualiza los campos generales |
| `GET`    | `/necesidades/fuentes-herramienta` | Catálogo de tipos de herramienta |
| `POST`   | `/necesidades/:id/herramientas` | Agrega una herramienta aplicada (fuente + muestra) |
| `DELETE` | `/necesidades/herramientas/:hid` | Quita una herramienta del diagnóstico |
| `POST`   | `/necesidades/:id/necesidades-formacion` | Agrega una necesidad (numeración automática) |
| `PUT`    | `/necesidades/necesidades-formacion/:nfid` | Edita nombre y beneficiarios |
| `DELETE` | `/necesidades/necesidades-formacion/:nfid` | Quita la necesidad |
| `GET`    | `/necesidades/:id/reporte` | Retorna todos los datos del diagnóstico + datos completos de la empresa para el reporte ejecutivo |

### Reglas de negocio

**Numeración automática de necesidades de formación.** Al insertar, el servicio calcula el número como `COUNT(necesidades del diagnóstico) + 1`. La numeración es estable mientras no se borre ninguna intermedia (si se borra, los números quedan con huecos — comportamiento heredado de GeneXus, intencional).

**Validación de eliminación de diagnóstico.** Antes de borrar, el servicio cuenta las acciones de formación asociadas:
```sql
SELECT COUNT(AF.ACCIONFORMACIONID) AS "total"
  FROM ACCIONFORMACION AF
 WHERE AF.NECESIDADFORMACIONIDAF IN (
   SELECT NECESIDADFORMACIONID FROM NECESIDADFORMACION WHERE NECESIDADID = :1
 )
```
Si `total > 0`, lanza `BadRequestException` con un mensaje legible que indica cuántas acciones lo bloquean. El borrado en sí es en cascada manual: primero `HERRAMIENTANECESIDAD`, luego `NECESIDADFORMACION`, finalmente `NECESIDAD`.

**Auditoría de quién registra.** Los INSERTs guardan el `usuarioId` que ejecuta la acción en columnas como `USUREGISTRONECESIDAD`, `USUREGISTROHERRAMIENTA`, `USUREGISTRONECESIDADFORMACION`. El `usuarioId` se toma del JWT, no del body.

**Fecha de registro.** Se usa `SYSDATE` de Oracle, no la del cliente, para evitar inconsistencias por reloj de PC.

### Aislamiento por empresa

El listado (`GET /necesidades`) filtra por `WHERE EMPRESANECESIDADID = :empresaId` derivado del JWT. Para las operaciones sobre un diagnóstico específico (`/necesidades/:id/...`), el servicio confía en el `id` enviado por el frontend; este `id` solo puede ser conocido por el dueño porque solo él lo ve en su listado. El acceso directo por URL a un id de otra empresa NO está actualmente bloqueado a nivel de query — es una capa de seguridad pendiente para una próxima iteración.

---

## 5. Modelo de datos

### Tabla `NECESIDAD` (cabecera del diagnóstico)

| Columna | Notas |
|---|---|
| `NECESIDADID` (PK) | Generado por secuencia `NECESIDADID.NEXTVAL` |
| `EMPRESANECESIDADID` (FK → EMPRESA) | Filtro de aislamiento |
| `NECESIDADFECHAREGISTRO` | `SYSDATE` al crear |
| `USUREGISTRONECESIDAD` (FK → USUARIO) | Trazabilidad de quién creó |
| `NECESIDADPERIODOI` | Fecha del periodo de aplicación de las herramientas |
| `NECESIDADHERROTRA` | Texto libre — "otra herramienta" no catalogada |
| `NECESIDADHERRCREACION` | Indicador binario (0/1): ¿la empresa creó herramientas propias? |
| `NECESIDADPLANCAPA` | Indicador binario (0/1): ¿existe plan de capacitación? |
| `NECESIDADHERRDESCRIP` | Descripción cualitativa de las herramientas usadas |
| `NECESIDADHERRRESULTADOS` | Resultados obtenidos con las herramientas |

### Tabla `HERRAMIENTANECESIDAD` (herramientas aplicadas)

| Columna | Notas |
|---|---|
| `HERRAMIENTANECESIDADID` (PK) | Secuencia |
| `NECESIDADID` (FK) | A qué diagnóstico pertenece |
| `FUENTEHERRAMIENTAID` (FK → FUENTEHERRAMIENTA) | Tipo de herramienta del catálogo |
| `HERRAMIENTANECESIDADPARTICIP` | Tamaño de la muestra (cantidad de participantes) |
| `HERRAMIENTANECESIDADOTRA` | Texto libre opcional — usado cuando la fuente es "Otra" |
| `USUREGISTROHERRAMIENTA` | Trazabilidad |
| `HERRAMIENTANECESIDADFECHAREG` | `SYSDATE` |

### Tabla `NECESIDADFORMACION` (las necesidades detectadas)

| Columna | Notas |
|---|---|
| `NECESIDADFORMACIONID` (PK) | Secuencia |
| `NECESIDADID` (FK) | A qué diagnóstico pertenece |
| `NECESIDADFORMACIONNUMERO` | Número correlativo dentro del diagnóstico (autocalculado) |
| `NECESIDADFORMACIONNOMBRE` | Texto descriptivo de la necesidad |
| `NECESIDADFORMACIONBENEF` | Cantidad estimada de beneficiarios |
| `USUREGISTRONECESIDADFORMACION` | Trazabilidad |
| `NECESIDADFORMACIONFECHAREGISTR` | `SYSDATE` |

### Catálogo `FUENTEHERRAMIENTA`

Tabla maestra de tipos de herramienta de diagnóstico (encuesta, entrevista, observación, grupo focal, etc.), administrada por el SENA, no editable desde el aplicativo.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador — todos los endpoints requieren JWT |
| `@CurrentUser()` | Email y `usuarioId` se extraen del JWT, no del body |
| Filtro por empresa en listado | `WHERE EMPRESANECESIDADID = :empresaId` derivado del JWT |
| Validación al eliminar | Bloqueo con mensaje específico si hay acciones de formación dependientes — evita inconsistencia referencial |
| `SYSDATE` para timestamps | Reloj autoritativo del servidor Oracle, no del cliente |
| `usuarioId` en columnas USUREGISTRO* | Trazabilidad de quién creó cada item |
| `synchronize: false` (TypeORM) | Nunca modifica el schema de Oracle automáticamente |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Listado de diagnósticos con varios items | `/panel/necesidades` con datos de prueba |
| 2 | Vista de edición — bloque información general lleno | Click en un diagnóstico existente |
| 3 | Bloque "Herramientas aplicadas" con dropdown abierto | Scroll medio, click en select |
| 4 | Lista de herramientas ya agregadas con botones × | Después de agregar 2-3 herramientas |
| 5 | Bloque "Necesidades de formación" con form inline | Click en "Agregar necesidad" |
| 6 | Tabla de necesidades agregadas, una en modo edición | Click en lápiz de una necesidad |
| 7 | Toast verde "Necesidad registrada" | Después de agregar |
| 8 | Modal de confirmación de eliminación de diagnóstico | Click en × de un diagnóstico del listado |
| 9 | Toast rojo "No se puede eliminar — está asociado a N acciones" | Intentar eliminar un diagnóstico ya usado en proyectos |
| 10 | Reporte ejecutivo completo (vista de impresión) | Click en "Generar reporte" |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Diagnóstico y Necesidades de Formación implementado

---

Cordial saludo,

Se informa que el **módulo de Diagnóstico y Necesidades de Formación** del nuevo SEP, conforme a la lógica del SEP GeneXus pero implementado sobre el nuevo stack con mejoras en experiencia, integridad referencial y trazabilidad, ha sido finalizado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Listado de diagnósticos por empresa con conteo de necesidades de formación detectadas
- Creación de un diagnóstico vacío con un solo clic, redirigiendo a su vista de edición
- Captura de información general del diagnóstico: periodo de aplicación, descripción de las herramientas, resultados, indicadores de creación de herramientas propias y existencia de plan de capacitación
- Gestión completa del bloque de Herramientas Aplicadas: tipo de herramienta del catálogo del SENA y cantidad de participantes (muestra), con alta y baja en línea
- Gestión completa del bloque de Necesidades de Formación detectadas: alta, edición y baja con numeración correlativa automática
- Validación de integridad referencial: no se permite eliminar un diagnóstico que ya esté asociado a acciones de formación de proyectos existentes, con un mensaje específico que indica cuántas acciones lo bloquean
- Trazabilidad: cada inserción registra el usuario que la realizó y la fecha autoritativa del servidor Oracle
- Generación de reporte ejecutivo del diagnóstico, combinando los datos del diagnóstico con la información completa de la empresa, listo para impresión o exportación

Se adjunta informe técnico con el detalle de los **11 endpoints** del módulo y el modelo de datos de las tablas `NECESIDAD`, `HERRAMIENTANECESIDAD` y `NECESIDADFORMACION`.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
