# Informe de Desarrollo — Módulo Listado de Proyectos
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP del punto de entrada al núcleo del aplicativo: desde aquí la empresa o gremio (perfilId=7) ve todos los proyectos que ha creado, en qué convocatoria y modalidad se inscribió cada uno, y en qué estado están (borrador, radicado, reversado). Conserva la información del SEP GeneXus y agrega varias mejoras: una sola query con JOIN al backend (sin peticiones adicionales para resolver nombres de catálogos), vista responsive con tabla en escritorio y tarjetas en móvil, badges visuales para distinguir estados a primera vista y navegación SPA al detalle del proyecto sin recargas completas de página.

La pantalla muestra una tabla con los proyectos de la empresa autenticada, ordenados por fecha de registro. Cada fila tiene acciones contextuales para abrir el proyecto (gestión completa) o, si la convocatoria sigue abierta, crear uno nuevo. La validación de "una empresa solo puede tener un proyecto por convocatoria" se aplica del lado del backend al momento de crear (ver informe 16 — Crear Nuevo Proyecto).

---

## 2. Flujo General

```
Usuario accede a /panel/proyectos (autenticado, perfilId=7)
         │
         ▼
GET /proyectos  → lista de proyectos de la empresa con catálogos JOIN-eados
         │
         ▼
Render: tabla con columnas Nombre, Convocatoria, Modalidad, Estado, Fecha registro
         │
         ├── Click en una fila → /panel/proyectos/[id]  (gestión completa)
         │
         └── "Crear nuevo proyecto"  → modal de creación
                │
                ▼
             (ver informe 16 para flujo de creación)
```

El listado es lectura pura: no permite editar ni eliminar desde aquí. Las acciones destructivas (cuando aplican) viven dentro de la vista de gestión del proyecto individual.

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/proyectos/page.tsx`

### Lo que hace la pantalla

- **Una sola petición GET** al cargar — el backend ya hace el JOIN con `CONVOCATORIA` y `MODALIDAD`, así que no hay que pegar más al servidor para resolver nombres.
- **Tabla en escritorio y tarjetas en móvil**, mismo patrón responsive del resto del panel.
- Cada fila muestra:
  - Nombre del proyecto
  - Convocatoria y modalidad (etiquetas legibles, no IDs)
  - Estado del proyecto con un badge de color (borrador en gris, radicado en verde, reversado en amarillo)
  - Fecha de registro y, si aplica, fecha de radicación
- **Click en cualquier parte de la fila** lleva a `/panel/proyectos/[id]`, donde se abre la vista de gestión completa.
- **Botón "Crear nuevo proyecto"** en la cabecera abre el modal de creación, cuyo flujo se documenta en el informe 16.
- **Estado vacío**: si la empresa no tiene proyectos, se muestra un mensaje con CTA al botón "Crear nuevo proyecto".

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | `GET /proyectos` (línea 154) |
| `backend/src/proyectos/proyectos.service.ts` | Método `listar(email)` (líneas 60-77) |

### Endpoint

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/proyectos` | Lista los proyectos de la empresa con convocatoria, modalidad, estado y fechas |

### Query principal

```sql
SELECT p.PROYECTOID                AS "proyectoId",
       TRIM(p.PROYECTONOMBRE)      AS "nombre",
       p.PROYECTOESTADO            AS "estado",
       p.PROYECTOFECHAREGISTRO     AS "fechaRegistro",
       p.PROYECTOFECHARADICACION   AS "fechaRadicacion",
       TRIM(cv.CONVOCATORIANOMBRE) AS "convocatoria",
       TRIM(m.MODALIDADNOMBRE)     AS "modalidad"
  FROM PROYECTO p
  LEFT JOIN CONVOCATORIA cv ON cv.CONVOCATORIAID = p.CONVOCATORIAID
  LEFT JOIN MODALIDAD m      ON m.MODALIDADID    = p.MODALIDADID
 WHERE p.EMPRESAID = :1
 ORDER BY p.PROYECTOID ASC
```

Los `LEFT JOIN` evitan que un proyecto se pierda si la convocatoria o modalidad fueron desactivadas en el catálogo después de su creación (ej: convocatoria histórica). En esos casos el campo simplemente viene `NULL` y el frontend muestra un guion.

### Estados del proyecto (`PROYECTOESTADO`)

| Valor | Significado | Cómo aparece |
|---|---|---|
| `0` o `NULL` | Borrador (en construcción) | Badge gris "Borrador" |
| `1` | Radicado (entregado al SENA) | Badge verde "Radicado" |
| `2` | Reversado (devuelto a borrador) | Badge amarillo "Reversado" |

El significado y las transiciones entre estados se manejan en el módulo de Gestión del proyecto (informe 17).

### Aislamiento por empresa

El filtro `WHERE p.EMPRESAID = :1` con el `empresaId` derivado del JWT garantiza que un usuario nunca ve proyectos de otras organizaciones.

---

## 5. Modelo de datos

### Tabla `PROYECTO` — columnas usadas en el listado

| Columna | Notas |
|---|---|
| `PROYECTOID` (PK) | Generado por secuencia `PROYECTOID.NEXTVAL` al crear |
| `EMPRESAID` (FK → EMPRESA) | Filtro de aislamiento |
| `PROYECTONOMBRE` | Nombre del proyecto definido al crear |
| `CONVOCATORIAID` (FK → CONVOCATORIA) | Convocatoria a la que se inscribe |
| `MODALIDADID` (FK → MODALIDAD) | Modalidad elegida |
| `PROYECTOESTADO` | 0 borrador, 1 radicado, 2 reversado |
| `PROYECTOFECHAREGISTRO` | `SYSDATE` al crear |
| `PROYECTOFECHARADICACION` | `SYSDATE` al radicar (NULL hasta la primera radicación) |

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador — todos los endpoints requieren JWT |
| `@CurrentUser()` | Email se extrae del JWT, no del body |
| Filtro `EMPRESAID = :empresaId` | Aplicado en el listado — imposible ver proyectos de otra empresa |
| `synchronize: false` (TypeORM) | Nunca modifica el schema de Oracle automáticamente |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Listado con varios proyectos en distintos estados | `/panel/proyectos` con datos de prueba |
| 2 | Vista móvil con tarjetas | DevTools → 375px |
| 3 | Badges de estado (borrador/radicado/reversado) en una misma vista | Crear/radicar/reversar 3 proyectos |
| 4 | Estado vacío "no hay proyectos creados" | Empresa nueva sin proyectos |
| 5 | Hover en una fila mostrando que es clickeable | Mover el mouse sobre una fila |
| 6 | Modal de creación de nuevo proyecto abierto | Click en "Crear nuevo proyecto" |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Listado de Proyectos implementado

---

Cordial saludo,

Se informa que el **módulo de Listado de Proyectos** del nuevo SEP, conforme al SEP GeneXus pero implementado sobre el nuevo stack con mejoras de experiencia y rendimiento, ha sido finalizado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Listado completo de los proyectos de la empresa autenticada, con nombre, convocatoria, modalidad, estado y fechas
- Resolución de nombres de convocatoria y modalidad desde el catálogo en una sola query (sin peticiones adicionales)
- Indicador visual del estado de cada proyecto: borrador, radicado o reversado
- Vista responsive: tabla en escritorio, tarjetas en dispositivos móviles
- Click en cualquier fila para abrir la vista de gestión completa del proyecto
- Acceso directo al flujo de creación de nuevo proyecto desde la cabecera
- Aislamiento estricto por empresa: cada usuario solo ve los proyectos de su organización

Se adjunta informe técnico con el detalle del endpoint y la semántica de los estados del proyecto en la columna `PROYECTOESTADO`.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
