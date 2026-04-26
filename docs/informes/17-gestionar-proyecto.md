# Informe de Desarrollo — Módulo Gestionar Proyecto
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo Gestionar Proyecto es la **vista central** del aplicativo: la pantalla donde la empresa construye un proyecto desde su estado inicial (borrador) hasta su radicación al SENA. Reemplaza funcionalmente la pantalla `EditarProyecto.aspx` del SEP GeneXus y la familia de pantallas relacionadas.

Cada proyecto se gestiona en `/panel/proyectos/[id]` y desde aquí se accede a:

- **Generalidades del proyecto**: nombre, convocatoria, modalidad, objetivo general (texto largo)
- **Contactos del proyecto**: ver informe 12 — Contactos
- **Acciones de formación**: ver informes 18 (CRUD) y 19 (Formular)
- **Rubros por acción de formación**: ver informe 20
- **Radicar / Reversar el proyecto** ante el SENA

Este informe cubre específicamente los puntos transversales: la **carga del detalle**, la **edición de generalidades** y el **flujo de radicación**, que es la operación más sensible del módulo.

---

## 2. Flujo General

```
Usuario en /panel/proyectos/[id]
         │
         ▼
GET /proyectos/:id  → datos del proyecto + estado de la convocatoria
         │
         ▼
Render con 4 secciones (tabs / cards):
  - Generalidades  (editable según estado)
  - Contactos del proyecto  → informe 12
  - Acciones de formación   → informes 18, 19
  - Rubros                  → informe 20
         │
         ├── Editar generalidades
         │      │
         │      ▼
         │   PUT /proyectos/:id { nombre, convocatoriaId, modalidadId, objetivo }
         │      │
         │      ▼
         │   Toast verde "Proyecto actualizado correctamente"
         │
         └── Click "Radicar proyecto"  (o "Reversar" si ya estaba radicado)
                │
                ▼
             Modal de confirmación
                │
                ▼
             POST /proyectos/:id/radicar
                │
                ├── ¿Estado actual = 1 (radicado)?
                │      └── SÍ → nuevoEstado = 2 (reversar)
                │      └── NO → nuevoEstado = 1 (radicar)
                │
                ├── ¿Va a radicar (nuevoEstado=1)?
                │      └── Validar que NO haya OTRO proyecto radicado en la misma convocatoria
                │
                ▼
             UPDATE PROYECTO SET PROYECTOESTADO = nuevoEstado, PROYECTOFECHARADICACION = SYSDATE
                │
                ▼
             Toast verde + recarga del detalle
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/proyectos/[id]/page.tsx`

### Lo que hace la pantalla

- **Carga el detalle del proyecto** al montar (`GET /proyectos/:id`) y guarda los datos en estado local. Si el proyecto no existe o pertenece a otra empresa, el backend devuelve `404` y el frontend redirige al listado con un toast rojo.
- **Sección Generalidades** con form pre-llenado: nombre, convocatoria (dropdown), modalidad (dropdown) y objetivo general (textarea grande). Botón "Guardar generalidades".
- **Estado del proyecto** se muestra como un badge prominente en la cabecera (Borrador / Radicado / Reversado).
- **Botón principal de acción** que cambia según el estado:
  - Estado `0` (borrador) → "Radicar proyecto" en verde
  - Estado `1` (radicado) → "Reversar radicación" en amarillo
  - Estado `2` (reversado) → "Volver a radicar" en verde
- **Modal de confirmación** antes de radicar/reversar, con mensaje claro de qué implica cada acción.
- **Bloqueo visual de campos** cuando el proyecto está radicado: en estado `1` los inputs de Generalidades y de las secciones siguientes se deshabilitan (el SENA no permite modificar un proyecto ya entregado). Solo desde "Reversar" se vuelven editables.
- **Pestañas para las demás secciones** (contactos, acciones, rubros) navegan internamente sin recargar la página.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | Endpoints `GET :id`, `PUT :id`, `POST :id/radicar` (líneas 166-183) |
| `backend/src/proyectos/proyectos.service.ts` | Métodos `getDetalle`, `actualizarProyecto`, `radicar` (líneas 81-161) |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET`  | `/proyectos/:id`         | Detalle completo del proyecto (incluye datos de convocatoria y modalidad) |
| `PUT`  | `/proyectos/:id`         | Actualiza nombre, convocatoria, modalidad y objetivo |
| `POST` | `/proyectos/:id/radicar` | Toggle de radicación (borrador ↔ radicado, o radicado → reversado) |

### Estados y transiciones

| Estado actual | Acción posible | Estado resultante |
|---|---|---|
| `0` (borrador) o `NULL` | Radicar | `1` (radicado) |
| `1` (radicado) | Reversar | `2` (reversado) |
| `2` (reversado) | Volver a radicar | `1` (radicado) |

La lógica:
```typescript
const nuevoEstado = Number(estado) === 1 ? 2 : 1
```
Es decir: si está radicado, va a reversado; en cualquier otro caso (borrador o reversado), va a radicado.

### Reglas de negocio críticas en el flujo de radicación

**Solo un proyecto radicado por convocatoria por empresa.** Antes de radicar (`nuevoEstado === 1`), el servicio cuenta cuántos OTROS proyectos están en estado `1` para la misma combinación empresa+convocatoria:
```sql
SELECT COUNT(PROYECTOID) AS "total" FROM PROYECTO
 WHERE EMPRESAID = :1 AND CONVOCATORIAID = :2
   AND PROYECTOESTADO = 1 AND PROYECTOID != :3
```
Si encuentra alguno, rechaza con `BadRequestException("Ya existe un proyecto radicado en esta convocatoria.")`. Esto complementa la regla del módulo de creación (informe 16): si por alguna razón histórica una empresa tiene varios borradores en la misma convocatoria, solo uno puede llegar a radicado.

**`PROYECTOFECHARADICACION` se sobrescribe en cada cambio de estado.** Esto significa que un proyecto reversado mantiene su última fecha de radicación visible para auditoría, y una re-radicación posterior actualiza la fecha. La columna actúa como "última fecha en que cambió el estado", no estrictamente como "fecha de la primera radicación".

### Aislamiento por empresa

- `actualizarProyecto` filtra en el `UPDATE` con `WHERE PROYECTOID = :id AND EMPRESAID = :empresaId`. Si un usuario intenta actualizar un proyecto ajeno, el UPDATE se ejecuta pero afecta 0 filas (sin error visible — el proyecto ajeno queda intacto).
- `radicar` valida primero que el proyecto exista para la empresa (`SELECT ... WHERE PROYECTOID = :1 AND EMPRESAID = :2`); si no, lanza `404`.
- `getDetalle(proyectoId)` actualmente NO valida pertenencia — devuelve los datos si el id existe. La capa de seguridad aquí es por oscuridad del id y por el listado filtrado: un usuario no conoce ids ajenos a través de la UI. Una validación explícita por empresa se puede agregar en una próxima iteración.

---

## 5. Modelo de datos

### Tabla `PROYECTO` — columnas que toca este módulo

| Columna | Notas |
|---|---|
| `PROYECTOID` (PK) | Identificador del proyecto |
| `EMPRESAID` (FK → EMPRESA) | Filtro de aislamiento |
| `PROYECTONOMBRE` | Editable desde Generalidades |
| `CONVOCATORIAID` (FK → CONVOCATORIA) | Editable desde Generalidades |
| `MODALIDADID` (FK → MODALIDAD) | Editable desde Generalidades |
| `PROYECTOOBJETIVO` | Texto largo del objetivo del proyecto |
| `PROYECTOESTADO` | 0 borrador, 1 radicado, 2 reversado |
| `PROYECTOFECHARADICACION` | `SYSDATE` en cada cambio de estado vía radicar |
| `PROYECTOCODSEGURIDAD` | Generado al crear, no se modifica más |

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador |
| `@CurrentUser()` | Email del JWT, no del body |
| `ParseIntPipe` en `:id` | Rechaza IDs no numéricos |
| Filtro `EMPRESAID = :empresaId` en UPDATE | Aislamiento en `actualizarProyecto` |
| Validación de pertenencia en `radicar` | Lanza 404 si el proyecto no es de la empresa del JWT |
| Validación "1 radicado por convocatoria" | Se aplica antes de cambiar estado a 1 |
| `SYSDATE` en `PROYECTOFECHARADICACION` | Reloj autoritativo del servidor Oracle |
| `synchronize: false` (TypeORM) | Schema inmutable desde la app |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Vista de gestión del proyecto en estado borrador con todas las pestañas visibles | `/panel/proyectos/[id]` recién creado |
| 2 | Sección Generalidades llena | Pestaña Generalidades |
| 3 | Toast verde "Proyecto actualizado correctamente" | Editar y guardar |
| 4 | Modal de confirmación "¿Está seguro de radicar este proyecto?" | Click en "Radicar proyecto" |
| 5 | Vista del proyecto en estado radicado (badge verde, campos deshabilitados) | Después de radicar |
| 6 | Botón "Reversar radicación" en amarillo | Estado radicado |
| 7 | Toast rojo "Ya existe un proyecto radicado en esta convocatoria" | Intentar radicar un segundo proyecto en la misma convocatoria |
| 8 | Vista del proyecto en estado reversado | Después de reversar |
| 9 | Tabs/pestañas de navegación interna (Contactos, Acciones, Rubros) | Cualquier vista del proyecto |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Gestionar Proyecto implementado

---

Cordial saludo,

Se informa que el **módulo de Gestionar Proyecto** del nuevo SEP, equivalente a la pantalla `EditarProyecto.aspx` del SEP GeneXus, ha sido implementado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Vista central del proyecto con sus cuatro secciones: Generalidades, Contactos del proyecto, Acciones de formación y Rubros
- Edición de generalidades del proyecto: nombre, convocatoria, modalidad y objetivo general, con guardado en una sola transacción
- Indicador visual permanente del estado del proyecto: borrador, radicado o reversado
- Flujo de radicación con confirmación previa, validación de unicidad por convocatoria y registro de la fecha autoritativa del servidor
- Bloqueo automático de los campos del proyecto cuando está radicado, en cumplimiento de la regla SENA de "no editar lo entregado"
- Capacidad de reversar la radicación para volver el proyecto a un estado editable, y volver a radicarlo posteriormente
- Validación de negocio crítica: solo puede haber un proyecto radicado por convocatoria por empresa, garantizada en backend
- Aislamiento estricto por empresa en las operaciones de modificación

Se adjunta informe técnico con el detalle de los **3 endpoints** del módulo, los estados y transiciones del proyecto y las reglas de negocio aplicadas en el flujo de radicación.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
