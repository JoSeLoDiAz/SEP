# Informe de Desarrollo — Módulo Aprobación de Proyectos y Publicación de Resultados
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP del **flujo de aprobación oficial del proyecto por parte del SENA** y de la **publicación coordinada de resultados** al proponente. Cubre tres temas que en el SEP GeneXus estaban dispersos en pantallas distintas y con flujos manuales propensos a inconsistencias:

1. **Aprobación / Rechazo del proyecto** por el administrador SENA, operando sobre la **versión FINAL** marcada por el proponente (informe 21). Cuando se aprueba, el sistema **restaura las tablas vivas desde el snapshot** y registra la aprobación en `PROYECTOAPROBADO` con el hash inmutable de la versión.

2. **Publicación de resultados por convocatoria.** El admin no publica proyecto por proyecto: aprueba/rechaza individualmente sin que se filtre información, y al final libera **toda la convocatoria de un solo movimiento**. Mientras los resultados están sin publicar, los proponentes ven sus proyectos aún como "Confirmado" — el listado enmascara el estado real (3=Aprobado / 4=Rechazado) hasta que la convocatoria se libera.

3. **Auditoría de cambios post-aprobación.** Una vez el proyecto está en estado 3, el admin puede ajustar grupos, coberturas, UTs y materiales en tablas vivas para soportar la ejecución real (cambios menores que no requieren reaprobación). Cada modificación queda en `EJECUCIONLOG` con tabla, operación, registro, usuario, fecha y snapshots antes/después.

> **Estado del módulo:** flujo completo aprobación → publicación → ejecución implementado y operativo. Las pantallas administrativas de aprobación, gestión de convocatorias y log de ejecución están en producción local.

---

## 2. Flujo General

```
Proponente marca versión FINAL (estado proyecto = 1)
         │
         ▼
Admin abre /panel/admin/aprobacion/proyectos
         │
         ▼
   ┌─────────────────────┴─────────────────────┐
   │                                           │
   ▼                                           ▼
APROBAR                                    RECHAZAR
   │                                           │
POST /proyectos/:id/aprobar               POST /proyectos/:id/rechazar
   │                                           │
   ├─ Lee snapshot de la versión FINAL         ├─ Estado proyecto → 4 (Rechazado)
   ├─ RESTAURA tablas vivas (15 tablas)        ├─ Registra motivo + AFs aprobadas/rechazadas
   ├─ Inserta PROYECTOAPROBADO                 │
   │   con versionId + versionHash             │
   ├─ Estado proyecto → 3 (Aprobado)           │
   │                                           │
   └─────────────────────┬─────────────────────┘
                         │
                         │  (Mientras tanto, proponente ve "Confirmado"
                         │   porque CONVOCATORIARESULTADOSPUBLICADOS = 0)
                         │
                         ▼
Admin abre /panel/admin/convocatorias → click "Publicar resultados"
                         │
POST /proyectos/admin/convocatorias/:id/publicar-resultados
                         │
                         ▼
CONVOCATORIA.CONVOCATORIARESULTADOSPUBLICADOS = 1
                         │
                         ▼
Todos los proponentes de la convocatoria ven simultáneamente
su estado real (Aprobado / Rechazado) y el concepto por AF
                         │
                         ▼
Estado 3 (Aprobado): admin puede modificar tablas vivas
   │
   ▼
EJECUCIONLOG registra cada cambio (antes / después)
```

---

## 3. Frontend

### Archivos principales

| Archivo | Rol |
|---|---|
| `frontend/src/app/(dashboard)/panel/admin/aprobacion/proyectos/page.tsx` | Pantalla aprobación / rechazo de proyectos |
| `frontend/src/app/(dashboard)/panel/admin/convocatorias/page.tsx` | Gestión de convocatorias y publicación de resultados |
| `frontend/src/app/(dashboard)/panel/admin/convocatorias/[id]/page.tsx` | Detalle de convocatoria con resumen de proyectos por estado |

### Pantalla de aprobación (`.../aprobacion/proyectos`)

- **Lista filtrable** de proyectos elegibles para aprobación: solo aparecen los que tienen una versión marcada como FINAL y están en estado **1 (Confirmado)**. Filtros por convocatoria, empresa, fecha de versión final.
- **Por cada proyecto** se muestra: empresa, código de versión final (`PRY-XXXX-V2`), fecha de marcado, hash truncado (con tooltip a versión completa), valor total y número de AFs.
- **Acciones por fila:**
  - **Aprobar** — abre modal con: comentario opcional, listado de AFs con checkbox para seleccionar AFs aprobadas vs rechazadas (aprobación parcial), confirmación.
  - **Rechazar** — abre modal con: motivo obligatorio (textarea), listado de AFs con checkbox.
  - **Ver detalle** — abre el snapshot de la versión final en JSON (mismo modal de informe 21).
- **Aprobación parcial:** el admin puede aprobar el proyecto pero rechazar AFs específicas. El estado del proyecto va a 3 (Aprobado), pero las AFs rechazadas quedan marcadas y no participan de la ejecución.
- **Reversa.** Si después de aprobar/rechazar se necesita corregir, hay un botón **"Reversar decisión"** (ej. `POST /proyectos/:id/reversar`) que devuelve el proyecto a estado 1 (Confirmado), borra el registro `PROYECTOAPROBADO` y permite re-evaluar.
- **Banner** indicando si la convocatoria del proyecto ya tiene resultados publicados o no, para que el admin sepa si su decisión es aún reversible sin que el proponente lo vea.

### Pantalla de convocatorias (`.../convocatorias`)

- **Lista de convocatorias** activas, con resumen: número de proyectos, cuántos en cada estado (Borrador, Confirmado con FINAL, Aprobado, Rechazado), si los resultados están publicados o no.
- **Por cada convocatoria:** botón "Gestionar" (abrir/cerrar inscripciones, editar fechas), y botón **"Publicar resultados"** (verde) que se habilita cuando todos los proyectos confirmados tienen una decisión (3 o 4).
- **Modal de confirmación** al publicar: lista los proyectos que se liberarán al proponente con su estado, último chequeo antes de publicar irreversible.
- **Indicador "Resultados publicados"** (badge verde) en la convocatoria una vez publicada.

### Pantalla del proponente — comportamiento al publicar

Esto se documenta aquí para tener el ciclo completo, aunque la implementación vive en `15-listado-proyectos.md`:

- **Antes de publicar:** el listado del proponente fuerza el estado mostrado a `1 (Confirmado)` para cualquier proyecto en estado real 3 o 4. La pantalla de detalle también lo enmascara.
- **Después de publicar:** el proponente ve el estado real con el concepto del SENA y el desglose por AF. Notificación visual destacada de cambio de estado.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | Endpoints REST (líneas 286-346) |
| `backend/src/proyectos/proyectos.service.ts` | Métodos `aprobarProyecto`, `rechazarProyecto`, `reversarProyectoComoAdmin`, `publicarResultadosConvocatoria` |
| `backend/src/proyectos/ejecucion-log.service.ts` | Helpers para escribir entradas en `EJECUCIONLOG` desde otros métodos del CRUD admin |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/proyectos/:id/aprobar` | Aprueba el proyecto. Body: `{ comentario?, afsRechazadas?: number[] }`. Restaura tablas vivas desde snapshot, registra en `PROYECTOAPROBADO`, pasa proyecto a estado 3 |
| `POST` | `/proyectos/:id/rechazar` | Rechaza el proyecto. Body: `{ motivo, afsRechazadas?: number[] }`. Pasa proyecto a estado 4 |
| `POST` | `/proyectos/:id/reversar` | Reversa decisión de aprobación/rechazo → estado 1. Body: `{ motivo? }` |
| `POST` | `/proyectos/admin/convocatorias/:convocatoriaId/publicar-resultados` | Marca `CONVOCATORIA.CONVOCATORIARESULTADOSPUBLICADOS = 1` para que los proponentes vean su estado real |

### Lógica clave de `aprobarProyecto`

```ts
async aprobarProyecto(proyectoId, { comentario, afsRechazadas }, usuario) {
  const qr = ds.createQueryRunner()
  await qr.connect()
  await qr.startTransaction()
  try {
    // 1. Cargar versión FINAL
    const [vf] = await qr.query(
      `SELECT PROYECTOVERSIONID, VERSIONCODIGO, VERSIONHASH, VERSIONSNAPSHOT
         FROM PROYECTOVERSION
        WHERE PROYECTOID = :1 AND VERSIONESFINAL = 1`, [proyectoId])
    if (!vf) throw new BadRequest('No hay versión FINAL marcada')

    const snapshot = JSON.parse(vf.VERSIONSNAPSHOT)

    // 2. Restaurar tablas vivas (15 tablas — borra y reinserta)
    await this.restaurarTablasVivas(qr, proyectoId, snapshot)

    // 3. Insertar PROYECTOAPROBADO con hash congelado
    await qr.query(
      `INSERT INTO PROYECTOAPROBADO
         (PROYECTOID, PROYECTOVERSIONID, VERSIONCODIGO, VERSIONHASH,
          FECHAAPROBACION, USUARIOAPROBO, COMENTARIOAPROBACION)
       VALUES (:1, :2, :3, :4, SYSDATE, :5, :6)`,
      [proyectoId, vf.PROYECTOVERSIONID, vf.VERSIONCODIGO,
       vf.VERSIONHASH, usuario.email, comentario ?? null])

    // 4. Marcar AFs rechazadas
    if (afsRechazadas?.length) {
      await qr.query(
        `UPDATE ACCIONFORMACION SET ACCIONFORMACIONRECHAZADA = 1
          WHERE ACCIONFORMACIONID IN (${afsRechazadas.map((_,i) => `:${i+1}`).join(',')})`,
        afsRechazadas)
    }

    // 5. Estado proyecto → 3
    await qr.query(
      `UPDATE PROYECTO SET PROYECTOESTADO = 3 WHERE PROYECTOID = :1`,
      [proyectoId])

    await qr.commitTransaction()
    return { ok: true, versionCodigo: vf.VERSIONCODIGO }
  } catch (e) {
    await qr.rollbackTransaction()
    throw e
  } finally {
    await qr.release()
  }
}
```

### Restauración de tablas vivas desde snapshot

`restaurarTablasVivas` recibe el JSON del snapshot y, para cada AF y entidad relacionada, ejecuta `DELETE` + `INSERT` dentro de la transacción para garantizar que las tablas vivas reflejen exactamente lo aprobado:

```
ACCIONFORMACION, AFRUBRO, AFGRUPO, AFGRUPOCOBERTURA,
UNIDADTEMATICA, PERFILUT, ACTIVIDADUT,
AFAREAFUNCIONAL, AFNIVELOCUPACIONAL, OCUPACIONCOUCAF,
AFPSECTOR, AFPSUBSECTOR, AFSECTOR, AFSUBSECTOR,
AFGESTIONCONOCIMIENTO, MATERIALFORMACIONAF, RECURSOSDIDACTICOSAF,
CONTACTOEMPRESA
```

Esto cierra la posibilidad de divergencia entre lo confirmado y lo vivo: cualquier edición intermedia que el proponente hubiera hecho después de marcar FINAL queda anulada.

### Publicación de resultados por convocatoria

```ts
async publicarResultadosConvocatoria(convocatoriaId, usuario) {
  // Validación: todos los proyectos confirmados deben tener decisión
  const pendientes = await ds.query(
    `SELECT COUNT(*) AS C
       FROM PROYECTO p
       JOIN PROYECTOVERSION pv ON pv.PROYECTOID = p.PROYECTOID AND pv.VERSIONESFINAL = 1
      WHERE p.CONVOCATORIAID = :1 AND p.PROYECTOESTADO = 1`, [convocatoriaId])
  if (Number(pendientes[0].C) > 0)
    throw new BadRequest('Hay proyectos confirmados sin aprobar/rechazar')

  await ds.query(
    `UPDATE CONVOCATORIA SET CONVOCATORIARESULTADOSPUBLICADOS = 1
      WHERE CONVOCATORIAID = :1`, [convocatoriaId])
  // Audit en EJECUCIONLOG opcional, no por proyecto sino por convocatoria
}
```

### Audit log automático en estado 3

El servicio `EjecucionLogService` exporta un helper `log({ proyectoId, tabla, operacion, registroId, valorAntes?, valorDespues?, comentario? })`. Los métodos del CRUD admin que mutan tablas en estado 3 lo invocan después de cada `INSERT/UPDATE/DELETE`:

```ts
// Ejemplo en agregarGrupo del CRUD admin
await this.ds.query(`INSERT INTO AFGRUPO ... `)
await this.ejecucionLog.log({
  proyectoId, tabla: 'AFGRUPO', operacion: 'INSERT',
  registroId: newId, comentario: `Grupo ${dto.numero} agregado por admin`,
  usuario: req.user.email, perfilId: req.user.perfilId,
})
```

En estados distintos a 3 (formulación normal del proponente) **no se loguea** — esos cambios son parte del flujo natural de edición y poblarían el log de ruido.

### Enmascaramiento de estado en `listar()`

El método `listar()` del proponente fuerza el estado mostrado:

```ts
const estado = (proyecto.estadoReal === 3 || proyecto.estadoReal === 4)
            && convocatoria.resultadosPublicados !== 1
  ? 1  // enmascara como Confirmado
  : proyecto.estadoReal
```

Para `perfilId = 1` (admin) siempre se devuelve el estado real.

---

## 5. Modelo de datos

### Tabla `PROYECTOAPROBADO`

| Columna | Tipo | Notas |
|---|---|---|
| `PROYECTOID` (PK + FK) | NUMBER | Un solo registro por proyecto |
| `PROYECTOVERSIONID` (FK) | NUMBER | Versión FINAL aprobada |
| `VERSIONCODIGO` | VARCHAR2(60) | Código de la versión, redundante para auditoría |
| `VERSIONHASH` | VARCHAR2(64) | Hash SHA-256 al momento de la aprobación |
| `FECHAAPROBACION` | TIMESTAMP | Default `SYSDATE` |
| `USUARIOAPROBO` | VARCHAR2(200) | Email del admin |
| `COMENTARIOAPROBACION` | VARCHAR2(2000) | Texto opcional |

### Tabla `EJECUCIONLOG`

| Columna | Tipo | Notas |
|---|---|---|
| `EJECUCIONLOGID` (PK) | NUMBER | Generado por `EJECUCIONLOG_SEQ` |
| `PROYECTOID` (FK) | NUMBER | A qué proyecto pertenece el log |
| `TABLA` | VARCHAR2(60) | Nombre de la tabla afectada |
| `OPERACION` | VARCHAR2(20) | `INSERT` / `UPDATE` / `DELETE` |
| `REGISTROID` | NUMBER | PK del registro afectado |
| `USUARIOEMAIL` | VARCHAR2(200) | Quién |
| `USUARIOPERFILID` | NUMBER | Perfil del usuario (admin / interventoría / etc.) |
| `FECHA` | TIMESTAMP | Default `SYSDATE` |
| `COMENTARIO` | VARCHAR2(2000) | Descripción libre |
| `VALORANTES` | CLOB | Snapshot del registro antes (opcional, JSON) |
| `VALORDESPUES` | CLOB | Snapshot del registro después (opcional, JSON) |

### Columna nueva en `CONVOCATORIA`

| Columna | Tipo | Notas |
|---|---|---|
| `CONVOCATORIARESULTADOSPUBLICADOS` | NUMBER(1) | Default 0. 1 = visible al proponente |

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | A nivel controlador |
| Validación de perfil admin | Solo `perfilId = 1` puede aprobar/rechazar/reversar/publicar |
| Transacción atómica en aprobación | Todo el paso aprobar (restaurar tablas + insert PROYECTOAPROBADO + cambio estado) ocurre en una sola transacción; si algo falla, se revierte completo |
| Versión FINAL obligatoria | `aprobarProyecto` falla si no hay versión FINAL marcada |
| Hash congelado en aprobación | `PROYECTOAPROBADO.VERSIONHASH` queda con el hash al momento de aprobar; si la versión se altera (no debería: el snapshot CLOB es inmutable), se detecta divergencia |
| Publicación bloqueada con pendientes | No se puede publicar resultados si hay proyectos confirmados sin decisión |
| Enmascaramiento de estado en listar() | Proponente nunca ve estados 3/4 antes de publicar; admin siempre ve estado real |
| Audit log automático | Cada modificación en estado 3 queda registrada con antes/después |
| Reversa permitida solo admin | Endpoint `/reversar` validates perfil; el proponente no puede deshacer la decisión |
| `synchronize: false` (TypeORM) | Schema inmutable desde la app |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Listado de proyectos elegibles para aprobación con filtros | Pantalla `/panel/admin/aprobacion/proyectos` |
| 2 | Modal "Aprobar" con comentario y AFs seleccionables | Click "Aprobar" en una fila |
| 3 | Modal "Rechazar" con motivo obligatorio | Click "Rechazar" |
| 4 | Toast de aprobación exitosa con código de versión | Después de aprobar |
| 5 | Pantalla de convocatorias con resumen y estado de publicación | `/panel/admin/convocatorias` |
| 6 | Botón "Publicar resultados" deshabilitado con tooltip de pendientes | Convocatoria con proyectos sin decisión |
| 7 | Modal de confirmación de publicación con lista de proyectos | Click "Publicar resultados" |
| 8 | Vista del proponente — proyecto enmascarado como "Confirmado" antes de publicar | Login como proponente, convocatoria sin publicar |
| 9 | Vista del proponente — mismo proyecto como "Aprobado" después de publicar | Después de que admin publica |
| 10 | Pantalla de log de ejecución por proyecto | `/panel/admin/proyectos/[id]/ejecucion-log` |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Aprobación de Proyectos y Publicación de Resultados implementado

---

Cordial saludo,

Se informa que el **módulo de Aprobación de Proyectos y Publicación de Resultados** del nuevo SEP se encuentra implementado y operativo. Cubre el ciclo completo desde que el SENA evalúa el proyecto hasta que libera los resultados al proponente, garantizando trazabilidad, atomicidad y enmascaramiento de información sensible mientras la decisión está en deliberación.

**Funcionalidades entregadas:**

*Aprobación / Rechazo individual:*
- Pantalla administrativa que lista únicamente los proyectos con versión FINAL marcada y estado Confirmado, filtrable por convocatoria, empresa y fecha
- Aprobación atómica en transacción única: lectura del snapshot inmutable de la versión FINAL → restauración de las 18 tablas vivas relacionadas con el proyecto desde el JSON congelado → inserción del registro de aprobación en `PROYECTOAPROBADO` con código de versión y hash SHA-256 → cambio de estado a Aprobado (3); cualquier fallo revierte todo
- Aprobación parcial por Acción de Formación: el admin puede aprobar el proyecto pero excluir AFs específicas, que quedan marcadas como rechazadas y no participan de la ejecución
- Rechazo con motivo obligatorio y desglose opcional por AF
- Reversa de decisión disponible para corregir errores antes de publicar resultados

*Publicación coordinada por convocatoria:*
- Bandera nueva `CONVOCATORIARESULTADOSPUBLICADOS` en la tabla CONVOCATORIA, agregada con migración v18, que controla la visibilidad de los resultados al proponente
- Mientras la convocatoria no está publicada, el listado del proponente enmascara los estados 3 (Aprobado) y 4 (Rechazado) como 1 (Confirmado) para evitar filtración de información sensible durante la deliberación del SENA
- Pantalla de gestión de convocatorias con publicación masiva: el admin libera todos los resultados de una convocatoria de un solo movimiento, una vez todos los proyectos tienen decisión registrada
- Validación previa: la publicación falla si hay proyectos confirmados sin aprobar/rechazar, evitando publicaciones parciales

*Auditoría de cambios post-aprobación (informe extendido):*
- Tabla `EJECUCIONLOG` (migración v17) con audit log automático de todas las modificaciones que el admin SENA realice sobre tablas vivas (grupos, coberturas, unidades temáticas, materiales, etc.) durante la fase de ejecución (estado 3)
- Cada entrada del log captura tabla afectada, operación (INSERT/UPDATE/DELETE), id del registro, usuario y perfil, fecha, comentario y snapshots opcionales antes/después en formato JSON CLOB
- Ediciones en estados distintos a 3 (formulación normal) no se logean, manteniendo el log limpio de ruido

*Trazabilidad e integridad:*
- El registro `PROYECTOAPROBADO` queda con el hash de la versión al momento exacto de la aprobación; cualquier divergencia futura sería detectable
- El snapshot en `PROYECTOVERSION.VERSIONSNAPSHOT` es CLOB inmutable, complementario al log de ejecución para reconstruir el estado en cualquier momento

Se adjunta informe técnico con el detalle de los **4 endpoints REST** del flujo, las **2 tablas nuevas** (`PROYECTOAPROBADO`, `EJECUCIONLOG`), la **columna nueva** en CONVOCATORIA y el flujo completo Aprobar → Publicar → Ejecutar con auditoría.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
