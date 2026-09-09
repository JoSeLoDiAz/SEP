# Informe de Desarrollo — Módulo Control de Versiones de Proyecto
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP del **control de versiones del proyecto** durante la fase de formulación. Es una funcionalidad nueva, sin equivalente directo en el SEP GeneXus, que resuelve un problema operativo crítico: en el aplicativo viejo, una vez confirmado un proyecto no quedaba constancia formal de **qué exactamente se confirmó**, lo que generaba disputas frecuentes con interventoría sobre qué versión del proyecto era la "oficial" para SECOP.

El módulo agrega tres capacidades:

1. **Snapshot inmutable.** Cada vez que el proponente confirma el proyecto (paso de estado **0/2 → 1**), el sistema toma un snapshot completo del proyecto en JSON (datos de empresa, contactos, AFs con todo su detalle, presupuesto, GO, transferencia, UTs, perfiles, grupos, coberturas, materiales, recursos didácticos) y lo guarda en `PROYECTOVERSION` con un **código único legible** (ej. `PRY-2024-00012-V1`) y un **hash SHA-256** del contenido.

2. **Versión final oficial.** Entre todas las versiones existentes, el proponente marca **una y solo una** como la **VERSIÓN FINAL** que envía a SECOP. Mientras una versión está marcada como final, el proyecto queda **congelado**: no se puede desconfirmar ni editar. Esta es la versión que el SENA aprobará oficialmente.

3. **Anulación de borradores.** Las versiones intermedias que el proponente considera obsoletas se pueden **anular** (soft-delete). Quedan en histórico pero dejan de aparecer en la lista útil de versiones. La versión marcada como FINAL no puede anularse.

> **Estado del módulo:** funcionalidad completa, con el flujo Confirmar → Marcar Final → Anular borradores operando en producción local. Pendiente: integración con el módulo de aprobación SENA (informe 23) para validar que solo la versión FINAL puede aprobarse.

---

## 2. Flujo General

```
Estado del proyecto = 0 (Borrador)
         │
         ▼
Proponente edita libremente
         │
         ▼
Click "Confirmar proyecto"
         │
         ▼
PROYECTOESTADO 0 → 1 + crea PROYECTOVERSION V1
                  + snapshot JSON completo
                  + código único PRY-XXXXX-V1
                  + hash SHA-256
         │
         ▼
Estado del proyecto = 1 (Confirmado)
   │
   ├── Click "Desconfirmar" → estado 1 → 2 (edición reabierta)
   │      │
   │      └── Edita → vuelve a confirmar → crea V2 con nuevo snapshot
   │
   └── Click "Marcar como FINAL" en una versión
              │
              ▼
         VERSIONESFINAL = 1
         Proyecto queda congelado (no se puede desconfirmar)
         Esta es la versión oficial para SENA / SECOP
              │
              ▼
         Click "Desmarcar FINAL" (reversa)
              │
              ▼
         VERSIONESFINAL = 0
         Proyecto puede desconfirmarse de nuevo
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/proyectos/[id]/versiones/page.tsx`

### Lo que hace la pantalla

- **Lista todas las versiones del proyecto** ordenadas de más reciente a más antigua, con: número de versión, código único, fecha y usuario que la generó, estado del proyecto al momento del snapshot, hash SHA-256 (colapsado por defecto, expandible), comentario opcional del proponente, y dos badges visuales: **FINAL** (verde) y **ANULADA** (gris tachado).
- **Encabezado con el estado actual** del proyecto y un resumen: cuántas versiones existen, cuál es la versión FINAL si la hay, cuántas están anuladas.
- **Botones de acción por versión:**
  - **Marcar como FINAL** — solo visible en versiones no anuladas y cuando no existe otra FINAL. Confirma con modal antes de aplicar.
  - **Desmarcar FINAL** — revierte la versión final actual; el proyecto vuelve a poder desconfirmarse.
  - **Anular** — soft-delete del borrador. Pide comentario opcional.
  - **Restaurar** — quita la marca de anulada.
  - **Ver snapshot** — abre modal con el JSON completo de la versión, formateado y con buscador (útil para auditoría).
- **Banner de proyecto congelado** cuando hay una versión FINAL: el proponente no puede desconfirmar ni editar el proyecto desde otras pantallas; los botones aparecen deshabilitados con tooltip explicativo.
- **Lenguaje claro para el usuario** — los códigos técnicos como `SHA-256` aparecen colapsados por defecto y se etiquetan como "Huella digital de integridad" para no abrumar al proponente. El correo del usuario que generó la versión se trunca con tooltip.

### Acceso al módulo

Desde la pantalla de gestionar proyecto (`/panel/proyectos/[id]`), pestaña/sección **"Versiones"** o link explícito en el header. También accesible directamente vía URL si el usuario conoce el `proyectoId`.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | Endpoints REST de versiones |
| `backend/src/proyectos/proyectos.service.ts` | Métodos `crearVersion`, `listarVersiones`, `getVersion`, `marcarVersionFinal`, `desmarcarVersionFinal`, `anularVersion`, `restaurarVersion` |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST`   | `/proyectos/:id/versiones` | Crea una nueva versión (snapshot + hash). Se invoca automáticamente al confirmar el proyecto y manualmente desde la UI cuando el proponente quiere "guardar punto de control" |
| `GET`    | `/proyectos/:id/versiones` | Lista las versiones del proyecto (incluye anuladas, marcadas con flag) |
| `GET`    | `/proyectos/versiones/:versionId` | Devuelve el snapshot completo de una versión (JSON) |
| `POST`   | `/proyectos/:id/versiones/:versionId/final` | Marca la versión como FINAL. Si ya hay otra FINAL, falla con 400 |
| `DELETE` | `/proyectos/:id/versiones/:versionId/final` | Desmarca FINAL — el proyecto vuelve a poder desconfirmarse |
| `POST`   | `/proyectos/:id/versiones/:versionId/anular` | Anula la versión (soft-delete). Falla si la versión es FINAL |
| `DELETE` | `/proyectos/:id/versiones/:versionId/anular` | Restaura la versión |

### Lógica clave del snapshot

El método `crearVersion` arma un objeto JS con **todas las tablas vivas relacionadas con el proyecto**:

```ts
const snapshot = {
  proyecto:           await this.getProyectoCompleto(proyectoId),
  empresa:            await this.getEmpresaProyecto(...),
  contactos:          await this.getContactosProyecto(...),
  acciones: await Promise.all(afs.map(async af => ({
    af:               await this.getAFCompleta(af.id),
    rubros:           await this.getRubros(af.id),
    go:               await this.getGastosOperacion(af.id),
    transferencia:    await this.getTransferencia(af.id),
    grupos:           await this.getGrupos(af.id),
    coberturas:       await this.getCoberturas(af.id),
    unidadesTematicas:await this.getUTs(af.id),
    perfiles:         await this.getPerfilesUT(af.id),
    actividades:      await this.getActividadesUT(af.id),
    materiales:       await this.getMateriales(af.id),
    recursos:         await this.getRecursos(af.id),
    areasFuncionales: await this.getAreasFuncionales(af.id),
    nivelesOcupacionales: await this.getNivelesOcupacionales(af.id),
    sectoresProductivos:  await this.getSectores(af.id),
    gestionConocimiento:  await this.getGestion(af.id),
  }))),
}
```

El JSON se serializa, se calcula el SHA-256 con `crypto.createHash('sha256')`, y se guarda en la columna CLOB `VERSIONSNAPSHOT`. El código único (`VERSIONCODIGO`) se construye con el formato `PRY-{convocatoriaId}-{proyectoIdPad}-V{versionNumero}`.

### Marcar versión final

```ts
async marcarVersionFinal(proyectoId, versionId) {
  // 1. Verifica que no exista otra versión FINAL
  const otra = await ds.query(
    `SELECT 1 FROM PROYECTOVERSION
      WHERE PROYECTOID = :1 AND VERSIONESFINAL = 1`, [proyectoId])
  if (otra.length) throw new BadRequest('Ya existe versión FINAL — desmarque primero')

  // 2. Marca esta versión como FINAL
  await ds.query(
    `UPDATE PROYECTOVERSION
        SET VERSIONESFINAL = 1, VERSIONFINALFECHA = SYSDATE, VERSIONFINALUSUARIO = :1
      WHERE PROYECTOVERSIONID = :2`, [usuarioEmail, versionId])

  // 3. Refuerza estado del proyecto = 1 (Confirmado)
  // El proyecto no podrá desconfirmarse mientras VERSIONESFINAL = 1
}
```

El **índice único condicional** definido en `v15_proyecto_version_final_anulada.sql` actúa como salvavidas a nivel BD: si dos peticiones concurrentes intentan marcar versiones distintas como final, la segunda viola el índice y la transacción falla limpiamente.

### Anular versión

`anularVersion` no hace DELETE — actualiza `VERSIONANULADA = 1` y registra fecha/usuario. La versión sigue existiendo y se puede restaurar. Es **imposible anular la versión FINAL** (validación en backend).

---

## 5. Modelo de datos

### Tabla `PROYECTOVERSION`

| Columna | Tipo | Notas |
|---|---|---|
| `PROYECTOVERSIONID` (PK) | NUMBER | Generado por `PROYECTOVERSION_SEQ` |
| `PROYECTOID` (FK) | NUMBER | A qué proyecto pertenece |
| `VERSIONNUMERO` | NUMBER | Correlativo dentro del proyecto (1, 2, 3, …) — UNIQUE con `PROYECTOID` |
| `VERSIONCODIGO` | VARCHAR2(60) | Código único legible global, ej. `PRY-2024-00012-V1` |
| `VERSIONFECHA` | TIMESTAMP | Default `SYSDATE` |
| `VERSIONUSUARIO` | VARCHAR2(200) | Email del usuario que creó la versión |
| `VERSIONSNAPSHOT` | CLOB | JSON completo con el estado del proyecto en ese instante |
| `VERSIONHASH` | VARCHAR2(64) | SHA-256 del JSON serializado |
| `VERSIONESTADOAL` | NUMBER | Estado del proyecto al momento del snapshot (1=Confirmado, etc.) |
| `VERSIONCOMENTARIO` | VARCHAR2(2000) | Texto opcional del proponente al confirmar |
| `VERSIONESFINAL` | NUMBER(1) | 0/1. Solo una versión por proyecto puede tener 1 |
| `VERSIONANULADA` | NUMBER(1) | 0/1. Soft-delete |
| `VERSIONFINALFECHA` | TIMESTAMP | Cuándo se marcó FINAL |
| `VERSIONFINALUSUARIO` | VARCHAR2(200) | Quién marcó FINAL |
| `VERSIONANULADAFECHA` | TIMESTAMP | Cuándo se anuló |
| `VERSIONANULADAUSUARIO` | VARCHAR2(200) | Quién anuló |

### Restricciones / índices clave

- `UQ_PROYECTOVERSION_NUM (PROYECTOID, VERSIONNUMERO)` — el correlativo es único por proyecto.
- `UQ_PROYECTOVERSION_COD (VERSIONCODIGO)` — el código único es global.
- `UX_PROYECTOVERSION_FINAL` — índice único condicional sobre `CASE WHEN VERSIONESFINAL = 1 THEN PROYECTOID ELSE NULL END`. Garantiza que solo haya una versión final por proyecto. El truco con `NULL` en columna única evita que Oracle indexe filas no-final, permitiendo que cualquier proyecto tenga muchas versiones no-final pero solo una marcada.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | A nivel controlador |
| `ParseIntPipe` en todos los `:id` y `:versionId` | Rechaza IDs no numéricos |
| Validación de pertenencia | Se verifica que la versión pertenezca al proyecto antes de cualquier mutación |
| Marcar/Desmarcar FINAL solo si proyecto está en estado 1 | Backend rechaza si el proyecto está en borrador (0) o reversado (2) |
| Una sola versión FINAL garantizada en BD | Índice único condicional como red de seguridad ante races |
| Snapshot inmutable | El CLOB nunca se modifica después del INSERT — toda corrección requiere nueva versión |
| Hash SHA-256 | Permite verificar que el snapshot no ha sido alterado a posteriori (auditoría) |
| `synchronize: false` (TypeORM) | Schema inmutable desde la app |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Vista vacía: proyecto sin versiones | Proyecto recién creado, sin haber confirmado nunca |
| 2 | Lista con V1 (confirmado por primera vez) | Después de primera confirmación |
| 3 | Lista con V1 + V2 (confirmar → desconfirmar → editar → confirmar) | Tras ciclo de edición |
| 4 | Modal "¿Marcar V2 como FINAL?" | Click "Marcar FINAL" en V2 |
| 5 | Lista con V2 marcada como FINAL (badge verde) y banner de proyecto congelado | Después de marcar |
| 6 | Versión anulada con badge gris y opción de restaurar | Anular V1 después de tener V2 |
| 7 | Modal "Ver snapshot JSON" con buscador | Click en el icono de ojo |
| 8 | Tooltip de la huella digital expandida | Hover sobre el hash |
| 9 | Error "Ya existe versión FINAL" al intentar marcar otra | Forzar el caso |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Control de Versiones de Proyecto implementado

---

Cordial saludo,

Se informa que el **módulo de Control de Versiones del Proyecto** del nuevo SEP, una funcionalidad nueva sin equivalente directo en el aplicativo GeneXus, se encuentra implementado y operativo. Resuelve el problema histórico de no tener constancia formal y verificable de qué versión exacta del proyecto fue la confirmada para SECOP.

**Funcionalidades entregadas:**
- Snapshot inmutable en formato JSON cada vez que el proponente confirma el proyecto, capturando todas las tablas vivas relacionadas (datos de empresa, contactos, acciones de formación con presupuesto detallado, unidades temáticas, perfiles de capacitadores, grupos, coberturas, materiales, recursos didácticos, etc.)
- Asignación de un código único legible por versión (formato `PRY-{convocatoria}-{proyecto}-V{n}`) y hash SHA-256 del snapshot serializado, para verificación de integridad e identificación única ante terceros
- Marcado de **una y solo una versión FINAL** por proyecto, garantizado a nivel de base de datos por índice único condicional, que congela el proyecto y lo deja como la versión oficial enviable a SENA
- Anulación reversible de versiones obsoletas (soft-delete) sin perder el histórico, con bloqueo automático para impedir anular la versión final
- Pantalla de gestión de versiones con visualización clara para el proponente: badges de FINAL/ANULADA, banner de proyecto congelado, modal para revisar el JSON completo de cualquier versión, y traducción de términos técnicos (SHA-256 → "Huella digital de integridad") para evitar abrumar al usuario no técnico
- Reglas de negocio aplicadas en backend y reforzadas en BD: imposible tener dos versiones finales simultáneas, imposible anular la versión final, imposible desconfirmar mientras hay una versión final, snapshot CLOB inmutable después del INSERT
- Trazabilidad completa: por cada versión queda registrado quién la creó, cuándo, en qué estado estaba el proyecto, y si fue marcada como final o anulada — con fechas y usuarios independientes

**En curso:** integración bidireccional con el módulo de Aprobación de Proyectos (informe 23) para que el flujo de aprobación SENA opere exclusivamente sobre la versión marcada como FINAL.

Se adjunta informe técnico con el detalle de los **7 endpoints REST**, el modelo de datos de `PROYECTOVERSION` con sus 14 columnas y el flujo Confirmar → Marcar FINAL → Anular borradores.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
