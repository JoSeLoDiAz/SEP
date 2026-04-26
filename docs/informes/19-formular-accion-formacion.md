# Informe de Desarrollo — Módulo Formular Acción de Formación
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP de la **formulación detallada** de cada Acción de Formación (AF). Después de crear una AF en el módulo de Acciones (informe 18), la empresa entra a su vista de detalle y completa todas las dimensiones que la sustentan ante el SENA: a quién va dirigida, qué áreas y niveles ocupacionales abarca, en qué sectores impacta, qué unidades temáticas la componen, cómo se alinea con la convocatoria, en qué territorios se ejecutará y con qué materiales y recursos.

En el SEP GeneXus toda esta formulación estaba dispersa entre **muchas pantallas separadas** con postbacks completos en cada acción y navegación constante entre ellas. En el nuevo SEP se unifica en una sola vista de detalle de la AF, organizada en **secciones** o **pestañas** internas (Perfil de beneficiarios, Sectores, Unidades Temáticas, Alineación, Grupos de cobertura, Material), todas con persistencia REST instantánea por cada acción del usuario. La carga inicial trae el detalle completo de la AF en una sola query (todos los catálogos JOIN-eados), eliminando los viajes redundantes al servidor del aplicativo viejo.

---

## 2. Flujo General

```
Usuario en /panel/proyectos/[id]/acciones/[afId]
         │
         ▼
GET /proyectos/:id/acciones/:afId  → datos de la AF y sus catálogos
         │
         ▼
Render con secciones/pestañas:
  1. Perfil de Beneficiarios
  2. Sectores y Sub-sectores
  3. Unidades Temáticas
  4. Alineación con la Convocatoria
  5. Grupos de Cobertura
  6. Material y Recursos
         │
         ├── Cada sección persiste por separado al backend
         └── Cada item agregado/quitado dispara una request REST y refresca esa sección
```

---

## 3. Secciones de la formulación

### 3.1 Perfil de Beneficiarios

**Endpoints:**
- `GET    /proyectos/:id/acciones/:afId/beneficiarios` — datos del perfil + áreas + niveles + CUOC
- `PUT    /proyectos/:id/acciones/:afId/beneficiarios` — actualiza los campos cualitativos
- `POST   /proyectos/:id/acciones/:afId/areas` — agrega un área funcional
- `DELETE /proyectos/:id/acciones/:afId/areas/:aafId` — quita un área
- `POST   /proyectos/:id/acciones/:afId/niveles` — agrega un nivel ocupacional
- `DELETE /proyectos/:id/acciones/:afId/niveles/:anId` — quita un nivel
- `POST   /proyectos/:id/acciones/:afId/cuoc` — agrega una ocupación CUOC
- `DELETE /proyectos/:id/acciones/:afId/cuoc/:ocAfId` — quita una ocupación CUOC

**Qué se captura:** enfoque diferencial de la AF (`AFENFOQUE`), justificación de la elección de áreas funcionales y niveles ocupacionales, número de mujeres beneficiarias, cantidad y justificación de campesinos, sector popular, trabajadores con discapacidad, trabajadores BIC, mipymes y trabajadores de mipymes, cadena productiva.

Tres listas dependientes que el usuario administra con dropdown + agregar / quitar:
- **Áreas funcionales** (`AFAREAFUNCIONAL` × `AREAFUNCIONAL`)
- **Niveles ocupacionales** (`AFNIVELOCUPACIONAL` × `NIVELOCUPACIONAL`)
- **Ocupaciones CUOC** (`OCUPACIONCOUCAF` × `OCUPACIONCUOC`)

### 3.2 Sectores y Sub-sectores

**Endpoints:**
- `GET    /proyectos/:id/acciones/:afId/sectores` — lista los 4 bloques de sectores y la justificación
- `PUT    /proyectos/:id/acciones/:afId/sectores` — guarda la justificación cualitativa
- `POST/DELETE   /proyectos/:id/acciones/:afId/sectores-benef[/:psId]` — sectores beneficiarios
- `POST/DELETE   /proyectos/:id/acciones/:afId/subsectores-benef[/:pssId]` — subsectores beneficiarios
- `POST/DELETE   /proyectos/:id/acciones/:afId/sectores-af[/:saId]` — sectores de la AF
- `POST/DELETE   /proyectos/:id/acciones/:afId/subsectores-af[/:ssaId]` — subsectores de la AF

**Distinción importante:** "sectores beneficiarios" son los sectores económicos a los que pertenecen los beneficiarios. "Sectores de la AF" son los sectores que la propia acción de formación atiende (puede no coincidir si, por ejemplo, una empresa de manufactura capacita a beneficiarios del sector agrícola).

### 3.3 Unidades Temáticas

**Endpoints:**
- `GET    /proyectos/:id/acciones/:afId/habilidades` — habilidades del catálogo
- `GET    /proyectos/:id/acciones/:afId/unidades` — lista de UTs de la AF
- `POST   /proyectos/:id/acciones/:afId/unidades` — crea una nueva UT
- `GET    /proyectos/:id/acciones/:afId/unidades/:utId` — detalle de la UT
- `PUT    /proyectos/:id/acciones/:afId/unidades/:utId` — actualiza la UT
- `DELETE /proyectos/:id/acciones/:afId/unidades/:utId` — elimina la UT
- `POST/DELETE  /proyectos/:id/acciones/:afId/unidades/:utId/actividades[/:actId]` — actividades de la UT
- `POST/DELETE  /proyectos/:id/acciones/:afId/unidades/:utId/perfiles[/:perfilId]` — perfiles de instructor por UT

**Qué se captura:** una **Unidad Temática (UT)** es un módulo de contenido dentro de la AF (ej. "Excel intermedio", "Liderazgo de equipos remotos"). Cada UT tiene:
- Un nombre y horas de duración (presencial, virtual, etc. — distintas columnas según el tipo)
- Un objetivo y una descripción
- Lista de **actividades** que la componen (catálogo `ACTIVIDADUT`)
- Lista de **perfiles de instructor** que se requieren para impartirla, cada uno con su rubro asociado, horas de capacitación y días

Las UTs son el insumo principal para el cálculo posterior de los rubros (informe 20): los perfiles de instructor de cada UT se traducen en filas de costos en el presupuesto.

### 3.4 Alineación con la Convocatoria

**Endpoints:**
- `GET /proyectos/:id/acciones/:afId/alineacion` — datos actuales de la alineación
- `PUT /proyectos/:id/acciones/:afId/alineacion` — guarda la selección y los textos justificativos

**Qué se captura:** componente de la convocatoria al que se alinea la AF (catálogo `AFCOMPONENTE`, dependiente del tipo de convocatoria), descripción del componente, justificación de la alineación, resultados esperados de desempeño y de formación. El catálogo de componentes se filtra dinámicamente según la modalidad del proyecto y el tipo de convocatoria.

### 3.5 Grupos de Cobertura

**Endpoints:**
- `GET    /proyectos/:id/acciones/:afId/grupos` — lista de grupos de cobertura de la AF
- `POST   /proyectos/:id/acciones/:afId/grupos` — crea un nuevo grupo
- `DELETE /proyectos/:id/acciones/:afId/grupos/:grupoId` — elimina el grupo
- `PUT    /proyectos/:id/acciones/:afId/grupos/:grupoId/justificacion` — guarda la justificación del grupo
- `GET    /proyectos/:id/acciones/:afId/grupos/:grupoId/coberturas` — lista las filas de cobertura territorial del grupo
- `POST   /proyectos/:id/acciones/:afId/grupos/:grupoId/coberturas` — guarda la cobertura completa (departamento, ciudad, beneficiarios, modalidad, rural)

**Qué se captura:** un **grupo de cobertura** es un conjunto de beneficiarios agrupados geográficamente para la ejecución de la AF. Cada grupo tiene una justificación cualitativa y una matriz de cobertura: filas de departamento + ciudad + número de beneficiarios + modalidad de ejecución + indicador rural.

### 3.6 Material y Recursos

**Endpoints:**
- `GET    /proyectos/:id/acciones/:afId/material` — datos del bloque material
- `PUT    /proyectos/:id/acciones/:afId/material` — actualiza tipo de ambiente, gestión del conocimiento, material de formación, justificaciones e insumos
- `POST   /proyectos/:id/acciones/:afId/recursos` — agrega un recurso didáctico
- `DELETE /proyectos/:id/acciones/:afId/recursos/:rdafId` — quita un recurso

**Qué se captura:** tipo de ambiente de aprendizaje (presencial, laboratorio, aula virtual), gestión del conocimiento aplicada, material formativo principal, justificaciones del material y de los insumos, lista de recursos didácticos del catálogo.

### 3.7 Catálogos compartidos

| Endpoint | Catálogo |
|---|---|
| `GET /proyectos/enfoques` | Enfoques diferenciales |
| `GET /proyectos/areasfuncionales` | Áreas funcionales |
| `GET /proyectos/nivelesocu` | Niveles ocupacionales |
| `GET /proyectos/cuoc` | Ocupaciones CUOC |
| `GET /proyectos/sectoresaf` y `/subsectoresaf` | Sectores específicos de AF |
| `GET /proyectos/actividadesut` | Actividades de unidad temática |
| `GET /proyectos/:id/rubrosperfilut` | Rubros que pueden ser perfiles de instructor |
| `GET /proyectos/articulacionesterr` | Articulaciones territoriales |
| `GET /proyectos/retonacionales` y `/componentesreto/:retoId` | Retos nacionales y sus componentes |
| `GET /proyectos/afcomponentestipos` y `/afcomponentes/:tipo` | Componentes de la convocatoria por tipo |
| `GET /proyectos/departamentos` y `/ciudades/:deptoId` | División territorial |
| `GET /proyectos/tiposambiente`, `/gestionconocimientos`, `/materialformacion`, `/recursosdicacticos` | Material y recursos |

---

## 4. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/proyectos/[id]/acciones/[afId]/page.tsx` y subrutas para cada sección.

### Lo que hace la pantalla

- **Vista organizada por pestañas internas** correspondiente a las 6 secciones. Al cargar, todas las secciones reciben sus datos en una serie de peticiones paralelas; al moverse entre pestañas no se hacen viajes adicionales al servidor (los datos ya están en estado).
- **Persistencia REST instantánea** por cada acción del usuario: agregar un área, quitar un nivel, guardar la justificación de un grupo. No hay un botón "Guardar todo" — cada operación es atómica.
- **Sub-formularios contextuales** dentro de cada sección: para crear una nueva Unidad Temática se abre un sub-formulario sin salir de la pantalla; ese sub-formulario internamente hace POST y refresca solo la lista de UTs.
- **Validaciones en cliente** específicas por sección (por ejemplo: no se puede agregar un sector beneficiario si no hay un sector seleccionado en el dropdown).
- **Bloqueo cuando el proyecto está radicado**: como en los otros módulos del proyecto, todos los inputs se deshabilitan.
- **Indicadores de progreso** por sección que ayudan al usuario a saber qué le falta por completar antes de radicar el proyecto.

---

## 5. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | ~50 endpoints específicos de la formulación |
| `backend/src/proyectos/proyectos.service.ts` | Lógica de cada sección: getters, setters, agregar/quitar de listas |

El controlador y el servicio agrupan los endpoints por sección con comentarios de banda (`// ── Perfil de Beneficiarios ──`, `// ── Sectores ──`, etc.) para facilitar la navegación del código.

### Patrón general de cada sección

Casi todas las secciones siguen el mismo patrón:
1. Un `GET` que devuelve los campos de la sección + las listas asociadas (varias subqueries en paralelo).
2. Un `PUT` que actualiza los campos cualitativos en la fila de `ACCIONFORMACION` (o tabla relacionada).
3. Pares `POST + DELETE` para cada lista asociada (áreas, niveles, sectores, etc.).

Esto permite que el frontend tenga un componente reutilizable de "lista con dropdown + agregar / quitar" para cada bloque.

### Aislamiento por empresa

Igual que en el módulo de CRUD de AFs (informe 18): la pertenencia se verifica indirectamente vía el id del proyecto en la URL.

---

## 6. Modelo de datos

Las tablas involucradas son numerosas, agrupadas por sección:

| Sección | Tablas principales |
|---|---|
| Perfil de Beneficiarios | `ACCIONFORMACION` (campos), `AFENFOQUE`, `AFAREAFUNCIONAL`, `AFNIVELOCUPACIONAL`, `OCUPACIONCOUCAF` |
| Sectores | `PROYECTOSECTOR`, `PROYECTOSUBSECTOR` (beneficiarios), `SECTORAF`, `SUBSECTORAF` |
| Unidades Temáticas | `UNIDADTEMATICA`, `UNIDADTEMATICAACTIVIDAD`, `UNIDADTEMATICAPERFIL` |
| Alineación | `AFCOMPONENTE`, `ACCIONFORMACION` (campos `RESDESEM`, `RESFORM`) |
| Grupos de Cobertura | `GRUPOAF`, `GRUPOAFCOBERTURA` |
| Material | `ACCIONFORMACION` (campos), `RECURSODIDACTICOAF` |

### Catálogos del SENA

Más de una decena de tablas maestras (`AREAFUNCIONAL`, `NIVELOCUPACIONAL`, `OCUPACIONCUOC`, `SECTOR`, `SUBSECTOR`, `TIPOAMBIENTE`, `GESTIONCONOCIMIENTO`, `MATERIALFORMACION`, `RECURSODIDACTICO`, `RETONACIONAL`, `COMPONENTERETO`, `DEPARTAMENTO`, `CIUDAD`, `ARTICULACIONTERR`, etc.) son administradas por el SENA y no editables desde el aplicativo.

---

## 7. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador |
| `ParseIntPipe` en todos los `:id`, `:afId`, sub-ids | Rechazo temprano de IDs no numéricos |
| Pertenencia indirecta vía proyecto | El usuario solo conoce ids de su empresa |
| Bloqueo de mutaciones cuando el proyecto está radicado | El frontend deshabilita los inputs |
| `synchronize: false` (TypeORM) | Schema inmutable desde la app |

---

## 8. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Vista general de la AF con las 6 pestañas visibles | `/panel/proyectos/[id]/acciones/[afId]` |
| 2 | Sección Perfil de Beneficiarios completa con áreas, niveles y CUOC agregados | Pestaña "Perfil" |
| 3 | Sección Sectores con los 4 bloques poblados | Pestaña "Sectores" |
| 4 | Sección Unidades Temáticas con varias UTs en la lista | Pestaña "UTs" |
| 5 | Detalle de una UT: actividades + perfiles de instructor | Click en una UT |
| 6 | Sección Alineación con componente seleccionado y textos justificativos | Pestaña "Alineación" |
| 7 | Sección Grupos de Cobertura con un grupo y su matriz territorial | Pestaña "Grupos" |
| 8 | Sección Material y Recursos | Pestaña "Material" |
| 9 | Toast verde en cada acción (agregar área, agregar UT, etc.) | Capturar momento de cualquier POST |
| 10 | Vista con el proyecto radicado: todos los inputs deshabilitados | Después de radicar |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Formular Acción de Formación implementado

---

Cordial saludo,

Se informa que el **módulo de Formular Acción de Formación** del nuevo SEP, que unifica en una sola vista lo que en el SEP GeneXus estaba disperso entre múltiples pantallas con postbacks completos, ha sido finalizado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Perfil de Beneficiarios: enfoque diferencial, justificaciones de áreas funcionales y niveles ocupacionales, indicadores de poblaciones específicas (mujeres, campesinos, sector popular, trabajadores con discapacidad, BIC, mipymes, cadena productiva), y administración de las listas asociadas (áreas, niveles, ocupaciones CUOC)
- Sectores y Sub-sectores: 4 bloques independientes (sectores y subsectores beneficiarios + sectores y subsectores de la AF) con justificación cualitativa común
- Unidades Temáticas: creación, edición y baja de UTs, cada una con sus actividades del catálogo y sus perfiles de instructor (que después se traducen en rubros de costo)
- Alineación con la Convocatoria: selección del componente de convocatoria con catálogo dinámico según tipo, justificación de la alineación, resultados de desempeño y de formación
- Grupos de Cobertura: creación de grupos, justificación por grupo y matriz de cobertura territorial (departamento + ciudad + beneficiarios + modalidad + indicador rural)
- Material y Recursos: tipo de ambiente, gestión del conocimiento, material de formación, justificaciones, insumos y lista de recursos didácticos
- Persistencia REST instantánea por cada acción del usuario, sin botones "Guardar todo" que en el aplicativo viejo causaban pérdidas de datos por timeouts
- Carga de catálogos en paralelo y reutilización de datos en memoria al cambiar de pestaña, eliminando viajes redundantes al servidor

Se adjunta informe técnico con el detalle de los **~50 endpoints** del módulo y el modelo de datos por sección.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
