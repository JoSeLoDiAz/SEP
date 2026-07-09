# Plan técnico — Ajustes módulo Evaluadores (hallazgos Yerly)

**Autor:** análisis para Josse
**Fecha:** 2026-07-08
**Base:** correo Yerly Vargas 7/07/2026 + estructura actual del módulo (backend + frontend + propuesta 00)

---

## 0. Filosofía general antes de entrar en detalle

Cuatro decisiones que atraviesan todo el plan:

1. **Un solo patrón de "documento adjunto"**: en vez de crear una tabla nueva por cada tipo (cédula, autorización, confidencialidad, experiencias, certificados), todo en `EVALUADORDOCUMENTO` con `TIPODOCUMENTOEVALID` FK a catálogo. Excepción: la foto se queda en `EVALUADOR` (1:1, ya funciona).
2. **Aprobación por año como entidad de primera clase**: tabla `EVALUADORAPROBACION` con FK a año/convocatoria, aprobador estructurado y BLOB para el `.msg`. Se deprecia el `EVALUADORQUIENAPRUEBA` texto libre.
3. **Jefe directo estructurado en columnas de `EVALUADOR`** (no tabla aparte): 3 columnas, un jefe a la vez. Historial no está pedido — YAGNI. Se deprecia el `EVALUADORJEFEDIR` texto libre.
4. **Title Case como helper compartido** (`common/text/title-case.ts`) aplicado en `crear`/`actualizar` del service y en `onBlur` del formulario para feedback instantáneo. Sanitización en escritura, no en lectura — la BD queda limpia.

---

## 1. Modelo de datos — cambios propuestos

Numeración de migraciones asumiendo v21 como última existente.

### 1.1 Columnas nuevas en `EVALUADOR`

| Columna | Tipo | Propósito |
|---|---|---|
| `EVALUADORJEFENOMBRE` | NVARCHAR2(200) | Nombre completo del jefe directo |
| `EVALUADORJEFEEMAIL` | NVARCHAR2(150) | Correo institucional del jefe |
| `EVALUADORJEFECARGO` | NVARCHAR2(150) | Cargo del jefe |
| `MUNICIPIOID` | NUMBER(10) FK a `MUNICIPIO` | Municipio del evaluador (independiente de REGIONALID/CENTROID) |

**Migración:** `v22__evaluador_jefe_estructurado_y_municipio.sql`

**Razón:**
- Jefe directo: 3 columnas es lo mínimo que pide Yerly. NO tabla aparte porque no hay historial. El campo viejo `EVALUADORJEFEDIR` se deja por compatibilidad, se marca deprecado en el service.
- Municipio: el correo dice "cambiar el ID" del regional. Interpretación: NO reemplazar REGIONALID (que sigue siendo el departamento SENA), sino **agregar granularidad municipal**. Ya existe tabla `MUNICIPIO` (verificar en Oracle; si no, sub-migración `v22a` cargando divipola).

### 1.2 Tabla `EVALUADORDOCUMENTO` (genérica personal)

```sql
CREATE TABLE EVALUADORDOCUMENTO (
  DOCUMENTOID           NUMBER(10) PRIMARY KEY,
  EVALUADORID           NUMBER(10) NOT NULL,
  TIPODOCUMENTOEVALID   NUMBER(10) NOT NULL,   -- FK catálogo
  DOCUMENTODESCRIPCION  NVARCHAR2(300),        -- "Cédula 2024", "Cert. participación IE 2023"
  ANIOREFERENCIA        NUMBER(4),             -- útil para certificados por convocatoria
  ARCHIVOPDF            BLOB NOT NULL,
  ARCHIVOMIME           NVARCHAR2(120) NOT NULL,
  ARCHIVONOMBRE         NVARCHAR2(255),
  FECHACARGUE           DATE DEFAULT SYSDATE,
  CONSTRAINT FK_EVALDOC_EVAL FOREIGN KEY (EVALUADORID)         REFERENCES EVALUADOR,
  CONSTRAINT FK_EVALDOC_TIPO FOREIGN KEY (TIPODOCUMENTOEVALID) REFERENCES TIPODOCUMENTOEVAL
);
CREATE SEQUENCE EVALUADORDOCUMENTO_SEQ START WITH 1;
CREATE INDEX IX_EVALDOC_EVAL ON EVALUADORDOCUMENTO (EVALUADORID);
```

**Migración:** `v23__evaluador_documento_generico.sql`

**Razón:** replicar 5 veces el patrón estudios/experiencia/tic para documentos que no son entidades sino archivos con tipo es duplicar. El catálogo `TIPODOCUMENTOEVAL` gobierna qué tipos existen sin tocar código. Unicidad de la cédula se maneja en el service (chequear `ADMITEMULTIPLE=0` antes de insertar).

### 1.3 Catálogo `TIPODOCUMENTOEVAL`

```sql
CREATE TABLE TIPODOCUMENTOEVAL (
  TIPODOCUMENTOEVALID   NUMBER(10) PRIMARY KEY,
  CODIGO                NVARCHAR2(40) NOT NULL UNIQUE,
  NOMBRE                NVARCHAR2(120) NOT NULL,
  ADMITEMULTIPLE        NUMBER(1) DEFAULT 1,
  ORDEN                 NUMBER(3) DEFAULT 100,
  ACTIVO                NUMBER(1) DEFAULT 1
);
```

**Migración:** `v24__catalogo_tipo_documento_evaluador.sql`
Seed inicial: `CEDULA`, `AUTORIZACION`, `CONFIDENCIALIDAD`, `EXPERIENCIA_PROFESIONAL`, `EXPERIENCIA_PROYECTOS`, `CERTIFICADO_PARTICIPACION`.

**Razón:** catálogo, no enum en código. Si Yerly/Margiori piden un tipo nuevo → INSERT sin deploy. Mismo patrón de `TIPOESTUDIO` existente.

### 1.4 Tabla `EVALUADORAPROBACION`

```sql
CREATE TABLE EVALUADORAPROBACION (
  APROBACIONID           NUMBER(10) PRIMARY KEY,
  EVALUADORID            NUMBER(10) NOT NULL,
  ANIO                   NUMBER(4)  NOT NULL,
  CONVOCATORIAID         NUMBER(10),                    -- FK, nullable en fase 1
  APROBADORNOMBRE        NVARCHAR2(200) NOT NULL,
  APROBADOREMAIL         NVARCHAR2(150) NOT NULL,
  APROBADORCARGO         NVARCHAR2(150),
  FECHAAPROBACION        DATE NOT NULL,
  CORREOEVIDENCIA        BLOB,                          -- .msg
  CORREOEVIDENCIAMIME    NVARCHAR2(120),
  CORREOEVIDENCIANOMBRE  NVARCHAR2(255),
  OBSERVACIONES          NVARCHAR2(500),
  FECHACREACION          DATE DEFAULT SYSDATE,
  CONSTRAINT FK_APROB_EVAL FOREIGN KEY (EVALUADORID) REFERENCES EVALUADOR,
  CONSTRAINT UQ_APROB_EVAL_ANIO UNIQUE (EVALUADORID, ANIO)
);
CREATE SEQUENCE EVALUADORAPROBACION_SEQ START WITH 1;
```

**Migración:** `v25__evaluador_aprobacion.sql`

**Razón:**
- "Desplegable por año" → clave natural `(evaluador, año)`, por eso UNIQUE.
- Aprobador desnormalizado porque puede ser gente externa al SENA o alguien fuera de PERSONA. FK a PERSONA sería sobre-ingeniería.
- `.msg` como BLOB en la misma fila. Consistente con foto/PDFs (todo el módulo es BLOB, evita filesystem no persistente en Docker).
- `CONVOCATORIAID` nullable en fase 1 (año calendario), se popula cuando entre el módulo convocatorias.

### 1.5 Tablas `EVALUADORCONVOCATORIA` + `CONVOCATORIADOCUMENTO`

```sql
CREATE TABLE EVALUADORCONVOCATORIA (
  CONVOCATORIAID       NUMBER(10) PRIMARY KEY,
  ANIO                 NUMBER(4) NOT NULL,
  PERIODO              NCHAR(2),                    -- '01','02'
  NOMBRE               NVARCHAR2(200) NOT NULL,
  MODALIDADPART        NVARCHAR2(20),               -- PRESENCIAL/PAT/VIRTUAL
  FECHAINICIO          DATE,
  FECHAFIN             DATE,
  OBSERVACIONES        NVARCHAR2(500),
  ACTIVO               NUMBER(1) DEFAULT 1,
  FECHACREACION        DATE DEFAULT SYSDATE
);

CREATE TABLE CONVOCATORIADOCUMENTO (
  DOCUMENTOID          NUMBER(10) PRIMARY KEY,
  CONVOCATORIAID       NUMBER(10) NOT NULL,
  TIPODOCUMENTOCONVID  NUMBER(10) NOT NULL,
  DOCUMENTODESCRIPCION NVARCHAR2(300),
  ARCHIVOPDF           BLOB NOT NULL,
  ARCHIVOMIME          NVARCHAR2(120) NOT NULL,
  ARCHIVONOMBRE        NVARCHAR2(255),
  FECHACARGUE          DATE DEFAULT SYSDATE,
  CONSTRAINT FK_CONVDOC_CONV FOREIGN KEY (CONVOCATORIAID)      REFERENCES EVALUADORCONVOCATORIA,
  CONSTRAINT FK_CONVDOC_TIPO FOREIGN KEY (TIPODOCUMENTOCONVID) REFERENCES TIPODOCUMENTOCONV
);
```

**Migraciones:** `v26__evaluador_convocatoria.sql`, `v27__catalogo_tipo_documento_convocatoria.sql`
Seed catálogo: `INVITACION`, `RATIFICACION`, `LISTADO_ASISTENCIA_PRESENCIAL`, `LISTADO_ASISTENCIA_PAT`, `EXCEL_SELECCION`.

**Razón:** los documentos "generales" son **por convocatoria**, no por evaluador. Meterlos en el módulo evaluador rompe el modelo (¿en qué evaluador guardas la invitación general?). Entidad propia + tabla de documentos con el mismo patrón.

### 1.6 Resumen de migraciones

| # | Archivo | Contenido |
|---|---|---|
| v22 | `evaluador_jefe_estructurado_y_municipio.sql` | 4 columnas nuevas en EVALUADOR |
| v23 | `evaluador_documento_generico.sql` | Tabla EVALUADORDOCUMENTO + secuencia + índices |
| v24 | `catalogo_tipo_documento_evaluador.sql` | Tabla catálogo + seed 6 tipos |
| v25 | `evaluador_aprobacion.sql` | Tabla EVALUADORAPROBACION + secuencia |
| v26 | `evaluador_convocatoria.sql` | Tabla convocatoria + tabla documentos + secuencias |
| v27 | `catalogo_tipo_documento_convocatoria.sql` | Catálogo + seed 5 tipos |

**No hay migraciones destructivas.** `EVALUADORJEFEDIR` y `EVALUADORQUIENAPRUEBA` quedan en la BD y se dejan de escribir. Se pueden dropear en `v28` cuando estemos seguros.

---

## 2. Backend — endpoints nuevos y ajustes

Todo bajo `/evaluadores` con el mismo guard `PERFILES_GESTION = [1,2,15]` y `exigirGestion()`. Catálogos de escritura siguen exigiendo `PERFIL_ADMIN = 1`.

### 2.1 Documentos personales (genérico)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/evaluadores/:id/documentos` | Lista con join a catálogo. Query opcional `?tipo=CEDULA`. |
| POST | `/evaluadores/:id/documentos` | multipart `archivo` + `{ tipoDocumentoEvalId, descripcion?, anioReferencia? }`. Valida PDF, 8 MB, unicidad si `ADMITEMULTIPLE=0`. |
| GET | `/evaluadores/documentos/:docId/archivo` | Sirve BLOB inline. |
| GET | `/evaluadores/documentos/:docId/descargar` | Con `Content-Disposition: attachment` + nombre original. |
| DELETE | `/evaluadores/documentos/:docId` | Borra. |

Extraer el `MulterOptions.pdf()` a `common/multer.ts` para no duplicar.

### 2.2 Cédula (endpoint semántico atajo)

**Sin endpoint dedicado.** La cédula es un `TIPODOCUMENTOEVAL` más. El frontend usa `POST /documentos` con `tipoDocumentoEvalId = <id CEDULA>`.

Azúcar opcional: `GET /evaluadores/:id/cedula` — SELECT filtrado por CODIGO='CEDULA'. 15 minutos, hace la UI más limpia.

### 2.3 Aprobaciones por año

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/evaluadores/:id/aprobaciones` | Lista ordenada por año desc. Incluye `tieneEvidencia`. |
| POST | `/evaluadores/:id/aprobaciones` | multipart `evidencia` (opcional) + `{ anio, aprobadorNombre, aprobadorEmail, aprobadorCargo?, fechaAprobacion, observaciones? }`. Rechaza duplicados `(evaluador, anio)`. |
| PUT | `/evaluadores/aprobaciones/:aprobId` | Actualiza campos. |
| POST | `/evaluadores/aprobaciones/:aprobId/evidencia` | Sube/reemplaza `.msg`. |
| GET | `/evaluadores/aprobaciones/:aprobId/evidencia` | Descarga `.msg` con nombre original. |
| DELETE | `/evaluadores/aprobaciones/:aprobId/evidencia` | Borra solo el .msg. |
| DELETE | `/evaluadores/aprobaciones/:aprobId` | Borra registro completo. |

### 2.4 Jefe directo estructurado

**No endpoint nuevo.** Extender `ActualizarDto` con `jefeNombre`, `jefeEmail`, `jefeCargo`. El patrón UPDATE dinámico ya existente los toma automáticamente.

### 2.5 Municipio

- `GET /catalogos/municipios?regionalId=` — filtrado por regional.
- `GET /catalogos/municipios/buscar?q=` — typeahead (Colombia son ~1100 municipios, no cabe en un `<select>` plano).
- Extender `ActualizarDto` con `municipioId?: number | null`.
- `getFicha` agrega LEFT JOIN a MUNICIPIO.

### 2.6 Documentos generales por convocatoria (módulo nuevo)

Nuevo router `/evaluadores/convocatorias` (mantener namespace para no fragmentar auth):

| Método | Ruta | Qué hace |
|---|---|---|
| GET/POST | `/evaluadores/convocatorias` | Listado paginado + crear |
| GET/PUT | `/evaluadores/convocatorias/:cid` | Ficha + editar |
| GET/POST | `/evaluadores/convocatorias/:cid/documentos` | Listar/subir |
| GET | `/evaluadores/convocatorias/documentos/:docId/archivo` | Inline |
| GET | `/evaluadores/convocatorias/documentos/:docId/descargar` | Attachment |
| DELETE | `/evaluadores/convocatorias/documentos/:docId` | Borrar |
| GET | `/evaluadores/catalogos/tipos-documento-evaluador` | Catálogo |
| GET | `/evaluadores/catalogos/tipos-documento-convocatoria` | Catálogo |
| POST/PUT | `.../tipos-documento-*` | Admin |

### 2.7 Sanitización Title Case

Nuevo archivo `backend/src/common/text/title-case.ts`:

```ts
const PARTICULAS = new Set(['de','del','la','las','los','y','e','o','u','da','do','das','dos'])

export function aTitleCase(input?: string | null): string | null {
  if (input == null) return input
  const s = input.trim().toLowerCase()
  if (!s) return null
  return s.split(/\s+/).map((w, i) => {
    if (i > 0 && PARTICULAS.has(w)) return w
    // respeta apóstrofes (D'Angelo) y guiones (Ana-María)
    return w.split(/([-'])/).map(p =>
      /^[-']$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
    ).join('')
  }).join(' ')
}
```

**Puntos de aplicación** en `evaluadores.service.ts`:
- `crear` (~L292): antes del INSERT en PERSONA.
- `actualizar` (~L374): solo si el campo viene en el body.

**NO aplicar** a: emails (lowercase), identificación (números).

**Cargue histórico:** script one-shot `backend/scripts/normalizar-nombres-personas.ts` con `npx ts-node`. NO como migración porque PERSONA es transversal.

---

## 3. Frontend — secciones nuevas y ajustes

Base: `panel/evaluadores/[id]/page.tsx` (~1343 líneas) y `nuevo/page.tsx`.

### 3.1 Nuevos tabs

Actual: `datos | estudios | tic | experiencia | pruebas | participaciones`.
Propuesto: `datos | estudios | tic | experiencia | documentos | aprobaciones | pruebas | participaciones`.

Solo 2 tabs nuevos. La cédula NO es tab — vive dentro de `datos` como card al lado de la foto (identidad junta).

### 3.2 Sección Cédula (dentro del tab `datos`)

Componente `SeccionCedula` — copia adaptada de `SeccionFoto`:
- Card con icono `IdCard` de lucide.
- `tieneCedula ? <preview PDF o botón "Ver"> : <upload>`.
- Botones: **Subir/Reemplazar** (verde `#39a900`), **Descargar** (azul), **Eliminar** (rojo suave).
- Input file oculto `accept="application/pdf"`.
- Endpoint: `POST /evaluadores/:id/documentos` con `tipoDocumentoEvalId = idCedula`.

### 3.3 Sección Documentos personales (tab nuevo)

Componente `SeccionDocumentos`. Reutiliza el wrapper `ListadoConArchivos` ya existente para estudios/experiencia/TIC.

Diferencias:
- Header con **filtro por tipo** (chips: TODOS · AUTORIZACIÓN · CONFIDENCIALIDAD · EXP. PROFESIONAL · EXP. PROYECTOS · CERTIFICADO).
- Form de agregar: `tipoDocumentoEvalId` select, `descripcion` input, `anioReferencia` (solo si tipo = CERTIFICADO_PARTICIPACION), `file` PDF.
- Cada item: chip del tipo (color por tipo) + descripción + año + botones Ver/Descargar/Eliminar.

Cédula fuera de esta sección (evita confusión "por qué está aquí Y en Datos").

### 3.4 Sección Aprobaciones (tab nuevo)

Componente `SeccionAprobaciones`.

UI:
- Grid de **cards por año**, ordenadas descendente.
- Cada card: año grande (badge), aprobador (nombre/email/cargo), fecha, chip `Con evidencia` (verde) o `Sin evidencia` (amarillo).
- Botones por card: **Editar** (modal), **Descargar .msg**, **Reemplazar .msg**, **Eliminar**.
- Botón principal **"Nueva aprobación"** con form colapsable.

Validación cliente: no permitir agregar año duplicado.

### 3.5 Sección Datos — cambios

**Lectura:**
- `<Dato label="Regional / Centro">` → `Regional`, `Centro`, `Municipio` (3 datos).
- `<Dato label="Jefe directo">` texto → bloque de 3: nombre / correo / cargo.
- `<Dato label="Quién aprueba">` → chip "Ver aprobaciones →" que salta al tab.

**Edición:**
- Añadir `<MunicipioAutocomplete />` (typeahead contra `/catalogos/municipios/buscar`).
- Reemplazar inputs `jefeDirecto`/`quienAprueba` por 3 inputs (`jefeNombre`, `jefeEmail`, `jefeCargo`) bajo subheader "Jefe directo".
- Quitar input `quienAprueba` (se gestiona en tab aparte).
- **Title Case en `onBlur`** de nombres/apellidos. Copiar helper de backend en `frontend/src/lib/title-case.ts`.

**En `nuevo/page.tsx`:** mismos cambios. Opcional: warning si `jefeEmail` no matchea `@sena.edu.co|@misena.edu.co`.

### 3.6 Módulo Convocatorias (fase 5)

**Recomendación:** NO tab en el evaluador. Pantalla aparte en menú lateral: **"Banco > Convocatorias"** en `/panel/evaluadores/convocatorias`.

- `page.tsx` — listado tabla (año, período, nombre, modalidad, chips por documento cargado).
- `[cid]/page.tsx` — ficha con 2 tabs: `datos` + `documentos`.
- Documentos: chip por tipo con color (INVITACIÓN azul / RATIFICACIÓN morado / LISTADO PRESENCIAL cian / LISTADO PAT verde agua / EXCEL SELECCIÓN amarillo).

Beneficio: acceso 1 vez por año, no 1 vez por evaluador.

### 3.7 Pantallas frontend — resumen

| Pantalla | Estado | Cambios |
|---|---|---|
| `/evaluadores` (listado) | Existente | Opcional: badge "sin cédula" |
| `/evaluadores/nuevo` | Existente | 3 inputs jefe + municipio + Title Case onBlur |
| `/evaluadores/[id]` | Existente | Cédula en Datos, 2 tabs nuevos, jefe estructurado, municipio |
| `/evaluadores/convocatorias` | **Nueva** | Listado |
| `/evaluadores/convocatorias/nueva` | **Nueva** | Form crear |
| `/evaluadores/convocatorias/[cid]` | **Nueva** | Ficha + docs |

---

## 4. Roadmap por fases

Orden priorizado por **valor inmediato al cargue de Yerly**.

### Fase 1 — Foundations (S, ~2-3 días)

Objetivo: desbloquear el cargue actual de Yerly.

- Helper `aTitleCase` (backend + frontend).
- Aplicación en `crear`/`actualizar` service.
- `onBlur` Title Case en formularios.
- Script one-shot para normalizar histórico (no correr aún).
- Migraciones **v23, v24**: `EVALUADORDOCUMENTO` + catálogo con seed **solo CEDULA** (resto en fase 2).
- Endpoints `POST/GET/DELETE /evaluadores/:id/documentos` genéricos.
- Shortcut `GET /evaluadores/:id/cedula`.
- Componente `SeccionCedula` en tab Datos.

**Entregable:** Yerly puede subir cédulas + nombres nuevos entran normalizados.

### Fase 2 — Documentos personales completos (M, ~3-4 días)

Depende de fase 1.

- Ampliar seed de `TIPODOCUMENTOEVAL` (AUTORIZACION, CONFIDENCIALIDAD, EXPERIENCIA_PROFESIONAL, EXPERIENCIA_PROYECTOS, CERTIFICADO_PARTICIPACION).
- Endpoint `GET /catalogos/tipos-documento-evaluador` + admin CRUD.
- Nuevo tab `documentos` con `SeccionDocumentos`.
- Filtro por tipo (chips).

**Entregable:** Yerly deja de guardar experiencia/confidencialidad en Excel — todo en el sistema.

### Fase 3 — Jefe directo estructurado + Municipio (M, ~2-3 días)

Depende de fase 1 (independiente de fase 2).

- Migración **v22**: 4 columnas nuevas en `EVALUADOR`.
- Ampliar `ActualizarDto`, adaptar `getFicha`, endpoint municipios.
- Componente `MunicipioAutocomplete`.
- Reemplazar input `jefeDirecto` por 3 inputs.
- Script one-shot: intentar parsear `EVALUADORJEFEDIR` viejo a las 3 columnas (regex best-effort + log de fallos).

**Entregable:** datos jefe/municipio estructurados y buscables.

### Fase 4 — Aprobaciones por año (L, ~5-7 días)

Depende de fase 3.

- Migración **v25**: tabla `EVALUADORAPROBACION`.
- Endpoints CRUD aprobaciones + upload/descarga `.msg`.
- Manejo mime `.msg` (probar con archivos reales; validar por extensión con fallback si llega `application/octet-stream`).
- Nuevo tab `aprobaciones` con `SeccionAprobaciones`.
- Modal de edición.
- Script one-shot: migrar `EVALUADORQUIENAPRUEBA` texto → registros con `anio = YEAR(fechaCreacion)`.

**Entregable:** trazabilidad completa año por año con evidencia.

### Fase 5 — Convocatorias del banco (L, ~5-7 días)

**Independiente** — puede paralelizarse con fase 4.

- Migraciones **v26, v27**.
- Endpoints CRUD convocatorias + documentos.
- 3 pantallas nuevas frontend.
- Después, poblar `EVALUADORAPROBACION.CONVOCATORIAID` mediante script.

**Entregable:** gestión unificada de documentos generales por convocatoria.

### Fase 6 — Pruebas de conocimiento (bloqueado)

Esperar a Adri Peláez. Placeholder UI ya existe — solo enriquecer cuando se defina.

### Fase 7 — Cierre y limpieza (S, ~1 día)

- Migración **v28**: DROP `EVALUADORJEFEDIR` y `EVALUADORQUIENAPRUEBA` (después de ≥1 sprint sin quejas).
- Ejecutar script `normalizar-nombres-personas.ts` (con backup previo).
- Docs: README del módulo actualizado.

---

## 5. Preguntas / decisiones abiertas antes de codear

### Bloqueantes de arquitectura

1. **¿"Aprobación por año" es año calendario o por convocatoria?** Del correo se infiere calendario, pero si un evaluador aprueba dos veces en 2025 (01 y 02), ¿son dos? Propuesta: `UNIQUE(evaluadorId, anio, periodo)` con `periodo` opcional. **Confirmar con Yerly**.
2. **¿Los `.msg` como BLOB o filesystem?** Recomendación BLOB (consistente). Subir `MAX_MSG_BYTES = 20 MB` para este endpoint. **Confirmar con Josse**.
3. **¿"Cambiar el ID" del regional = reemplazar o agregar municipio?** Plan asume **agregar** MUNICIPIOID sin tocar REGIONALID (retrocompatible). Si era reemplazar → migración destructiva. **Preguntar directo a Yerly**.
4. **¿Documentos generales en `/evaluadores/convocatorias` o módulo separado "Banco"?** Recomendación: dentro. Confirmar con Josse.

### Bloqueantes de UX

5. **Title Case y partículas**: "María de los Ángeles" o "María De Los Ángeles"? Plan asume respeta partículas (`de/del/la/las/los/y`).
6. **Emails de aprobadores/jefes**: ¿institucionales obligatorios (`@sena.edu.co`)? Plan usa warning no bloqueo.
7. **Certificados de participación**: ¿un archivo por año o por convocatoria específica? Plan usa `ANIOREFERENCIA`. Si es por convocatoria, mejor FK a `EVALUADORPARTICIPACION`.

### No bloqueantes pero importantes

8. **Multirol (`USUARIOPERFIL`)**: ¿ya implementado?
9. **Perfil 15** (`PERFIL_GESTOR_EVALUADORES`): ¿existe en `PERFIL`? Código lo asume.
10. **Scripts one-shot**: ¿ejecutar en despliegue o manual? Recomendación: manual con logs.

---

## 6. Estimación integrada

| Métrica | Cantidad |
|---|---|
| Migraciones SQL | 6 (v22–v27) + 1 opcional cleanup (v28) |
| Tablas nuevas | 6 (`EVALUADORDOCUMENTO`, `TIPODOCUMENTOEVAL`, `EVALUADORAPROBACION`, `EVALUADORCONVOCATORIA`, `CONVOCATORIADOCUMENTO`, `TIPODOCUMENTOCONV`) |
| Columnas nuevas en tablas existentes | 4 en `EVALUADOR` |
| Endpoints nuevos backend | ~28 |
| Endpoints modificados | 3 (`getFicha`, `crear`, `actualizar`) |
| Componentes React nuevos | 5 + 3 pantallas convocatorias |
| Pantallas frontend nuevas | 3 |
| Pantallas frontend modificadas | 2 |
| Scripts one-shot | 3 |
| Helpers compartidos nuevos | 2 (`title-case.ts`, `multer-pdf.ts`) |

### Duración total estimada

| Fase | Tamaño | Días efectivos |
|---|---|---|
| Fase 1 | S | 2-3 |
| Fase 2 | M | 3-4 |
| Fase 3 | M | 2-3 |
| Fase 4 | L | 5-7 |
| Fase 5 | L | 5-7 |
| Fase 6 | Bloqueado | — |
| Fase 7 | S | 1 |
| **Total** | | **18-25 días** |

### Prioridad recomendada

**Empezar por Fase 1 esta semana.** Es la que desbloquea el cargue actual sin migrar nada destructivo. Fases 2 y 3 en paralelo la semana siguiente si hay dos personas. Fase 4 es la más grande y merece iteración propia con validación de Yerly a la mitad. Fase 5 espera confirmación de arquitectura. Fase 6 espera a Adri Peláez.
