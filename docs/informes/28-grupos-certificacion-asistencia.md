# Informe de Desarrollo — Módulo AF·Grupos, Certificación y Reporte de Asistencia
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Junio 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación del **núcleo operativo del seguimiento**: la gestión de los grupos por AF (cobertura, beneficiarios, meta vs cumplido), la certificación de horas por UT/sesión y la generación del **Reporte de Asistencia** en Excel con el formato legacy F2.x/F3.1 que exige el SENA.

En el SEP GeneXus estos tres flujos vivían en módulos separados con duplicación de datos; en el nuevo SEP comparten un origen común (`AFGRUPOBENEFICIARIO` y `UTHORAS`) y se exponen en sub-rutas anidadas bajo el grupo, lo que mantiene el contexto del usuario en todo momento.

**Regla clave**: `CERTIFICA = 'SI'` si `porcentajeCumplimiento >= 80` (mínimo de horas asistidas por beneficiario en la UT).

**Nomenclatura**: el legacy decía "cupos llenos" pero los grupos pueden sobre-ejecutar; en el nuevo SEP se cambió a **META** (con label "% de la meta" y "META CUMPLIDA"/"SOBRE-EJECUTADO").

Pantallas: `/convenios/[id]/grupos`, `/grupos/[afGrupoId]/certificar`, `/grupos/[afGrupoId]/asistencia`.

---

## 2. Flujo General

```
/grupos  (listado de grupos por AF con meta/registrados/certificados)
       │
       ├── Modal "Beneficiarios del grupo"  →  toggle ACTIVO/RETIRADO
       │       con validaciones (5%, mismo AF)
       │
       ├── Modal "Cobertura geográfica"  →  ciudades rurales/urbanas
       │
       └── Click "Certificar"  →  /grupos/[afGrupoId]/certificar
                │
                ▼  Selector UT  +  tabla beneficiario × sesiones
                │
                ├── Por fila: editar horas / "llenar con máx" (varita) / Guardar (verde)
                │
                ├── "Certificar masivamente" (botón morado)
                │       → POST masivo: llena con máx para cada beneficiario activo,
                │         omite filas con total > 0 para no sobrescribir
                │
                └── "Reporte Asistencia" → /grupos/[afGrupoId]/asistencia
                         │
                         ▼  Vista institucional F2.x/F3.1 + Descarga Excel
                            (ExcelJS, fill 00304D, headers merged, freeze panes)
```

---

## 3. Frontend

| Archivo | Rol |
|---|---|
| `panel/convenios/[id]/grupos/page.tsx` | Cards por AF·grupo con stats |
| `panel/convenios/[id]/grupos/[afGrupoId]/certificar/page.tsx` | Tabla beneficiario × sesión |
| `panel/convenios/[id]/grupos/[afGrupoId]/asistencia/page.tsx` | Reporte F2.x/F3.1 + descarga Excel |
| `components/convenios/grupo-beneficiarios-modal.tsx` | Beneficiarios del grupo con toggles |
| `components/convenios/grupo-cobertura-modal.tsx` | Cobertura rural/urbana |

- **Cards de grupo**: META vs registrados vs certificados, chip "% de la meta" (verde/amarillo), botón "Certificar" en morado `#7C3AED`, botón "Reporte" en azul.
- **Página Certificar**: selector UT en cabecera; tabla con sticky N° y nombre; columnas dinámicas por sesión; búsqueda por nombre/identificación; "llenar máx" por fila (varita cerulean) + Guardar (verde).
- **Modal certificar masivamente**: header morado, lista cuántos beneficiarios serán afectados, confirma con CTA explícita.
- **Página Asistencia**: header institucional (SENA · GGPC · SEP), card con formato F2.x/F3.1, tabla densa con UTs y sesiones, descarga Excel.

---

## 4. Backend

### Archivos

| Archivo | Rol |
|---|---|
| `grupos/grupos.service.ts` | Listado, cobertura, beneficiarios, toggle, dedup, Excel 39 columnas |
| `grupos/grupos.controller.ts` | Endpoints REST |
| `certificacion/certificacion.service.ts` | UTHoras, certificar individual/masivo, reporte asistencia |
| `certificacion/certificacion.controller.ts` | Endpoints REST |

### Endpoints clave

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/grupos/:proyectoId/acciones` | AFs activas (excluye transferencia) |
| `GET` | `/grupos/:proyectoId/grupos` | Grupos con meta/registrados/certificados |
| `GET` | `/grupos/grupo/:afGrupoId/beneficiarios` | Beneficiarios del grupo |
| `POST` | `/grupos/grupo/:afGrupoId/persona/:personaId/estado` | Toggle ACTIVO/RETIRADO |
| `GET` | `/certificacion/proyecto/:p/grupo/:g/unidad/:u/beneficiarios` | Tabla certificación |
| `POST` | `/certificacion/proyecto/:p/grupo/:g/unidad/:u/persona/:pid` | Guardar horas individual |
| `POST` | `/certificacion/proyecto/:p/grupo/:g/unidad/:u/masivo` | Certificar masivo |
| `GET` | `/certificacion/proyecto/:p/grupo/:g/asistencia/excel` | Excel F2.x/F3.1 |

### Reglas críticas

- **Schema `UTHORAS`**: columnas `UTHORAS1..UTHORAS20` (una por sesión) + `UTHORASTOTAL`. El service hace upsert por `(PERSONAID, PERFILUTID)`.
- **Recalculo de certifica**: tras cada guardado, `porcentajeCumplimiento = (UTHORASTOTAL / maxUT) * 100`, `CERTIFICA = pct >= 80 ? 'SI' : 'NO'`.
- **Masivo skip**: si una fila ya tiene `UTHORASTOTAL > 0`, el endpoint masivo NO la sobrescribe.
- **Excel F2.x/F3.1** con ExcelJS: header merges, fill `#00304D` (azul corporativo), notas en `#8AC8A3` (verde), freeze panes. Nombres de UT **completos** en headers (no truncados a "UT 1"). Ancho proporcional al nombre.
- **NCHAR safe**: concatenación de director con `N' '` y `N''` para `ORA-12704`.
- **`assertConvenioEnEjecucion`** en cada escritura.

---

## 5. Modelo de datos

| Tabla | Notas |
|---|---|
| `AFGRUPO` | Grupos de cada AF con cupos meta |
| `AFGRUPOBENEFICIARIO` | Persona ↔ grupo con `PORCENTAJECUMPLIMIENTO`, `CERTIFICA`, `HORAS*` (todos NOT NULL) |
| `UTHORAS` | Filas `UTHORAS1..20 + UTHORASTOTAL` por persona × UT |
| `AFGRUPOCOBERTURA` | Ciudades cubiertas por grupo (rural SI/NO) |

`AFGRUPOBENEFICIARIO` debe inicializarse con `0`/`'NO'` en todos los NOT NULL al insertar (bug `ORA-01400` corregido).

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a controladores |
| `assertConvenioEnEjecucion` | En cada escritura |
| `ParseIntPipe` | En todos los ids de ruta |
| Aislamiento por empresa | Salvo perfiles SENA/interventoría/admin |
| Sesiones con `outFormat: OBJECT` | `oracledb.OUT_FORMAT_OBJECT` para columnas como propiedades |

---

## 7. Pantallazos sugeridos

| # | Qué capturar |
|---|---|
| 1 | Cards de grupos con stats META / REGISTRADOS / CERTIFICADOS |
| 2 | Modal "Beneficiarios del grupo" con toggle Activar/Retirar |
| 3 | Página Certificar con tabla beneficiario × sesión y selector UT |
| 4 | Botón varita "Llenar con máx" en una fila |
| 5 | Modal certificar masivamente (header morado) |
| 6 | Página Asistencia con formato F2.x/F3.1 |
| 7 | Excel descargado con headers azules `#00304D` |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo AF·Grupos, Certificación y Reporte de Asistencia implementado

---

Cordial saludo,

Se informa que el **módulo AF·Grupos, Certificación y Reporte de Asistencia** del nuevo SEP ha sido finalizado y se encuentra en pruebas. Constituye el núcleo operativo del seguimiento del convenio.

**Funcionalidades entregadas:**
- Listado de grupos por AF con tarjetas que muestran META, registrados y certificados (renombrado desde "cupos" porque los grupos pueden sobre-ejecutar)
- Modales de beneficiarios del grupo (con toggle activar/retirar y validaciones) y de cobertura geográfica (rural/urbana)
- Página de Certificación por UT con tabla dinámica beneficiario × sesión, búsqueda, acción "llenar con máximo" por fila y guardado individual
- **Certificación masiva** con confirmación previa, que omite filas ya certificadas para no sobrescribir
- Recalculo automático de `CERTIFICA = SI` cuando el porcentaje de cumplimiento alcanza el 80%
- **Reporte de Asistencia** con formato institucional F2.x/F3.1, encabezados merged y fill azul corporativo `#00304D`
- Descarga del reporte en Excel `.xlsx` con ExcelJS, headers blancos sobre azul, freeze panes y columnas con ancho proporcional al nombre de la UT
- Validación transversal "convenio en ejecución" en todas las escrituras

Se adjunta informe técnico con los **8 endpoints** del módulo, el esquema `UTHORAS` y la lógica de recalculo de certificación.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
