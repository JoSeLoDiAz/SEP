# Informe de Desarrollo — Módulo Análisis Empresarial / Gremial
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP del módulo donde la empresa o gremio describe su contexto cualitativo: a qué se dedica, qué hace, en qué situación está, qué retos enfrenta, en qué cadena productiva participa y de qué sectores forma parte o representa. Esta información es el insumo principal para que los evaluadores del SENA entiendan la pertinencia de los proyectos. Conserva la estructura de campos del SEP GeneXus pero con mejoras en la nueva implementación: contadores en vivo de caracteres por textarea, validaciones inmediatas en cliente, carga paralela de los 7 conjuntos de datos en una sola pasada (vs. los postbacks de WebForms) y persistencia REST instantánea de cada item sectorial sin recargar la pantalla.

La pantalla combina dos tipos de información en una sola vista:

- **Generalidades** y **Cadena productiva** — 8 textos largos (textareas), guardados en columnas de la tabla `EMPRESA`.
- **Sectores y subsectores** — 4 listas independientes en formato tipo "agregar / quitar":
  - Sector(es) al que la entidad **pertenece**
  - Subsector(es) al que la entidad **pertenece**
  - Sector(es) que la entidad **representa** (aplica a gremios)
  - Subsector(es) que la entidad **representa**

Solo el usuario con perfil Empresa/Gremio/Asociación (perfilId=7) accede a esta pantalla, y como toda la información pertenece a su organización, el aislamiento por empresa está garantizado por el JWT.

---

## 2. Flujo General

```
Usuario accede a /panel/analisis (autenticado, perfilId=7)
         │
         ▼
Carga paralela de 7 peticiones API:
  GET /empresa/analisis              → 8 textos del análisis
  GET /empresa/sectores              → catálogo de sectores
  GET /empresa/subsectores           → catálogo de subsectores
  GET /empresa/sectores-pertenece    → sectores ya asociados
  GET /empresa/subsectores-pertenece → subsectores ya asociados
  GET /empresa/sectores-representa   → sectores que representa (gremios)
  GET /empresa/subsectores-representa → subsectores que representa
         │
         ▼
Render: 3 secciones (Generalidades, Cadena, Clasificación sectorial)
         │
         ├── Botón "Guardar Generalidades"  → PUT /empresa/analisis (los 8 campos)
         ├── Botón "Guardar Cadena"         → PUT /empresa/analisis (los 8 campos)
         │
         └── En cada bloque sectorial:
                ├── Dropdown + botón Agregar  → POST /empresa/<endpoint>
                └── Botón × en cada item       → DELETE /empresa/<endpoint>/:id
```

Los dos botones de guardado de textos envían **el mismo payload completo** con los 8 campos — el endpoint `PUT /empresa/analisis` actualiza todas las columnas en una sola query. La separación visual en dos botones es por usabilidad (los textos cortos de "cadena productiva" están al final y queremos un guardado cercano), no porque haya dos transacciones distintas.

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/analisis/page.tsx`

### Lo que hace la pantalla

- **Carga inicial paralela** de las 7 peticiones para que la página renderice de un tirón sin "saltos" visuales.
- Tres bloques independientes con su propio botón de guardado o gestión de items:
  - **Generalidades** — 6 textareas (objeto social, productos/servicios, situación actual, papel en el sector, retos, experiencia formativa) con un único botón "Guardar Generalidades". Todos los campos son obligatorios.
  - **Cadena productiva** — 2 textareas (eslabones de la cadena productiva, interacciones con otros actores) con su propio botón.
  - **Clasificación sectorial** — 4 sub-bloques (sector pertenece, subsector pertenece, sector representa, subsector representa) renderizados con un único componente parametrizado por endpoint.
- **Validación previa al envío**: campos obligatorios no vacíos y respeto a los límites de caracteres por campo (3000 a 5000 según el campo). Si alguno falla, se cancela el envío y se muestra un toast rojo.
- **Contador en vivo de caracteres** (`{texto.length}/5000`) en cada textarea.
- En los bloques sectoriales, el dropdown se carga del catálogo correspondiente (`sectores` o `subsectores`) y al agregar se actualiza la lista local sin recargar toda la página.
- Toasts con re-mount forzado, igual patrón que el resto del panel.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/empresa/empresa.controller.ts` | 16 endpoints involucrados (análisis + 4 bloques sectoriales + catálogos) |
| `backend/src/empresa/empresa.service.ts` | Métodos `getAnalisis`, `updateAnalisis`, y los CRUD sectoriales |

### Endpoints del análisis (textos largos)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/empresa/analisis` | Devuelve los 8 textos del análisis empresarial |
| `PUT` | `/empresa/analisis` | Actualiza los 8 textos en una sola query |

### Endpoints de clasificación sectorial

Cada uno de los 4 bloques sigue exactamente el mismo patrón (`GET` lista los items asociados, `POST` agrega uno, `DELETE` quita uno por id):

| Bloque | Listar | Agregar | Quitar |
|---|---|---|---|
| Sectores que pertenece | `GET /empresa/sectores-pertenece` | `POST /empresa/sectores-pertenece` | `DELETE /empresa/sectores-pertenece/:id` |
| Subsectores que pertenece | `GET /empresa/subsectores-pertenece` | `POST /empresa/subsectores-pertenece` | `DELETE /empresa/subsectores-pertenece/:id` |
| Sectores que representa | `GET /empresa/sectores-representa` | `POST /empresa/sectores-representa` | `DELETE /empresa/sectores-representa/:id` |
| Subsectores que representa | `GET /empresa/subsectores-representa` | `POST /empresa/subsectores-representa` | `DELETE /empresa/subsectores-representa/:id` |

### Endpoints de catálogos (lectura)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/empresa/sectores` | Lista todos los sectores del catálogo |
| `GET` | `/empresa/subsectores` | Lista todos los subsectores del catálogo |

### Mapeo del análisis a la tabla `EMPRESA`

Los 8 campos del análisis viven en columnas dentro de la propia tabla `EMPRESA`, identificadas todas por el `EMPRESAID` resuelto del JWT:

| Campo del frontend | Columna Oracle |
|---|---|
| `objeto`        | `EMPRESAOBJETO` |
| `productos`     | `EMPRESAPRODUCTOS` |
| `situacion`     | `EMPRESASITUACION` |
| `papel`         | `EMPRESAPAPEL` |
| `retos`         | `EMPRESARETOS` |
| `experiencia`   | `EMPRESAEXPERIENCIA` |
| `eslabones`     | `EMPRESAESLABONES` |
| `interacciones` | `EMPRESAINTERACCIONES` |

El servicio resuelve la empresa en cada operación con `empresaRepo.findOne({ where: { empresaEmail: email } })` antes de ejecutar el `UPDATE`. Si la empresa no existe (caso teórico, JWT con email huérfano), responde `404 Not Found`.

### Aislamiento por empresa

Las 4 listas sectoriales viven en tablas pivote (`EMPRESASECTORPERTENECE`, `EMPRESASUBSECTORPERTENECE`, `EMPRESASECTORREPRESENTA`, `EMPRESASUBSECTORREPRESENTA`) — cada fila incluye el `EMPRESAID`. El servicio agrega siempre el filtro por la empresa derivada del JWT, igual que en el resto de módulos de la sección Empresa: imposible leer o eliminar items de otra organización.

---

## 5. Modelo de datos

### Tabla `EMPRESA` — columnas usadas por este módulo

| Columna | Tipo | Notas |
|---|---|---|
| `EMPRESAOBJETO` | CLOB / VARCHAR2 | Objeto social, hasta 5000 caracteres |
| `EMPRESAPRODUCTOS` | CLOB / VARCHAR2 | Productos / servicios, hasta 3000 |
| `EMPRESASITUACION` | CLOB / VARCHAR2 | Situación actual, hasta 3000 |
| `EMPRESAPAPEL` | CLOB / VARCHAR2 | Papel en el sector, hasta 3000 |
| `EMPRESARETOS` | CLOB / VARCHAR2 | Retos estratégicos, hasta 3000 |
| `EMPRESAEXPERIENCIA` | CLOB / VARCHAR2 | Experiencia formativa, hasta 3000 |
| `EMPRESAESLABONES` | CLOB / VARCHAR2 | Eslabones cadena productiva, hasta 5000 |
| `EMPRESAINTERACCIONES` | CLOB / VARCHAR2 | Interacciones con otros actores, hasta 3000 |

### Tablas pivote sectoriales

| Tabla | Columnas clave |
|---|---|
| `EMPRESASECTORPERTENECE` | id pivote (PK), `EMPRESAID`, `SECTORID` |
| `EMPRESASUBSECTORPERTENECE` | id pivote (PK), `EMPRESAID`, `SUBSECTORID` |
| `EMPRESASECTORREPRESENTA` | id pivote (PK), `EMPRESAID`, `SECTORID` |
| `EMPRESASUBSECTORREPRESENTA` | id pivote (PK), `EMPRESAID`, `SUBSECTORID` |

### Catálogos

`SECTOR` y `SUBSECTOR` son tablas maestras administradas por el SENA, no editables desde el aplicativo.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador — todos los endpoints requieren JWT |
| `@CurrentUser()` | El email se extrae del JWT, nunca del body |
| `EMPRESAID` derivado del JWT | El frontend nunca envía el `empresaId` — se resuelve en el backend |
| Filtro por empresa en pivotes | `WHERE EMPRESAID = :1` en SELECT y DELETE de las 4 listas sectoriales |
| `ParseIntPipe` en `:id` de DELETE | Rechaza IDs no numéricos antes de tocar el servicio |
| Validación de longitud en cliente | Cada textarea tiene `maxLength` HTML y validación JS antes del envío |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Vista completa del scroll top — sección Generalidades llena | `/panel/analisis` con datos de prueba |
| 2 | Una textarea editándose con el contador de caracteres visible | Click en cualquier textarea y escribir |
| 3 | Toast verde "Generalidades guardadas correctamente" | Llenar y guardar |
| 4 | Toast rojo "Complete todos los campos obligatorios" | Intentar guardar con uno vacío |
| 5 | Toast rojo de límite excedido (`"...excede 3000 caracteres"`) | Pegar texto largo |
| 6 | Sección "Cadena Productiva" con sus 2 textareas | Scroll medio |
| 7 | Bloque "Sector que pertenece" con dropdown abierto | Click en el select del bloque |
| 8 | Lista de items agregados con botones × | Después de agregar 2-3 sectores |
| 9 | Bloque sectorial vacío (estado inicial) | Empresa nueva sin clasificación |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Análisis Empresarial / Gremial implementado

---

Cordial saludo,

Se informa que el **módulo de Análisis Empresarial / Gremial** del nuevo SEP, conforme a la estructura de campos del SEP GeneXus pero implementado sobre el nuevo stack con mejoras de experiencia (contadores en vivo, validaciones inmediatas, carga paralela), ha sido finalizado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Captura de los 8 textos cualitativos del análisis: objeto social, productos y servicios, situación actual y proyección, papel en el sector, retos estratégicos, experiencia en actividades formativas, eslabones de la cadena productiva e interacciones con otros actores
- Validación de campos obligatorios y de límites de caracteres (3000 a 5000 por campo, según corresponda) con contador en vivo
- Guardado independiente para Generalidades y Cadena productiva, con feedback visual mediante toast
- Gestión completa de la clasificación sectorial en 4 bloques: sector y subsector al que la entidad pertenece, sector y subsector que representa (aplica a gremios)
- Carga paralela de los 7 conjuntos de datos al ingresar a la pantalla, minimizando el tiempo de espera inicial
- Aislamiento estricto por empresa: tanto los 8 textos como las 4 listas sectoriales están filtrados por la organización derivada del JWT, imposibilitando interferir con datos de otras entidades

Se adjunta informe técnico con el detalle de los **16 endpoints** involucrados y el mapeo de los 8 campos del análisis a las columnas de la tabla `EMPRESA`.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
