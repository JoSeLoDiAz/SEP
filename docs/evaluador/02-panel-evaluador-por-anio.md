# Propuesta — Panel del Evaluador por año + absorción del módulo de Retroalimentación

**Fecha:** 2026-07-27
**Base:** estado real del módulo (migraciones v20–v28, `evaluadores.service.ts`, `panel/evaluadores/[id]/page.tsx`)
**Incorpora:** el sistema de retroalimentación 360° que vivía aparte en `FormularioInscripcionGGPC` (MongoDB + Express + Vue)
**Última revisión:** 2026-07-28

### Estado

| Fase | Alcance | Estado |
|---|---|---|
| **A** | Panel por año: rail, checklist de 9 hitos, estado sugerido | ✅ en uso |
| **B/C** | Aprobación del jefe, capacitación, proyectos evaluados, grupos | ✅ backend |
| **D** | Retroalimentación 360° completa (matriz, formulario, resultados, Excel, 3 pantallas) | ✅ verificada de punta a punta |
| **E** | Auditoría (`EVALUADORLOG`) + tab en la ficha | ✅ |
| **F** | Certificados: emisión, anulación, PDF, verificación pública y **descarga desde el panel público** | ✅ verificada de punta a punta |
| **G** | Listado con filtros por año/estado + sábana Excel del banco + ficha PDF | ✅ verificada de punta a punta |

**DDL aplicado:** v29–v38. La v36 (limpieza) ya corrió; ver el incidente en §9.
**Migraciones nuevas respecto de la versión anterior de este documento:** v38 (instrumento de 16 preguntas + etiquetas de escala). La fase G **no necesitó DDL**: se apoya en las tablas de v29–v37.

---

## 1. Diagnóstico — por qué el panel actual no da para lo que se pide

Hoy la ficha tiene 7 tabs planos: `datos · estudios · tic · experiencia · documentos · pruebas · participaciones`.

El problema no es la UI, es el **modelo**: hay **cuatro islas** que comparten un `ANIO` que es solo un número, sin relación entre ellas.

| Tabla | Campo de año | Relación con el resto |
|---|---|---|
| `EVALUADORPARTICIPACION` | `ANIO NUMBER(4)` | ninguna |
| `EVALUADORPRUEBA` | `ANIO NUMBER(4)` | ninguna |
| `EVALUADORDOCUMENTO` | `ANIOREFERENCIA NUMBER(4)` | ninguna |
| `EVALUADORCONVOCATORIA` | `ANIO NUMBER(4)` | **no tiene FK a EVALUADOR en absoluto** |

Y una quinta isla, en otro repositorio y otra base de datos: la **retroalimentación 360°** (`FormularioInscripcionGGPC`), que es justo el dato que responde *"¿cómo lo calificaron los demás?"*.

Consecuencias concretas:

- No se puede responder *"¿qué pasó con este evaluador en 2024?"* sin cruzar cuatro consultas a mano por número de año.
- `EVALUADORCONVOCATORIA` (v26) es una **carpeta de archivos huérfana**: guarda la invitación y la ratificación del año, pero nadie sabe qué evaluadores estuvieron ahí.
- `PROYECTOSEVALUADOS` es un **CLOB de texto libre** → no se puede contar, filtrar ni cruzar con `PROYECTO` / `CONVPROYGUARDADO`.
- `EVALUADORAPROBACION` (planeada como v25 en el doc 01) **nunca se creó** — la v25 terminó siendo jefe + municipio. Sigue vivo el texto libre `EVALUADORQUIENAPRUEBA`.
- La retroalimentación vive en **Mongo, con su propio login y su propia tabla de personas**, desconectada de `PERSONA`/`USUARIO`. Dos sistemas de identidad para la misma gente.

**La idea central:** convertir la participación de un año en una **entidad de primera clase con estado propio**, colgar de ella todo lo temporal, y **absorber el módulo de retroalimentación** dentro de esa estructura. Lo atemporal (HV, estudios, experiencia, TIC, cédula) se queda como está — ahí sí está bien.

---

## 2. La columna vertebral: `PARTICIPACION`, no `ANIO`

Tentación natural: usar `ANIO` como llave de agrupación. **No sirve**, porque el caso real es:

> En 2025 la misma persona fue **EVALUADOR en FCE periodo 1** y **ANALISTA en FEEC periodo 2**.

Un año puede tener N participaciones. Entonces:

```
EVALUADOR (persona, atemporal)
   │
   └── EVALUADORPARTICIPACION  ←── la columna vertebral (1 fila = 1 ciclo)
          │   anio, periodo, rol, proceso, modalidad, area, mesa, equipo, dinamizador
          │   convocatoriaId  →  EVALUADORCONVOCATORIA (docs generales del año)
          │   estadoPartId    →  ESTADOPARTICIPACION   (máquina de estados)
          │
          ├── EVALUADORPARTGRUPO        (grupos/mesas 1..8 de ese año)      [v34]
          ├── EVALUADORPARTALCANCE      (alcance del evaluador transversal) [v34]
          ├── EVALUADORAPROBACION       (autorización del jefe + .msg)      [v30]
          ├── EVALUADORCAPACITACION     (curso del año + nota + certificado)[v31]
          ├── EVALUADORPRUEBA           (+ participacionId, aprobada)       [v34]
          ├── EVALUADORDOCUMENTO        (+ participacionId)                 [v34]
          ├── EVALUADORPARTPROYECTO     (proyectos evaluados normalizados)  [v32]
          ├── EVALUADORCERTIFICADO      (emitido por el sistema)            [v37]
          │
          └── RETROASIGNACION / RETRORESPUESTA / RETROSESION                [v33]
                 └── la retroalimentación 360° que hoy vive en Mongo
```

La UI agrupa por año, pero el dato cuelga de `PARTICIPACIONID`. Un año con dos participaciones se ve como un año con dos tarjetas adentro.

### Regla de oro de los documentos: **propios vs. heredados**

Evita duplicar el mismo PDF en 80 evaluadores:

| Tipo | Dónde vive | Ejemplo |
|---|---|---|
| **General de la convocatoria** | `CONVOCATORIADOCUMENTO` (ya existe, v26) | Correo de invitación, ratificación, listado de asistencia, Excel de selección |
| **Propio del evaluador ese año** | `EVALUADORDOCUMENTO` con `PARTICIPACIONID` | Autorización del jefe, confidencialidad firmada |
| **Personal atemporal** | `EVALUADORDOCUMENTO` con `PARTICIPACIONID = NULL` | Cédula, HV, diplomas |

En el panel del año se muestran **los tres bloques juntos**, pero los heredados salen con chip gris `General de la convocatoria` y son de solo lectura. Un solo archivo, visible desde todos los evaluadores de ese año.

---

## 3. Máquina de estados del año

Cada participación tiene un **estado** y un **checklist derivado**.

### 3.1 Catálogo `ESTADOPARTICIPACION` (v29)

| Orden | Código | Nombre | Color | Final | Negativo |
|---|---|---|---|---|---|
| 10 | `POSTULADO` | Postulado / invitado | neutral | no | no |
| 20 | `AUTORIZADO` | Autorizado por el jefe | blue | no | no |
| 30 | `EN_FORMACION` | En curso de formación | indigo | no | no |
| 40 | `HABILITADO` | Habilitado (prueba aprobada) | cyan | no | no |
| 50 | `ASIGNADO` | Asignado a mesa/equipo | amber | no | no |
| 60 | `EVALUANDO` | Evaluando proyectos | orange | no | no |
| 70 | `FINALIZADO` | Finalizó la evaluación | green | sí | no |
| 80 | `CERTIFICADO` | Certificado emitido | green | sí | no |
| 90 | `DECLINO` | Declinó la invitación | neutral | sí | **sí** |
| 95 | `NO_APROBO` | No aprobó prueba/curso | red | sí | **sí** |
| 99 | `REVOCADO` | Participación revocada | red | sí | **sí** |

`REVOCADO` **reemplaza** la bandera `PROCESOREVOCADO NUMBER(1)`, que no distingue quién ni cuándo revocó.
`ESNEGATIVO = 1` excluye la participación de las métricas de desempeño — un año en que declinó no debe bajarle el promedio.

### 3.2 Checklist derivado (no se guarda, se calcula)

Nueve hitos que alimentan el anillo de progreso por año:

| # | Hito | Se cumple cuando |
|---|---|---|
| 1 | Invitación recibida | la convocatoria del año tiene doc `INVITACION` |
| 2 | Autorización del jefe | existe fila en `EVALUADORAPROBACION` |
| 3 | Confidencialidad firmada | doc `CONFIDENCIALIDAD` con ese `participacionId` |
| 4 | Curso de formación aprobado | `EVALUADORCAPACITACION.APROBADO = 1` |
| 5 | Prueba de conocimiento aprobada | `EVALUADORPRUEBA.APROBADA = 1` |
| 6 | Asignación (mesa + equipo + proceso) | los tres campos no nulos |
| 7 | Proyectos evaluados registrados | ≥1 fila en `EVALUADORPARTPROYECTO` |
| 8 | **Retroalimentación diligenciada** | sus `RETROASIGNACION` propias están todas en `ENVIADA` |
| 9 | Certificado emitido | fila vigente en `EVALUADORCERTIFICADO` |

Ventaja de que sea **derivado**: si la gestora sube el archivo, el hito se prende solo. Nadie marca casillas y el estado no puede mentir respecto de los datos.

`ESTADOPARTID` sí se guarda (es decisión humana: `DECLINO` no se deduce de nada), pero el backend expone además un `estadoSugerido` calculado del checklist y la UI avisa cuando divergen.

---

## 4. Absorción del módulo de Retroalimentación

Hoy la retroalimentación 360° vive en `FormularioInscripcionGGPC`: **MongoDB + Express + Vue**, con su propio login. Se trae al SEP completa.

### 4.1 Mapeo de colecciones → tablas (v33)

| Mongo | Oracle | Nota |
|---|---|---|
| `EvalPersona` | **desaparece** | Su `rol`/`area`/`grupos` son contexto POR AÑO y ya viven en `EVALUADORPARTICIPACION` + `EVALUADORPARTGRUPO`. Su identidad pasa a `PERSONA`/`USUARIO` |
| `EvalFormulario` | `RETROFORMULARIO` + `RETROPREGUNTA` | Versionado por convocatoria |
| `EvalAsignacion` | `RETROASIGNACION` | Ancla a `PARTICIPACIONID`, no a persona |
| `EvalSesion` | `RETROSESION` | Cronómetro de 60 min intacto |
| `EvalRespuesta` | `RETRORESPUESTA` + `RETRORESPUESTAITEM` | Items normalizados |
| `EvalSugerencia` | `RETROSUGERENCIA` | Pregunta general, una por sesión |

**La decisión que lo hace todo funcionar:** `RETROASIGNACION` y `RETRORESPUESTA` apuntan a `PARTICIPACIONID` (no a `EVALUADORID`). Por eso el resultado cae automáticamente en el año correcto de la ficha, y el mismo evaluador puede tener 4.6 en 2024 y 4.8 en 2025 sin ninguna lógica extra.

Las 12 preguntas del instrumento FCE se siembran como **plantilla base** (`CONVOCATORIAID = NULL`). Al abrir un ciclo, el backend **clona** la plantilla hacia la convocatoria del año — así editar las preguntas nunca altera el histórico ya diligenciado.

### 4.2 Cómo se resuelve el login (lo que preguntaste)

Hoy conviven **dos sistemas de autenticación**:

```
FormularioInscripcionGGPC
  ├─ requirePersona   → JWT propio { personaId, rol, area, grupos, esTransversal }
  │                     contra EvalPersona (email + bcrypt en Mongo)
  └─ requireEvalAdmin → JWT del sistema de convocatorias con rol === 'admin'
```

En el SEP queda **uno solo**, el estándar:

```
POST /auth/login  (USUARIO + USUARIOPERFIL — multirol ya implementado)
  ├─ 1 perfil activo  → JWT directo
  └─ >1 perfil activo → { multirol:true, preauthToken, perfiles[] }
                        → POST /auth/seleccionar-perfil
                        → JWT con perfilActivo
```

El JWT **no lleva** `rol`, `area` ni `grupos`. Eso es contexto del ciclo y se resuelve en el backend:

```
JWT.email  →  USUARIO  →  PERSONA  →  EVALUADOR
                                          │
                                          └─ EVALUADORPARTICIPACION del ciclo ABIERTO
                                                 ├─ ROLEVALUADORID   (era EvalPersona.rol)
                                                 ├─ AREAID           (era EvalPersona.area)
                                                 ├─ ESTRANSVERSAL    (era EvalPersona.esTransversal)
                                                 ├─ EVALUADORPARTGRUPO   (era .grupos[])
                                                 └─ EVALUADORPARTALCANCE (era .alcanceEvaluacion[])
```

Correspondencia de guards:

| FormularioInscripcionGGPC | SEP |
|---|---|
| `requirePersona` | `JwtAuthGuard` + resolver participación del ciclo abierto |
| `requireEvalAdmin` | `exigirGestion()` → perfiles `[1 admin, 2 coordinador, 15 gestor evaluadores]` |
| — (no existía) | `exigirAdmin()` → solo perfil 1, para los `DELETE` |

Casos que este diseño resuelve solo:

- **Evaluador sin participación en el ciclo abierto** → entra, ve su ficha histórica, no ve nada por diligenciar. Es el caso de quien fue evaluador en 2024 y no en 2026.
- **Persona con varios perfiles** (Evaluador + Profesional de Seguimiento) → el selector de perfil ya existente; al entrar como Evaluador ve su panel de retroalimentación.
- **Alguien que es evaluador y además coordinador del banco** → dos perfiles, dos vistas, cero cuentas duplicadas.

> ⚠️ **Cambio de decisión respecto del doc 00.** Ese documento fijó que *"el evaluador NO inicia sesión en el SEP en la fase inicial"*. Con la retroalimentación adentro eso ya no se sostiene: para diligenciar tiene que entrar. Al vincular un evaluador a un ciclo abierto, el backend crea (o reactiva) su `USUARIO` con perfil 9 = evaluador y le envía la clave por correo. Es el único cambio de alcance que introduce la absorción, y hay que confirmarlo con la coordinación.

### 4.3 El generador de la matriz

`helpers/eval/matriz.js` → `retro-matriz.service.ts`. El algoritmo se porta **1:1** (está validado contra el correo del área y ya corrió un ciclo real), con dos mejoras:

1. Las constantes `GRUPOS_TECNICOS` y `AREA_GRUPOS`, hoy hardcodeadas, salen a `RETROFORMULARIO.REGLASMATRIZ` (JSON) y a `AREAEVALUACION.GRUPOSDEFECTO`. Cambiar la topología de un año ya no necesita despliegue.
2. Cada par generado guarda `MOTIVOREGLA` (ej. `lider-tecnica→analistas-g1-6`). Cuando alguien pregunte *"¿por qué me tocó evaluar a esta persona?"*, la respuesta está en la fila.

Se conserva lo que ya estaba bien: `preview` antes de `generar`, dedupe por índice único, y el reporte de *quién quedó sin evaluar* y *quién quedó sin ser evaluado*.

`ORIGEN = MANUAL` permite al coordinador agregar un par que la regla no cubrió, sin tocar el motor.

### 4.4 Anonimato

`RETROFORMULARIO.RESULTADOANONIMO = 1` (por defecto).

- La fila **sí** guarda quién calificó — la coordinación necesita saber quién no diligenció, y sin eso no hay auditoría posible.
- El anonimato es de **presentación**: el backend nunca expone el nombre del calificador hacia el evaluado ni en su ficha. Muestra el origen (`Par evaluador`, `Líder`, `Apoyo técnico`).
- Solo perfil 1 y 2 pueden ver la trazabilidad completa, y esa consulta queda registrada en `EVALUADORLOG`.

Si el evaluado pudiera ver quién lo calificó, nadie calificaría honesto. Y si el sistema no lo guardara, nadie podría auditar. Por eso se separa el dato del permiso.

### 4.5 Qué se conserva del reporte Excel

`controllers/eval/reporte.js` genera 7 hojas. Se portan todas a `retro-reporte.service.ts` usando ExcelJS (el SEP ya lo usa en `convocatoria-proyectos`):

`1. Distribución · 2. Consolidado · 3. Detalle por par · 4. Comentarios · 5. Sugerencias del proceso · 6. Progreso y tiempos · 7. Matriz cruzada`

---

## 5. Cambios en base de datos

### 5.1 Tablas nuevas

| Migración | Tablas | Para qué |
|---|---|---|
| **v29** | `ESTADOPARTICIPACION`, `MODALIDADPART`, `AREAEVALUACION` (+ amplía `ROLEVALUADOR`) | catálogos del ciclo |
| **v30** | `EVALUADORAPROBACION` | autorización del jefe + `.msg` |
| **v31** | `EVALUADORCAPACITACION` | curso del año, nota y certificado |
| **v32** | `EVALUADORPARTPROYECTO` | proyectos evaluados normalizados |
| **v33** | `RETROFORMULARIO`, `RETROPREGUNTA`, `RETROASIGNACION`, `RETROSESION`, `RETRORESPUESTA`, `RETRORESPUESTAITEM`, `RETROSUGERENCIA` | módulo de retroalimentación |
| **v34** | `EVALUADORPARTGRUPO`, `EVALUADORPARTALCANCE` (+ 22 columnas y el backfill) | la columna vertebral |
| **v35** | `EVALUADORLOG` | auditoría |
| **v37** | `EVALUADORCERTIFICADO` | emisión del certificado |

**Total: 15 tablas nuevas, 3 catálogos, ~30 columnas nuevas.**

### 5.2 Detalles que importan

**`EVALUADORPARTPROYECTO`** referencia el proyecto en cascada de tres formas, para que el histórico 2021–2023 entre sin bloqueo:
`PROYECTOID` (proyecto ejecutado) → `GUARDADOID` (solo formulado, v28) → `NIT` + `NOMBREPROYECTO` (texto).
Habilita de golpe: *"¿cuántos proyectos evaluó tal persona?"*, *"¿qué evaluadores tocaron el proyecto X?"*, *"¿carga por mesa?"*.

**`PARTICIPACIONID` es nullable** en `EVALUADORPRUEBA` y `EVALUADORDOCUMENTO`: el histórico 2021–2023 que conserva la coordinación entra sin participación asociada y se ata después. Nada bloquea el cargue.

**Notas de corte congeladas.** `EVALUADORPRUEBA.PUNTAJEMINIMO` y `EVALUADORCAPACITACION.CALIFICACIONMINIMA` se copian de la convocatoria al crear el registro. Si el año siguiente sube el corte, el histórico no se reescribe solo.

**`EVALUADORCAPACITACION.ORIGEN`** distingue `EXTERNO` (resultado cargado desde Territorium/Blackboard) de `SISTEMA` (curso dictado dentro del SEP). Hoy solo se usa `EXTERNO`; cuando el curso se lleve al SEP no hay que migrar nada.

### 5.3 Qué se elimina de la BD (v36, diferida)

| Objeto | Por qué se va | A dónde va el dato |
|---|---|---|
| `EVALUADORPARTICIPACION.PROYECTOSEVALUADOS` (CLOB) | texto libre no consultable | `EVALUADORPARTPROYECTO` (split automático en v32) |
| `EVALUADORPARTICIPACION.PROCESOREVOCADO` | bandera sin quién/cuándo | estado `REVOCADO` + `MOTIVONOPARTICIPA` |
| `EVALUADORPARTICIPACION.MODALIDADPART` (texto) | string suelto en dos tablas | FK a `MODALIDADPART` (backfill en v34) |
| `EVALUADORCONVOCATORIA.MODALIDADPART` (texto) | ídem | ídem |
| `EVALUADOR.EVALUADORQUIENAPRUEBA` | texto libre | `EVALUADORAPROBACION` (rescate en v34 §5.6) |
| `EVALUADOR.EVALUADORJEFEDIR` | ya reemplazado por v25 | rescate best-effort a `JEFENOMBRE` |
| `EVALUADOR.EVALUADOROTROSEST` (CLOB) | duplica `EVALUADORESTUDIO` | nada — el dato ya está estructurado |

La v36 **arranca con una verificación previa** que aborta con `RAISE_APPLICATION_ERROR` si algún contador no cuadra. No se puede correr por accidente.

**Qué NO se toca (a propósito):**

- `EVALUADORPROFESION` / `EVALUADORPOSGRADO` — resumen para listado, búsqueda y PDF. Se conservan, pero el formulario los autosugiere desde `EVALUADORESTUDIO`.
- `MESA` / `EQUIPOEVALUADOR` — texto libre a propósito: la nomenclatura cambia cada año y un catálogo que nadie mantiene es peor que texto. El dato estructurado del grupo ya está en `EVALUADORPARTGRUPO`.
- **No** se unifican `EVALUADORESTUDIO` / `EXPERIENCIA` / `TIC`. Comparten el patrón BLOB pero tienen metadata distinta; el refactor no le entrega nada al usuario.

### 5.4 Auditoría (v35) — acceso para la coordinación

Ninguna tabla del módulo registraba quién creó o modificó qué. Para un módulo que guarda autorizaciones de jefes, calificaciones de desempeño y certificados oficiales, eso no es aceptable.

Dos capas:

1. **Columnas** `USUARIOCREACION`, `FECHACREACION`, `USUARIOMODIFICACION`, `FECHAMODIFICACION` en cada tabla nueva y en las de v20–v28 que no las tenían.
2. **`EVALUADORLOG`** — calcado de `EJECUCIONLOG` (v17, ya probado en producción). Guarda tabla, operación, id, usuario, perfil, fecha y snapshots JSON antes/después.

**La tabla es inmutable desde la aplicación**: `SEP_APP` tiene `SELECT, INSERT` y nada más. Sin `UPDATE` ni `DELETE`. Eso es lo que la hace válida como auditoría.

**Qué se registra** (y qué no, para que el log sirva y no sea ruido):

| Se registra | No se registra |
|---|---|
| Aprobaciones del jefe (alta, cambio, baja) | Cargue de documentos |
| Cambios de calificación del curso | Lecturas |
| Cambios de estado del ciclo | Consultas de catálogos |
| Cambios de puntaje de prueba | Navegación |
| Respuestas de retroalimentación modificadas tras el envío | |
| Generación y anulación de la matriz | |
| Emisión y anulación de certificados | |
| Consulta de la trazabilidad de una retroalimentación anónima | |

### 5.5 Permisos — un solo nivel para todo el módulo

**Decisión (2026-07-28):** las interfaces del gestor de evaluadores son **iguales para todos**, con la misma funcionalidad. No hay funciones repartidas por perfil dentro del módulo.

| Quién | Alcance |
|---|---|
| Admin (1) · Coordinador (2) · Gestor Evaluadores (15) | **Todo el módulo**: fichas, ciclos, documentos, matriz, resultados, reporte Excel, certificados y auditoría |
| Solo Admin (1) | Catálogos del sistema (roles, procesos, tipos de estudio y de documento) |
| Evaluador (9) | Solo lo suyo: su ciclo abierto y su formulario de retroalimentación |

Se probó primero con las funciones repartidas — reporte y auditoría solo para coordinación, certificados solo para admin — y se revirtió: repartirlas obligaba a que dos personas se turnaran para completar un mismo trámite. Quien gestiona el banco lo gestiona completo.

**Los límites que quedan no son de permiso sino de integridad**, y aplican igual a todos:

| Límite | Por qué |
|---|---|
| Un ciclo **con certificado emitido** no se borra, ni forzando | `SEP_APP` no tiene `DELETE` sobre `EVALUADORCERTIFICADO` (v37). Sin este chequeo el borrado forzado reventaba con `ORA-02292` a mitad de la transacción, tras haber borrado media historia |
| Un ciclo **con historia** responde `409` con el detalle de lo que cuelga | Obliga a decidir conscientemente entre anular por estado o arrastrar la historia |
| Al forzar, **pruebas y documentos no se borran** | Son del evaluador, no del ciclo: se desatan y sobreviven como histórico suelto |
| El **log de auditoría** no se modifica ni se borra | `SEP_APP` solo tiene `SELECT, INSERT`. Un log que la aplicación puede reescribir no sirve como auditoría |

**Sobre el anonimato con permisos unificados.** Cualquiera que gestione el banco puede consultar quién calificó a quién. Lo que no cambia es lo que protege el instrumento: **el evaluado nunca lo ve**. Y cada consulta de identidad queda registrada en `EVALUADORLOG`.

---

## 6. Casos reales que hay que soportar

| # | Caso | Cómo lo resuelve el modelo |
|---|---|---|
| 1 | Dos participaciones el mismo año (FCE p1 + FEEC p2) | año = grupo de N tarjetas, no una tarjeta |
| 2 | Cambia de rol a mitad del año | dos participaciones con `FECHAINICIO/FIN` distintas |
| 3 | Lo invitan, autoriza el jefe, pero **no aprueba la prueba** | estado `NO_APROBO`; el año existe, con documentos, sin proyectos |
| 4 | Lo invitan y **declina** | estado `DECLINO` + `MOTIVONOPARTICIPA`; `ESNEGATIVO` lo saca del promedio |
| 5 | Le **revocan** el proceso a mitad de camino | estado `REVOCADO`; los proyectos ya evaluados se conservan |
| 6 | Años sin participación (2022 en blanco) | el rail muestra el gap explícito, no comprime la línea de tiempo |
| 7 | Histórico 2021–2023 solo con prueba | `EVALUADORPRUEBA.PARTICIPACIONID = NULL` → año suelto con badge `Solo prueba` |
| 8 | Confidencialidad firmada una vez que aplica a varios años | `PARTICIPACIONID = NULL` → chip `Permanente` |
| 9 | Mismo PDF de invitación para 80 evaluadores | vive en `CONVOCATORIADOCUMENTO`, se hereda; no se duplica |
| 10 | Evaluador que además fue **dinamizador** de otro | `DINAMIZADORPERSONAID` ya apunta a `PERSONA`; vista inversa en la ficha |
| 11 | Persona que es Evaluador y Coordinador (multirol) | selector de perfil; una sola `PERSONA`, un solo `USUARIO` |
| 12 | Retroalimentación anónima | `RESULTADOANONIMO = 1`; solo perfiles 1 y 2 ven la traza, y queda en el log |
| 13 | Proyecto evaluado que no existe en el sistema (2021) | fila con `NOMBREPROYECTO` + `NIT` de texto, sin FK |
| 14 | Se corrige un puntaje cargado mal | `EVALUADORLOG` guarda antes/después |
| 15 | Evaluador desactivado con histórico | `EVALUADORACTIVO = 0` no borra nada; trayectoria de solo lectura |
| 16 | **Transversal** que evalúa varias áreas (ej. Natalia) | `ESTRANSVERSAL = 1` + `EVALUADORPARTALCANCE` |
| 17 | **Apoyo jurídico en grupos técnicos** (ej. Fernanda [1,2,8]) | `EVALUADORPARTGRUPO` con tres filas; el motor aplica reglas técnicas y jurídicas |
| 18 | El evaluador se pasa de los 60 min diligenciando | `RETROSESION.SEEXCEDIO = 1`; informativo, no bloquea el envío |
| 19 | Se cambia una pregunta del instrumento a mitad de ciclo | las respuestas ya enviadas apuntan a `RETROPREGUNTAID` y a un `PUNTAJEMAXIMO` congelado |
| 20 | Un par que la regla no generó y sí hacía falta | `RETROASIGNACION` con `ORIGEN = MANUAL` |
| 21 | Certificado emitido con un dato que después se corrige | `DATOSSNAPSHOT` congela el contenido; la reimpresión es idéntica |
| 22 | Certificado emitido por error | `ANULADO = 1` + motivo; nunca se borra; el consecutivo no se reutiliza |

---

## 7. API

Regla: **una llamada por pantalla**, no N+1 desde el front.

### Panel del evaluador

| Método | Ruta | Devuelve |
|---|---|---|
| `GET` | `/evaluadores/:id/resumen` | KPIs del hero: años activos, participaciones, proyectos evaluados, promedio de retroalimentación, estado de prueba vigente |
| `GET` | `/evaluadores/:id/trayectoria` | `[{ anio, participaciones: [{ ...cabecera, estado, estadoSugerido, progreso: {cumplidos, total, hitos[]}, contadores }] }]` |
| `GET` | `/evaluadores/participaciones/:pid` | detalle del año: ficha + aprobación + capacitación + pruebas + documentos propios y heredados + proyectos + retroalimentación recibida |
| `POST/PUT/DELETE` | `/evaluadores/participaciones/:pid/aprobacion` | + `/evidencia` para el `.msg` |
| `POST/PUT/DELETE` | `/evaluadores/participaciones/:pid/capacitacion` | multipart con el certificado |
| `GET/POST/DELETE` | `/evaluadores/participaciones/:pid/proyectos` | typeahead contra `PROYECTO` y `CONVPROYGUARDADO` |
| `PUT` | `/evaluadores/participaciones/:pid/estado` | cambio con motivo → `EVALUADORLOG` |
| `GET/POST` | `/evaluadores/participaciones/:pid/grupos` | grupos/mesas del año |
| `GET` | `/evaluadores/:id/ficha.pdf` | ficha completa imprimible |
| `GET` | `/evaluadores/reportes/banco.xlsx` | sábana filtrable por año/estado/proceso/regional |

### Retroalimentación

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/retroalimentacion/mi-ciclo` | evaluador — su participación en el ciclo abierto |
| `GET` | `/retroalimentacion/mis-asignaciones` | evaluador — a quiénes debe retroalimentar |
| `GET` | `/retroalimentacion/formulario` | evaluador — preguntas del ciclo |
| `POST` | `/retroalimentacion/sesion` | evaluador — inicia el cronómetro |
| `GET` | `/retroalimentacion/sesion/:sid` | evaluador — hidrata al recargar |
| `POST` | `/retroalimentacion/sesion/:sid/enviar` | evaluador — envía todo |
| `GET` | `/retroalimentacion/convocatorias/:cid/matriz/preview` | gestión — simula sin escribir |
| `POST` | `/retroalimentacion/convocatorias/:cid/matriz/generar` | gestión — persiste los pares |
| `POST` | `/retroalimentacion/asignaciones` | gestión — par manual |
| `PUT` | `/retroalimentacion/asignaciones/:aid/anular` | gestión |
| `GET` | `/retroalimentacion/convocatorias/:cid/avance` | gestión — quién ha diligenciado |
| `GET` | `/retroalimentacion/convocatorias/:cid/reporte.xlsx` | gestión — las 7 hojas |
| `GET` | `/retroalimentacion/participaciones/:pid/resultados` | gestión — con o sin nombres según perfil |

### Certificados y auditoría

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/evaluadores/participaciones/:pid/certificado` | gestión — emite |
| `GET` | `/evaluadores/certificados/:cid/pdf` | gestión — descarga desde la ficha |
| `PUT` | `/evaluadores/certificados/:cid/anular` | gestión |
| `GET` | `/publico/certificados/:codigo` | **público, sin auth** — valida autenticidad |
| `GET` | `/certificados?tipoDocumento=&numero=` \| `?codigo=` | **público, sin auth** — el evaluador busca y descarga el suyo |
| `GET` | `/certificados/evaluador/:cid/pdf?personaId=` | **público, sin auth** — descarga desde el panel público |
| `POST` | `/evaluadores/convocatorias/:cid/certificados/lote` | emisión masiva del ciclo |
| `GET` | `/evaluadores/:id/auditoria` | gestión — log de la ficha |
| `GET` | `/evaluadores/auditoria` | gestión — log global con filtros |

#### El evaluador descarga su certificado donde ya lo hace el beneficiario

La página pública `/certificados` era solo para beneficiarios de una acción de formación. Ahora devuelve **las dos cosas**: quien entra teclea su cédula y ve todo lo que le corresponde, sin tener que saber de antemano en qué calidad participó ni entrar por dos pantallas distintas. Es frecuente ser ambas cosas.

| | Beneficiario | Evaluador |
|---|---|---|
| Origen | `AFGRUPOBENEFICIARIO` (`CERTIFICA='SI'` y `VALIDACIONINTERVENTOR='VERIFICADO'`) | `EVALUADORCERTIFICADO` con `ANULADO = 0` |
| Entidad | razón social de la empresa | SENA — GGPC |
| Certificado por | acción de formación | rol · convocatoria (del snapshot v37) |
| Código | `EVIDENCIAVALIDACION` | `CODIGOVERIFICACION` |
| Descarga | `/certificados/:id/pdf?personaId=` | `/certificados/evaluador/:cid/pdf?personaId=` |

Decisiones que conviene no deshacer:

- **La fila es genérica** (`entidad`, `concepto`, `detalle`), no `empresaRazonSocial` / `accionFormacionNombre`. Un certificado de evaluador no tiene ni empresa ni acción de formación; forzarlo a esos nombres obligaba a la pantalla a interpretar cada campo según el tipo. El backend arma también la `urlPdf`, porque cada tipo tiene la suya.
- **El PDF se reusa, no se reimplementa.** `CertificadosModule` importa `EvaluadoresModule` para llamar a `CertificadoService.getPdf`. Duplicar el generador habría creado dos versiones del mismo documento oficial, que es justo lo que la v37 evita congelando el snapshot.
- **El código del evaluador se busca por igualdad, no por `LIKE`.** El del beneficiario usa substring por compatibilidad con el GeneXus; replicarlo aquí permitiría pescar certificados ajenos tecleando un prefijo corto. `UQ_CERT_CODIGO` garantiza que la igualdad basta.
- **Anulado = invisible.** No aparece en la lista y la descarga responde 404, revalidado en el momento del clic: entre la búsqueda y la descarga pudo anularse.
- **`personaId` es obligatorio en la descarga**, igual que en la del beneficiario. Sin él, un `CERTIFICADOID` secuencial bastaría para bajarse cualquier certificado del sistema.

> El modelo de exposición es el mismo que ya tenían los beneficiarios: quien conoce una cédula puede listar y descargar sus certificados de participación. Es deliberado —son documentos de autoservicio— pero conviene tenerlo presente si alguna vez se endurece el acceso: hay que endurecer las dos rutas a la vez.

---

## 8. Frontend — rediseño del panel

### 8.1 Dos niveles, no siete tabs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◀ Banco de Evaluadores / Ficha                                             │
│  ┌────┐  MARTA ELENA RÍOS VARGAS                      [Activo]  [Ficha PDF] │
│  │foto│  CC 10.000.001 · Instructor G20 · Centro X                          │
│  └────┘  ┌──────────┬──────────┬──────────┬──────────┬──────────┐           │
│          │ 6 años   │ 8 partic.│ 47 proy. │ 4.6 / 5  │ Prueba   │           │
│          │ activo   │          │ evaluados│ retroal. │ vigente ✓│           │
│          └──────────┴──────────┴──────────┴──────────┴──────────┘           │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ TRAYECTORIA ]   [ Perfil ]   [ Documentos ]   [ Auditoría ]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Trayectoria** *(tab por defecto)* — todo lo que es por año.
- **Perfil** — lo atemporal: datos, HV y estudios, experiencia, TIC. Sub-tabs internos.
- **Documentos** — cédula + documentos personales permanentes.
- **Auditoría** — `EVALUADORLOG` filtrado. Solo perfiles 1 y 2.

Los tabs actuales `estudios/tic/experiencia` no desaparecen: se vuelven sub-tabs de *Perfil*, que es donde conceptualmente van.

### 8.2 Trayectoria — rail de años + panel del año

```
┌──────────────────┬──────────────────────────────────────────────────────────┐
│  2026            │  2024 · Periodo 1                        ⟨ ● HABILITADO ⟩│
│  ● EVALUADOR     │  ┌────────────────────────────────────────────────────┐  │
│    FCE · Presenc.│  │  ◐ 7/9         Rol        EVALUADOR                │  │
│    ▓▓▓▓▓▓▓░ 7/9  │  │   progreso     Área       Técnica · Grupos 1, 2    │  │
│                  │  │                Proceso    FCE                      │  │
│  2025            │  │                Modalidad  PRESENCIAL               │  │
│  ● EVALUADOR     │  │                Mesa       Mesa 3 · Equipo B        │  │
│    FCE · PAT     │  │                Dinamizó   Myriam Juliana R.        │  │
│    ▓▓▓▓▓▓▓▓ 9/9  │  │                Autorizó   Ana Gómez · 12/03/2024   │  │
│  ● ANALISTA      │  └────────────────────────────────────────────────────┘  │
│    FEEC · Virtual│                                                          │
│    ▓▓▓▓▓▓░░ 6/9  │  ✓ Invitación  ✓ Autorización  ✓ Confidencialidad       │
│                  │  ✓ Curso 4.5   ✓ Prueba 92     ✓ Asignación             │
│ ▸2024◂           │  ✓ 12 proyectos  ✓ Retroalimentó  ✗ Certificado         │
│  ● EVALUADOR ←   │                                                          │
│    FCE · Presenc.│  ┌ Documentos ┬ Formación ┬ Proyectos ┬ Retroalimentación┐│
│    ▓▓▓▓▓▓▓░ 7/9  │  │                                                       ││
│                  │  │  PROPIOS DEL AÑO                                      ││
│  2023            │  │  📄 Autorización jefe.msg      [ver] [↓]              ││
│  ○ sin registro  │  │  📄 Confidencialidad 2024.pdf  [ver] [↓]              ││
│                  │  │                                                       ││
│  2022            │  │  HEREDADOS DE LA CONVOCATORIA 2024      [ir al año →] ││
│  ◑ solo prueba   │  │  📎 Invitación general.msg     [ver]  ᴳᴱᴺᴱᴿᴬᴸ         ││
│                  │  │  📎 Ratificación.pdf           [ver]  ᴳᴱᴺᴱᴿᴬᴸ         ││
│  2021            │  │                                                       ││
│  ◑ solo prueba   │  │  PERMANENTES                                          ││
│                  │  │  📄 Cédula.pdf                 [ver]  ᴾᴱᴿᴹᴬᴺᴱᴺᵀᴱ      ││
│  + Nueva part.   │  └───────────────────────────────────────────────────────┘│
└──────────────────┴──────────────────────────────────────────────────────────┘
```

- **El rail izquierdo es la navegación principal.** `●` participó, `◑` solo prueba, `○` sin registro. Los gaps se ven, no se comprimen.
- **Anillo de progreso por participación** — convierte "hay datos" en "vas 7 de 9".
- **Checklist en chips**, no lista vertical. Cada chip apagado es un call to action.
- **Los 4 sub-tabs** son secundarios: la cabecera ya responde el 80 % de las preguntas.

### 8.3 Sub-tab Retroalimentación

```
┌──────────────────────────────────────────────────────────────────┐
│  Retroalimentación 2024        Promedio 4.6 / 5  ·  5 recibidas  │
│                                                                  │
│  1  Cumplimiento y tiempos   ▓▓▓▓▓▓▓▓▓▓  5.0   Evolución         │
│  2  Dominio técnico          ▓▓▓▓▓▓▓▓▓░  4.8   2024 ●──● 25 ──● 26│
│  3  Objetividad              ▓▓▓▓▓▓▓▓▓░  4.8    4.6    4.8    4.5 │
│  6  Comunicación             ▓▓▓▓▓▓▓░░░  4.1                     │
│  10 Recomendaría             ▓▓▓▓▓▓▓▓▓▓  5.0   ▲ mejor: cumplim. │
│  … (10 preguntas de escala)                    ▼ a mejorar: com. │
│                                                                  │
│  Quién lo retroalimentó                        [ver nombres 🔒]  │
│  · Líder área técnica          4.7                               │
│  · Par evaluador (anónimo)     4.5                               │
│  · Apoyo técnico (anónimo)     4.6                               │
│                                                                  │
│  Comentarios recibidos (Q11)                                     │
│  "Cumplió con todos los tiempos y sus conceptos fueron claros."   │
└──────────────────────────────────────────────────────────────────┘
```

`[ver nombres 🔒]` solo aparece para perfiles 1 y 2, y al usarlo se registra en `EVALUADORLOG`.

La **evolución multi-año** es el dato que hoy no existe en ningún lado y es exactamente lo que un banco de evaluadores necesita para decidir a quién vuelve a invitar.

### 8.4 Pantallas nuevas del módulo de retroalimentación

| Ruta | Quién | Qué |
|---|---|---|
| `/panel/retroalimentacion` | evaluador | "Personas por retroalimentar" — reemplaza `MiPanelEval.vue` |
| `/panel/retroalimentacion/formulario` | evaluador | el formulario con cronómetro — reemplaza `EvalFormulario.vue` |
| `/panel/evaluadores/convocatorias/[cid]/matriz` | gestión | preview + generar + avance — reemplaza `EvalAdmin.vue` |
| `/verificar/[codigo]` | **público** | validación de certificados |

`EvalLogin.vue` y `EvalShell.vue` **no se portan**: el login y el shell del SEP ya existen.

### 8.5 Listado del banco

Antes filtraba solo por texto. `GET /evaluadores` acepta ahora, todos opcionales y combinables:

| Filtro | Tipo | Nota |
|---|---|---|
| `busqueda` | texto | nombre, correo o identificación. Los comodines `%` y `_` se escapan: teclear `%` no devuelve el banco entero |
| `anio` | número | resuelto con `EXISTS`, no con `JOIN`: un evaluador con 6 años sigue siendo **una** fila |
| `procesoId`, `rolEvaluadorId`, `areaId` | número | idem, sobre el ciclo |
| `estadoCodigo` | texto | código de `ESTADOPARTICIPACION`; basta con que **un** ciclo lo tenga |
| `regionalId`, `centroId` | número | sobre el evaluador, no sobre el ciclo |
| `sinCedula`, `sinFoto` | bool | las dos carencias que bloquean la certificación |
| `pruebaVigente` | bool | `true` y `false` particionan el banco; omitirlo trae ambos |
| `incluirInactivos` | bool | por defecto solo activos |

Un valor no numérico (`?anio=abc`) se descarta en el controller y **no** llega como `NaN` a un bind de Oracle.

Cada tarjeta trae además `totalCiclos`, `ultimoAnio`, `totalProyectos`, `promedioRetro`, `tieneCedula`, `tieneFoto`, `pruebaVigente` y los **chips de los últimos 3 años** con su color de estado. Los chips de toda la página se traen en **una** consulta con `ROW_NUMBER() OVER (PARTITION BY …)`, no una por tarjeta.

**Sábana del banco (Excel)** — `GET /evaluadores/reportes/banco.xlsx` acepta exactamente los mismos filtros: *lo que se exporta es lo que se está viendo*. Dos hojas: `1. Evaluadores` (una fila por persona, con las carencias resaltadas en rojo) y `2. Ciclos` (una fila por participación, pensada para tabla dinámica por año/proceso/mesa). La fila 1 deja escrito qué filtros produjeron el archivo — sin eso, dos sábanas distintas se ven idénticas.

> El listado de pantalla topa en 100 filas por página. La exportación sube ese tope explícitamente (5º argumento de `listar`), nunca desde la query string: un `?limit=99999` desde el navegador no puede arrastrar el banco entero. Sin ese cuidado la sábana habría salido con 100 filas **pareciendo completa**.

Las listas `IN (...)` van partidas en bloques de 900 (`enBloques`, en `common/db/binds.ts`): Oracle rechaza con `ORA-01795` una lista de más de 1000 elementos, límite que con 40 evaluadores nunca se toca y que aparecería el día que el banco crezca.

**Catálogos que alimentan la barra de filtros** (todos de solo lectura — son el vocabulario del proceso, cambiarlos es una migración):

| Ruta | Devuelve |
|---|---|
| `GET /evaluadores/catalogos/estados-participacion` | los 11 estados con `codigo`, `color`, `esFinal`, `esNegativo` |
| `GET /evaluadores/catalogos/areas` | Técnica, Financiera, Jurídica |
| `GET /evaluadores/catalogos/modalidades` | Presencial, PAT, Virtual |
| `GET /evaluadores/catalogos/anios` | `DISTINCT ANIO` real de `EVALUADORPARTICIPACION`, más el año en curso |

El de años existe porque el select se llenaba con una ventana móvil (`anioActual + 1` y seis hacia atrás): el histórico llega a **2020** y ese año no se podía elegir, mientras se ofrecían años vacíos.

### 8.6 Ficha PDF del evaluador

`GET /evaluadores/:id/ficha.pdf` — la hoja de vida imprimible, en LETTER vertical y multipágina. Botón *Ficha PDF* en el hero de la ficha.

Contiene, en orden: cabecera institucional con retrato (o iniciales si no hay foto o el formato es ilegible), KPIs, bloque de alertas, formación académica, experiencia, TIC y **una sección por año** con rol, área, proceso, modalidad, mesa, equipo, estado, aprobación del jefe, curso, prueba, proyectos, retroalimentación y certificado.

Dos cosas que costaron y conviene no volver a romper:

- **El bloque del año no se parte.** Se reserva el ciclo entero (`ALTO_CICLO`) antes de dibujarlo, y el encabezado del año viaja atado a su primer ciclo. Antes, el "2025" quedaba en una página y "aprobación del jefe / curso / prueba / certificado" en la siguiente: en una hoja con seis años, la página 2 era ilegible porque no decía de qué año hablaba. Si aun así no cabe, el corte se permite y la página nueva repite la banda del año con la palabra *continuación*.
- **`ESTADOPARTICIPACION.COLOR` no es hexadecimal**, es el token de la paleta que el panel traduce a clases de Tailwind. El PDF tiene su propia tabla token→hex (tono 600, porque el texto va en blanco y sobre papel el 500 no se lee). Sin ella, un ciclo `REVOCADO` se imprimía idéntico a uno `CERTIFICADO`.

---

## 9. Plan de migraciones y fases

| Ver. | Archivo | Destructiva |
|---|---|---|
| v29 | `evaluador_catalogos_ciclo.sql` | no |
| v30 | `evaluador_aprobacion.sql` | no |
| v31 | `evaluador_capacitacion.sql` | no |
| v32 | `evaluador_part_proyecto.sql` | no (el DROP del CLOB es en v36) |
| v33 | `retroalimentacion.sql` | no |
| v34 | `evaluador_participacion_spine.sql` | no |
| v35 | `evaluador_log.sql` | no |
| v37 | `evaluador_certificado.sql` | no |
| v38 | `retro_instrumento_16_preguntas.sql` | no (solo toca la plantilla base) |
| v36 | `evaluador_limpieza.sql` | **sí — ejecutar de última, tras un sprint** |

> Orden de ejecución: **v29 → v30 → v31 → v32 → v33 → v34 → v35 → v37**, y v36 al final.
> La v34 depende de la v29 (FKs a los catálogos) y la v30 (inserta aprobaciones en el backfill).

Todas idempotentes con el patrón `BEGIN EXECUTE IMMEDIATE q'[...]' EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 ...` que ya usan v25–v28.

**Estado: aplicadas todas (2026-07-27), incluida la v36.**

### ⚠️ Incidente en la primera ejecución de la v36

El bloque de verificación previa **imprimía** el contador de `EVALUADORQUIENAPRUEBA` pero **no lo incluía** en la condición de aborto. Resultado:

```
EVALUADORQUIENAPRUEBA con texto : 1
Filas en EVALUADORAPROBACION    : 0
→ el script no abortó y dropeó la columna
```

**Causa raíz:** el backfill de la v34 §5.6 hace `JOIN` contra `EVALUADORPARTICIPACION`. Un evaluador **sin ninguna participación** no produce fila, así que su `EVALUADORQUIENAPRUEBA` nunca se migró. La verificación debió haberlo detenido y no lo hizo.

**Alcance real:** un campo de texto, en un solo evaluador — el único del banco sin participaciones. El banco tenía 2 evaluadores en total; sigue en piloto. `EVALUADOROTROSEST` también se dropeó sin migración automática, pero ambos evaluadores tienen estudios cargados (3 y 4 registros), así que el texto era redundante.

**No es recuperable** por flashback: `ALTER TABLE ... DROP COLUMN` es físico e irreversible sin restaurar backup. Por una celda de texto en un piloto, no vale la pena una restauración.

**Recuperación — hecha.** Se creó la participación 2025 del evaluador afectado como `EVALUADOR` (estado `FINALIZADO`) y sobre ella la `EVALUADORAPROBACION` con la Gestora de Evaluadores como aprobadora.

> ⚠️ **Pendiente:** la `FECHAAPROBACION` quedó anclada a la fecha de alta del evaluador (2026-07-06) porque la real se perdió con la columna. Es visiblemente inconsistente — una aprobación posterior al ciclo que autoriza — y hay que corregirla en cuanto se sepa la fecha verdadera. La observación del registro lo deja anotado.

**Corregido en el archivo:** cada contador que se imprime ahora también bloquea, con su propio `RAISE_APPLICATION_ERROR` y mensaje explicando qué hacer. Se agregó el contador de `EVALUADOROTROSEST`, que antes ni se medía. Los contadores sobre columnas que la propia migración dropea pasaron a SQL dinámico para que el script siga siendo re-ejecutable.

**Lección aplicable a cualquier migración destructiva:** un contador que se imprime pero no bloquea es peor que no medirlo — da la sensación de que se verificó.

### v38 — el instrumento pasó de 12 a 16 preguntas

Alcance definitivo de la convocatoria DSNFT-0001-FCE-2026: **14 preguntas de escala** (antes 10) más las dos abiertas. Las cuatro nuevas son cumplimiento del cronograma, puntualidad y jornada, atención de subsanaciones y atención de requerimientos del líder.

El código no necesitó cambios: nunca hardcodeó el número de preguntas, itera sobre las de tipo `ESCALA` del formulario. El máximo pasó de 50 a 70 solo.

Se agregó `ESCALAETIQUETAS` (1 Deficiente … 5 Excelente) en el instrumento y no en el código, para que un año pueda cambiar la redacción sin desplegar y para que el histórico conserve la que estaba vigente. El clon por convocatoria las copia.

La migración **solo toca la plantilla base**; los instrumentos ya clonados a una convocatoria no se tocan — ese es el punto de haberlos clonado.

### Defectos que encontró la revisión de la fase G

Ninguno era visible sin ejercitar la ruta completa. Se dejan escritos porque tres son trampas que reaparecen:

| Defecto | Por qué no se veía | Arreglo |
|---|---|---|
| **Buscar por nombre y apellido juntos devolvía 0** | `PERSONANOMBRES` es `NCHAR(100)` y `PERSONAPRIMERAPELLIDO` `NCHAR(20)`: Oracle los rellena de espacios hasta el ancho fijo. Concatenarlos daba `Ana<97 espacios> Ríos`, y el `LIKE '%ANA RÍOS%'` nunca casaba. Buscar **una sola palabra** sí funcionaba, que es lo que se probaba | `TRIM` en cada columna antes de concatenar, y el segundo apellido dentro de la búsqueda |
| `?limit=abc` → **500** | `page` y `limit` son los únicos valores que se interpolan en el SQL (Oracle no admite bind en `OFFSET/FETCH`). `Math.max(1, NaN)` es `NaN` y el template lo imprimía como el texto `NaN` → `ORA-00933`. El guard `num()` del controller se había aplicado a los filtros pero no a estos dos | `entero()` en el servicio, que es la última línea de defensa, más tope al `offset` para que un `page` gigante no salga en notación exponencial |
| `sinCedula=false` **no filtraba** pero el Excel decía que sí | Se evaluaba por truthiness (`if (filtros.sinCedula)`), así que `false` caía en el mismo caso que "sin usar". La cabecera de la sábana, en cambio, sí lo imprimía | Comparación contra `null`, igual que `pruebaVigente`. `false` ahora significa "solo los que **sí** la tienen", que es una pregunta legítima |
| El listado decía **"prueba vigente: sí"** y la ficha "no" | El listado hacía `EXISTS` sobre *cualquier* prueba de los últimos dos años; la ficha mira **la última**. Quien aprobó en 2025 y reprobó en 2026 salía como vigente | Un único predicado `PRUEBA_VIGENTE` en el servicio, con el criterio de la ficha, usado a la vez por el filtro y por el flag |
| La hoja *2. Ciclos* del Excel **ignoraba los filtros de año/proceso/rol/área/estado** | Solo se usaban para escoger a las personas; el `WHERE` de la hoja 2 era únicamente `EVALUADORID IN (...)`. Una tabla dinámica sobre ella no cuadraba con la cabecera de la hoja 1 | Los mismos filtros se aplican también a la hoja 2 |
| Chips de año desordenados o ambiguos | El `SELECT` externo no tenía `ORDER BY`, y nada impide **dos participaciones del mismo año** (FCE p1 y FEEC p2): cuál de los dos estados se pintaba cambiaba entre recargas | `ORDER BY` explícito, desempate por `PARTICIPACIONID` y `participacionId` en la respuesta, que es la única key única para React |
| La sábana podía anunciar más registros de los que traía | `total` es el `COUNT(*)` real; los `items` topan en 5000 | La celda A1 avisa `⚠ TRUNCADO: se exportaron N de M` |

Y dos que se descartaron tras verificarlos: **no hay inyección SQL** (todo valor del usuario pasa por bind; lo único interpolado son dos números) y **`promedioRetro` sí promedia la retroalimentación recibida** (`PARTEVALUADOID`), no la emitida.

### Fases de implementación

| Fase | Alcance | Tam. | Desbloquea |
|---|---|---|---|
| **A** | v29 + v34 + backend `trayectoria` / `participaciones/:pid` + rail de años | M (4-5 d) | **La reorganización por año ya se ve** |
| **B** | v30 + v31 → aprobación del jefe y curso + checklist completo | M (3-4 d) | La gestora deja las carpetas |
| **C** | v32 → proyectos evaluados + typeahead | M (3-4 d) | Métricas de carga por evaluador/mesa/año |
| **D** | v33 → retroalimentación: matriz, formulario, resultados, reporte Excel | XL (10-14 d) | **Apaga el sistema Mongo aparte** |
| **E** | v35 → auditoría + tab Auditoría + accesos de coordinación | S (2 d) | Trazabilidad |
| **F** | v37 → emisión de certificados + verificación pública | M (4-5 d) | Cierra el ciclo |
| **G** | Listado con filtros + sábana Excel + ficha PDF | M (3-4 d) | Reportes para la coordinación |
| **H** | v36 → limpieza | S (1 d) | — |

> Con la fase G cerrada, **todas las fases están implementadas y verificadas**. Lo único externo que queda es decidir cómo se le entrega la clave inicial al evaluador; el resto son preguntas abiertas de negocio.

**Total: 31–40 días.** La fase D es la más grande porque no es solo BD: es portar un sistema entero (motor de matriz, formulario con cronómetro, 7 hojas de Excel) de Mongo/Express/Vue a Oracle/Nest/Next.

---

## 10. Decisiones

### Cerradas

| # | Tema | Decisión |
|---|---|---|
| 1 | Nombre del instrumento | **Retroalimentación**, no "encuesta". En BD, API y UI |
| 2 | Puntaje mínimo de la prueba | **Por año** — `EVALUADORCONVOCATORIA.PUNTAJEMINIMOPRUEBA`, congelado en cada registro |
| 3 | Permisos del módulo | **Un solo nivel: todas las interfaces del gestor de evaluadores son iguales para todos.** Ver §5.5 |
| 3b | Acceso del evaluador al SEP | **Sí tiene acceso** (perfil 9). Reemplaza la decisión #9 del doc 00. Al registrar un evaluador se le crea la cuenta en la misma transacción; si ya usaba el SEP, solo se le suma el perfil y **conserva su clave y su predeterminado** |
| 4 | Certificado de participación | **Lo emite el sistema** (v37): consecutivo por año bajo bloqueo, código de verificación aleatorio, snapshot congelado y validación pública sin sesión |
| 5 | Multirol | **Ya implementado** (`USUARIOPERFIL`, v19). El módulo se apoya en él, no lo duplica |
| 6 | Anonimato de la retroalimentación | El dato guarda el calificador; la **presentación** lo oculta. **El evaluado nunca lo ve.** Quien gestiona sí, y queda en el log |
| 7 | Auditoría | Obligatoria y visible desde el panel. Log inmutable (`SEP_APP` sin `UPDATE`/`DELETE`) |
| 8 | Curso de formación | Hoy resultado externo; `ORIGEN = SISTEMA` deja listo el día que se dicte dentro del SEP |
| 9 | Convocatoria del banco ↔ del SEP | `CONVOCATORIASEPID` **nullable** — se ata cuando corresponde, no se obliga |
| 10 | Transversales sin retroalimentación | El transversal **técnico y el jurídico no los evalúa nadie**: es intencional, confirmado por el área. Solo el financiero recibe (de su líder). Fijado en un test para que no cambie por accidente |
| 11 | Instrumento | **16 preguntas** (14 escala + 2 abiertas), con etiquetas de escala versionadas por ciclo |
| 12 | Alcance de transversales desactualizado | El motor original lo resolvió con 5 nombres propios hardcodeados. Aquí va en `RETROFORMULARIO.REGLASMATRIZ` como configuración del ciclo, y el preview muestra el alcance efectivo para que un override nunca sea silencioso |

### Abiertas — hay que confirmar

| # | Pregunta | Con quién |
|---|---|---|
| 1 | ~~El evaluador inicia sesión en el SEP~~ → **decidido: sí**, y ya implementado. Queda informar que reemplaza la decisión #9 del doc 00 | **Coordinación** *(informativo)* |
| 2 | ¿Se migra el histórico que ya está en Mongo (asignaciones y respuestas del ciclo 2026) o se arranca limpio? | **Coordinación / Gestión de evaluadores** |
| 3 | ¿La retroalimentación se abre solo al cierre del proceso, o queda disponible durante todo el ciclo? | **Coordinación** |
| 4 | ~~Falta una variable de entorno para la URL del certificado~~ → **resuelto**: usa `APP_URL`, la misma que `MailService`, que ya está configurada. Se descartó crear una variable propia: con dos, la que nadie configura es la que rompe | — |
| 5 | ¿El código de verificación se entrega solo como texto o también como QR en el PDF? | **Equipo TIC / Coordinación** |
| 6 | ¿Cómo se le entrega la clave inicial al evaluador? Hoy se muestra una vez en pantalla al registrarlo; enviarla por correo requiere cablear el `MailService` que ya existe | **Coordinación** |

### Colisiones con el módulo de proyectos — para tener presente

Dos rutas ya existían y hubo que moverse. Ambas se detectaron probando, no leyendo:

| Ruta que se intentó | Qué pasaba | Dónde quedó |
|---|---|---|
| `GET /publico/verificar/:codigo` | Ya la ocupa la verificación de versiones de proyecto; el módulo de proyectos se registra antes y se quedaba con la petición. La verificación de certificados habría respondido **siempre "no válido"**, en silencio | `/publico/certificados/:codigo` |
| `/verificar/[codigo]` (página) | Next rechaza dos rutas paralelas al mismo path: devolvía **500 en todo el frontend**, no solo en esa página | `(public)/verificar-certificado/[codigo]` |

También el orden de controllers importa: `EvaluadoresController` tiene `@Get(':id')` bajo `/evaluadores`, que con Express 5 capturaba `/evaluadores/convocatorias`. Se resolvió registrando primero el controller más específico — Express 5 usa path-to-regexp v8 y ya no admite `:id(\\d+)`.

---

## 11. Resumen en 60 segundos

- El problema no era la UI: **el año no existía como entidad**. Eran cuatro tablas con un `NUMBER(4)` suelto, una tabla de convocatorias que no conocía a los evaluadores, y la retroalimentación en otra base de datos con otro login.
- **`EVALUADORPARTICIPACION` pasa a ser la columna vertebral.** Todo lo temporal cuelga de ella.
- **Se absorbe el módulo de retroalimentación**: 7 tablas nuevas en Oracle, el motor de matriz portado 1:1 con las reglas ahora configurables, y `EvalPersona` desaparece porque su identidad ya vive en `PERSONA`/`USUARIO` con el multirol que ya existe.
- **Máquina de estados + checklist de 9 hitos derivado de los datos** — el estado no se declara, se calcula.
- Los documentos generales del año **se heredan** de la convocatoria; no se duplican por evaluador.
- **15 tablas nuevas, 3 catálogos, ~30 columnas, 7 columnas que se van.** Una sola migración destructiva, diferida y con verificación previa que aborta sola.
- **Auditoría inmutable** con acceso de lectura para la coordinación.
- **Certificados emitidos por el sistema**, con consecutivo, snapshot y verificación pública.
- El panel pasa de **7 tabs planos a 4 con jerarquía**, con un rail de años que muestra la trayectoria completa de un vistazo.
