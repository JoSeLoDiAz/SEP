# Propuesta — Módulo "Banco de Evaluadores" + Multirol

**Fecha:** 2026-05-05
**Autor:** Equipo TIC GGPC
**Documento de trabajo** para validación con Adriana y el equipo (no contractual).

---

## 1. Contexto y acuerdos

En la reunión con Adriana López, Carlos Adrián Peláez, Myriam Juliana, Yerly y Julio se acordó:

- Partir **desde la base de datos** para tener claro qué datos se cargan y qué información hace falta.
- Yerly elaboró una base de datos preliminar (Excel) con la información de un evaluador real (William Cardona) como **caso piloto** para validar la estructura.
- Las **encuestas de evaluación** solo tienen información desde 2024 — incluirlas, pero advertir que la cobertura es parcial.
- Adriana cierra: vamos a montar el **documento de requerimientos formal** (Juliana) y luego se programa el desarrollo.
- Carlos Adrián pidió: ir mostrando pantallazos durante el desarrollo para construir colectivamente el módulo.

Conclusión: **diseñamos el modelo de datos primero**, validamos con Adriana, y desarrollamos en iteraciones cortas con muestras visuales.

---

## 2. Análisis del Excel piloto (William Cardona)

El archivo `Base Banco Evaluadores 2026.xlsx` tiene **85 columnas** repetidas porque el formato actual mete cada año de participación como un bloque de 8 columnas (AÑO, ROL, MODALIDAD, PROCESO, PROYECTOS EVALUADOS, MESA, EQUIPO, DINAMIZADOR) en la misma fila — eso no escala y obliga a normalizar.

Adicionalmente, en la carpeta del evaluador encontramos:

```
William Alexander Cardona Perdomo/
├── William ... - Foto.jpg            ← foto de perfil
├── HV Y ESTUDIOS/                    ← 6 PDFs (HV, pregrado, posgrado, diplomados, proyectos)
├── EXPERIENCIA/                      ← certificados laborales
└── TICS/                             ← certificados de competencias TIC
```

Y en el Excel hay una **segunda hoja** con pruebas de conocimiento (puntajes, intentos, fechas) por año.

Esto se traduce a **6 entidades normalizadas** + adjuntos BLOB en BD.

---

## 3. Modelo de datos propuesto (Oracle)

> Nomenclatura coherente con el resto del SEP: tablas en mayúsculas, columnas con prefijo del nombre de la tabla, NCHAR/NVARCHAR2 para texto, BLOB para archivos.
>
> **Decisión clave:** se reusan las tablas existentes `PERSONA` y `USUARIO`. La tabla `EVALUADOR` es una **extensión 1:1 de PERSONA** que solo guarda lo específico del banco (centro, profesión, foto, etc.). Así no duplicamos cédula, nombre, correo, celular, ciudad, etc. — esos datos ya viven en `PERSONA`.

### 3.1 `EVALUADOR` — extensión de PERSONA con datos del banco

`PERSONA` ya guarda: nombres, apellidos, tipo doc, identificación, email, email institucional, celular, teléfono, dirección, ciudad, género, fecha nacimiento, estrato, etc.
`USUARIO` ya guarda: email, clave, perfil, estado, tipo. Se enlaza con `PERSONA` vía email (`USUARIO.USUARIOEMAIL = PERSONA.PERSONAEMAIL`).

`EVALUADOR` solo guarda **lo que NO está en PERSONA**:

| Columna | Tipo | Notas |
|---|---|---|
| `EVALUADORID` | `NUMBER` PK | Secuencia |
| `PERSONAID` | `NUMBER` FK PERSONA UNIQUE | 1:1 — datos básicos viven en PERSONA |
| `CENTROID` | `NUMBER` FK CENTROFORMACION | Centro al que pertenece |
| `REGIONALID` | `NUMBER` FK REGIONAL | Regional |
| `EVALUADORCARGO` | `NVARCHAR2(120)` | Ej: INSTRUCTOR G20 |
| `EVALUADORPROFESION` | `NVARCHAR2(200)` | Pregrado principal |
| `EVALUADORPOSGRADO` | `NVARCHAR2(400)` | Posgrado principal |
| `EVALUADOROTROSEST` | `NCLOB` | Otros estudios (texto libre) |
| `EVALUADORJEFEDIR` | `NVARCHAR2(200)` | Jefe directo |
| `EVALUADORQUIENAPRUEBA` | `NVARCHAR2(200)` | Quien aprueba la participación |
| `EVALUADORFOTO` | `BLOB` | **Foto de perfil en BD** (opcional, se puede subir luego) |
| `EVALUADORFOTOMIME` | `NVARCHAR2(40)` | image/jpeg, image/png |
| `EVALUADORACTIVO` | `NUMBER(1)` DEFAULT 1 | Activo/Inactivo en el banco |
| `FECHACREACION` | `TIMESTAMP` DEFAULT `SYSTIMESTAMP` | |

**Acceso del evaluador al sistema:** en la primera fase **el evaluador NO inicia sesión en el SEP**. El banco se gestiona internamente por el GGPC. La relación con `USUARIO` queda prevista (vía `PERSONA`) por si más adelante se decide darles acceso, pero no se crea cuenta en USUARIO al registrar un evaluador.

### 3.2 `EVALUADORPARTICIPACION` — historial por año/proceso (1:N)

Reemplaza las 64 columnas repetidas del Excel. Una fila por participación.

> **Aclaración importante:** el "Dinamizador" del Excel **no es el evaluador** — es una persona del **Grupo de Gestión (GGPC)** que dinamiza la evaluación. Por eso se modela como FK a `PERSONA`, no como bandera.

| Columna | Tipo | Notas |
|---|---|---|
| `PARTICIPACIONID` | `NUMBER` PK | |
| `EVALUADORID` | `NUMBER` FK EVALUADOR | |
| `ANIO` | `NUMBER(4)` | 2020, 2021, … |
| `PERIODO` | `NCHAR(2)` | '1', '2' o NULL |
| `ROLEVALUADORID` | `NUMBER` FK ROLEVALUADOR | Catálogo gestionado por admin (ver 3.8) |
| `MODALIDADPARTID` | `NUMBER` FK MODALIDAD | PRESENCIAL, PAT, VIRTUAL (catálogo) |
| `PROCESOID` | `NUMBER` FK PROCESOEVAL | Catálogo gestionado por admin (ver 3.9) |
| `PROCESOREVOCADO` | `NUMBER(1)` DEFAULT 0 | Bandera "Revocada" sobre el proceso |
| `PROYECTOSEVALUADOS` | `NCLOB` | Lista de proyectos evaluados |
| `MESA` | `NVARCHAR2(120)` | |
| `EQUIPOEVALUADOR` | `NVARCHAR2(120)` | |
| `DINAMIZADORPERSONAID` | `NUMBER` FK PERSONA | Persona del GGPC que dinamizó (NULL si no aplica) |
| `RETROALIMENTACION` | `NCLOB` | Retroalimentación del proceso |
| `OBSERVACIONES` | `NCLOB` | |

### 3.3 `EVALUADORESTUDIO` — HV, diplomas y certificados académicos

`TIPOESTUDIO` se modela como tabla de catálogo (ver 3.10) para que el admin pueda agregar tipos sin tocar código.

| Columna | Tipo | Notas |
|---|---|---|
| `ESTUDIOID` | `NUMBER` PK | |
| `EVALUADORID` | `NUMBER` FK EVALUADOR | |
| `TIPOESTUDIOID` | `NUMBER` FK TIPOESTUDIO | HV, Pregrado, Posgrado, Diplomado, Certificado, Otro |
| `ESTUDIOTITULO` | `NVARCHAR2(200)` | Nombre del título |
| `INSTITUCION` | `NVARCHAR2(200)` | |
| `FECHAGRADO` | `DATE` | Fecha completa del grado (ej: 22/07/2011) |
| `ARCHIVOPDF` | `BLOB` | PDF del soporte |
| `ARCHIVOMIME` | `NVARCHAR2(40)` | application/pdf |
| `ARCHIVONOMBRE` | `NVARCHAR2(200)` | Nombre original del archivo |
| `FECHACARGUE` | `TIMESTAMP` | |

### 3.4 `EVALUADOREXPERIENCIA` — certificados laborales

Cada cargo es una fila independiente. La HV (3.3) y la suma de todas estas experiencias se ven en la ficha del evaluador como acumulado de años.

| Columna | Tipo | Notas |
|---|---|---|
| `EXPERIENCIAID` | `NUMBER` PK | |
| `EVALUADORID` | `NUMBER` FK EVALUADOR | |
| `CARGOEXP` | `NVARCHAR2(200)` | |
| `ENTIDADEXP` | `NVARCHAR2(200)` | |
| `FECHAINICIO` | `DATE` | Fecha completa de inicio |
| `FECHAFIN` | `DATE` | Fecha completa de fin. NULL = vigente |
| `ARCHIVOPDF` | `BLOB` | Certificación laboral |
| `ARCHIVOMIME` | `NVARCHAR2(40)` | |
| `ARCHIVONOMBRE` | `NVARCHAR2(200)` | |

### 3.5 `EVALUADORTIC` — formación TIC complementaria

Se reusa la tabla existente `TIPOEVENTO` (curso, conferencia, diplomado, taller) para clasificar la formación.

| Columna | Tipo | Notas |
|---|---|---|
| `TICID` | `NUMBER` PK | |
| `EVALUADORID` | `NUMBER` FK EVALUADOR | |
| `TIPOEVENTOID` | `NUMBER` FK TIPOEVENTO | Curso / Conferencia / Diplomado / Taller |
| `TICNOMBRE` | `NVARCHAR2(200)` | "TIC para la gestión educativa" |
| `TICHORAS` | `NUMBER` | 80 |
| `FECHAFIN` | `DATE` | Fecha de finalización (opcional) |
| `ARCHIVOPDF` | `BLOB` | |
| `ARCHIVOMIME` | `NVARCHAR2(40)` | |
| `ARCHIVONOMBRE` | `NVARCHAR2(200)` | |

### 3.6 `EVALUADORPRUEBACONOCIMIENTO` — pruebas anuales

| Columna | Tipo | Notas |
|---|---|---|
| `PRUEBAID` | `NUMBER` PK | |
| `EVALUADORID` | `NUMBER` FK EVALUADOR | |
| `ANIO` | `NUMBER(4)` | |
| `PERIODO` | `NCHAR(2)` | 1, 2 o NULL |
| `FECHAPRESENTACION` | `DATE` | |
| `HORARIO` | `NVARCHAR2(40)` | "9-10 am" |
| `INTENTOS` | `NUMBER` | |
| `PUNTAJEMAYOR` | `NUMBER(5,2)` | Mayor puntaje obtenido |
| `PRUEBANUMERO` | `NUMBER` | Número de prueba si aplica |
| `EFECTIVIDAD` | `NUMBER(5,2)` | % efectividad |
| `CORRECTAS` | `NUMBER` | |
| `INCORRECTAS` | `NUMBER` | |
| `TOTALTIEMPO` | `NVARCHAR2(40)` | |
| `OBSERVACION` | `NVARCHAR2(400)` | |

### 3.7 (Opcional) `EVALUADORENCUESTA` — retroalimentación posterior a evaluar

Carlos mencionó que las encuestas solo existen desde 2024, así que esta tabla puede llegar después.

| Columna | Tipo | Notas |
|---|---|---|
| `ENCUESTAID` | `NUMBER` PK | |
| `EVALUADORID` | `NUMBER` FK EVALUADOR | |
| `PARTICIPACIONID` | `NUMBER` FK | A qué participación corresponde |
| `ANIO` | `NUMBER(4)` | |
| `PUNTAJE` | `NUMBER(5,2)` | |
| `RESPUESTAS` | `NCLOB` | JSON con respuestas |

### 3.8 `ROLEVALUADOR` — catálogo de roles del evaluador (gestionado por admin)

> No confundir con `PERFIL` (que es para login). Este catálogo es **el rol que cumplió en una evaluación específica**: EVALUADOR, ANALISTA, COORDINADOR, etc.

| Columna | Tipo | Notas |
|---|---|---|
| `ROLEVALUADORID` | `NUMBER` PK | |
| `ROLEVALUADORNOMBRE` | `NVARCHAR2(80)` UNIQUE | EVALUADOR, ANALISTA, COORDINADOR, ... |
| `ROLEVALUADORDESC` | `NVARCHAR2(200)` | Descripción opcional |
| `ROLEVALUADORACTIVO` | `NUMBER(1)` DEFAULT 1 | |

### 3.9 `PROCESOEVAL` — catálogo de procesos de evaluación (gestionado por admin)

| Columna | Tipo | Notas |
|---|---|---|
| `PROCESOID` | `NUMBER` PK | |
| `PROCESONOMBRE` | `NVARCHAR2(80)` UNIQUE | FCE, FEEC, ... |
| `PROCESODESC` | `NVARCHAR2(200)` | |
| `PROCESOACTIVO` | `NUMBER(1)` DEFAULT 1 | |

### 3.10 `TIPOESTUDIO` — catálogo de tipos de estudio (gestionado por admin)

| Columna | Tipo | Notas |
|---|---|---|
| `TIPOESTUDIOID` | `NUMBER` PK | |
| `TIPOESTUDIONOMBRE` | `NVARCHAR2(80)` UNIQUE | HV, Pregrado, Posgrado, Diplomado, Certificado, Otro |
| `TIPOESTUDIOACTIVO` | `NUMBER(1)` DEFAULT 1 | |

---

## 4. Multirol — un usuario, varios perfiles

### 4.1 ¿Por qué se necesita?

Hoy un `USUARIO` tiene **un único** `PERFILID` (FK a `PERFIL`). Eso obliga a crear cuentas duplicadas si una persona cumple varios roles (ej: `pc@correo.com` que es a la vez Empresa, Coordinador y Profesional de Seguimiento).

Con el módulo de Banco de Evaluadores se hace inevitable: la misma persona puede ser **Evaluador**, **Profesional de Seguimiento** y **Coordinador de Interventoría** según el momento.

### 4.2 Cambio en BD: tabla pivote `USUARIOPERFIL`

| Columna | Tipo | Notas |
|---|---|---|
| `USUARIOPERFILID` | `NUMBER` PK | Secuencia |
| `USUARIOID` | `NUMBER` FK USUARIO | |
| `PERFILID` | `NUMBER` FK PERFIL | |
| `PREDETERMINADO` | `NUMBER(1)` DEFAULT 0 | El que se sugiere al iniciar sesión |
| `ESTADO` | `NUMBER(1)` DEFAULT 1 | 1 = activo, 0 = revocado |
| `FECHAULTIMOACCESO` | `TIMESTAMP` | Última vez que el usuario entró usando este perfil — para ordenar el selector y para auditoría |
| `FECHACREACION` | `TIMESTAMP` DEFAULT `SYSTIMESTAMP` | |

`UNIQUE(USUARIOID, PERFILID)` para que no se duplique el mismo perfil al mismo usuario.

### 4.3 Migración (sin perder datos)

```sql
-- 1) Crear secuencia y tabla
CREATE SEQUENCE SEQ_USUARIOPERFIL START WITH 1 INCREMENT BY 1;
CREATE TABLE USUARIOPERFIL ( ... );

-- 2) Volcar el perfil actual de cada usuario como su perfil predeterminado
INSERT INTO USUARIOPERFIL (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO)
SELECT SEQ_USUARIOPERFIL.NEXTVAL, USUARIOID, PERFILID, 1, 1
  FROM USUARIO WHERE PERFILID IS NOT NULL;

-- 3) USUARIO.PERFILID se conserva durante la transición como "perfil predeterminado"
--    de fallback. Cuando todo el sistema use USUARIOPERFIL, se podrá eliminar.
```

**Compatibilidad:** durante la transición, todo el código actual sigue funcionando porque `USUARIO.PERFILID` no se toca. Los nuevos endpoints leen de `USUARIOPERFIL`.

**Pantalla de admin para gestionar roles:** se agrega en el panel de administración una vista donde el admin puede:

- Ver los perfiles asignados a un usuario.
- Agregar perfiles adicionales a un usuario existente.
- Revocar (no borrar) un perfil → `ESTADO = 0`.
- Cambiar cuál es el predeterminado.

### 4.4 Flujo de login propuesto

```
USUARIO → POST /auth/login (email + clave)
  ├─ Si tiene 1 solo perfil activo:
  │     → emite JWT directamente con ese perfil como activo
  │     → comportamiento idéntico al actual
  └─ Si tiene > 1 perfil activo:
        → responde { multirol: true, perfiles: [...], preauthToken: <jwt corto> }
        → frontend muestra pantalla de selección de perfil
        → usuario elige uno → POST /auth/seleccionar-perfil { preauthToken, perfilId }
        → emite JWT final con perfilActivo
```

**JWT payload** se mantiene casi igual, solo cambia la semántica de `perfilId` → `perfilActivo`. Sin breaking changes para los guards existentes.

**Botón "Cambiar perfil"** en el topbar (junto al avatar) que vuelve a la selección sin tener que cerrar sesión.

### 4.5 Pantalla de selección de perfil (mockup conceptual)

```
┌─────────────────────────────────────────────┐
│   Bienvenido, Pedro Pérez                   │
│   Selecciona con qué perfil deseas entrar   │
│                                             │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│   │ EMPRESA  │ │ COORDINA-│ │ EVALUADOR│   │
│   │          │ │ DOR GGPC │ │          │   │
│   │ predef.  │ │          │ │          │   │
│   └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────┘
```

---

## 5. Plan de trabajo propuesto

> **Decisión:** arrancamos con **Multirol** porque es lo más crítico para habilitar el módulo de evaluadores (un evaluador típico es a la vez Profesional de Seguimiento, Coordinador, etc.). Luego sigue el banco.

| Sprint | Entregable | Quién |
|---|---|---|
| **1 — esta semana** | DDL en Oracle: tabla `USUARIOPERFIL` + migración de `USUARIO.PERFILID` actuales | Equipo TIC |
| **2** | Backend auth: login con detección multirol + endpoint `/auth/seleccionar-perfil` + `/auth/cambiar-perfil` | Equipo TIC |
| **3** | Frontend: pantalla de selección de perfil + botón "Cambiar perfil" en topbar | Equipo TIC |
| **4** | Pantalla de admin para asignar/revocar perfiles a usuarios | Equipo TIC |
| **5** | DDL del banco (tablas 3.1–3.6 + catálogos 3.8–3.10) + sembrar piloto William Cardona | Equipo TIC |
| **6** | Backend NestJS: módulo `evaluadores` con CRUD + carga de archivos (BLOB) | Equipo TIC |
| **7** | Frontend: listado tipo "tarjetas con foto" + ficha del evaluador (pantallazo a Carlos) | Equipo TIC |
| **8** | Importador desde el Excel actual (carga masiva del histórico — campos opcionales se dejan vacíos) | Equipo TIC |
| **paralelo** | Documento formal de requerimientos | Juliana (TIC apoya si hace falta) |
| **continuo** | Pruebas con Carlos, Adriana y Jaime + ajustes | Todos |

---

## 6. Decisiones tomadas y preguntas pendientes

> Respuestas dadas por el usuario en validación de esta propuesta. Las que quedan abiertas se confirman con Adriana/Jaime/Carlos.

| # | Tema | Decisión |
|---|---|---|
| 1 | Foto del evaluador | **No obligatoria al crear** — se puede subir después |
| 2 | Roles del evaluador | **Catálogo gestionado por admin** (tabla `ROLEVALUADOR`, ver 3.8). No es lista fija en código |
| 3 | Procesos de evaluación | **Catálogo gestionado por admin** (tabla `PROCESOEVAL`, ver 3.9). "Revocada" se modela como bandera `PROCESOREVOCADO` sobre la participación, no como proceso aparte |
| 4 | Histórico desde 2021 (Carlos) | Sí se carga. Si la información está incompleta, **se sube lo que llegó y los campos opcionales quedan vacíos**. Solo se exige PK y campos obligatorios mínimos |
| 5 | Tope de tamaño por PDF | **8 MB por archivo** (no recargar la BD) |
| 6 | Quién accede al banco | **Coordinador** puede ver. **Admin** puede gestionar todo. Se crea un **nuevo perfil dedicado al banco de evaluadores** (nombre tentativo: `GESTOR BANCO EVALUADORES` — abierto a sugerencias del equipo). Otros perfiles se definen después |
| 7 | Validación de stakeholders | **Carlos Adrián, Adriana López y Jaime** (no estuvo en la reunión pero es actor importante por parte del stakeholder) |
| 8 | Multirol y código existente | Mientras no se cambien las llamadas actuales, la gestión sigue funcionando normal — sin breaking changes |
| 9 | Acceso del evaluador al SEP | **No tiene acceso en la fase inicial.** El banco lo gestiona el GGPC. Más adelante se decide si se les da cuenta |
| 10 | Capacidades del perfil Admin | **Total:** crear usuarios nuevos, asignar/revocar roles, crear nuevos perfiles, gestionar todos los catálogos del sistema (roles del evaluador, procesos, tipos de estudio, etc.) |
| 11 | Pantalla de selección de perfil | Aparece **siempre** que el usuario tenga más de un perfil activo. No se recuerda la última selección |

**Pendiente por confirmar con Adriana/Jaime/Carlos:**

- Combinaciones de perfiles que **NO** deban permitirse (ej: Empresa + Coordinador = posible conflicto de interés). **Se define después.**
- Nombre definitivo del perfil que gestiona el banco de evaluadores (tentativo: `GESTOR BANCO EVALUADORES`).

---

## 7. Resumen ejecutivo (1 minuto)

- **Reusamos PERSONA + USUARIO existentes** — no duplicamos cédula, nombre, correo, etc. `EVALUADOR` solo guarda lo específico del banco.
- **Catálogos gestionados por admin** (roles, procesos, tipos de estudio) en vez de listas fijas en código.
- **Foto y PDFs van en BD** (BLOB), tope 8 MB por archivo.
- **Multirol primero, banco después.** Multirol sin breaking changes — el código actual sigue funcionando durante la transición.
- **Validan: Carlos Adrián, Adriana, Jaime.** Iteración corta con pantallazos.

**Próximo paso concreto:** revisar este documento ajustado con los validadores, y arrancar con el DDL + migración de `USUARIOPERFIL`.
