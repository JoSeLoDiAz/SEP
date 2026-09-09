# Informe de Desarrollo — Módulo Descarga de Proyecto en Excel
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación en el nuevo SEP del **módulo de descarga oficial del proyecto en Excel**. Reemplaza el reporte que en el aplicativo GeneXus se generaba sobre la base de datos viva (con riesgo de inconsistencias si el proyecto se editaba mientras se imprimía) por una **descarga determinística desde el snapshot inmutable** de la versión FINAL guardado en `PROYECTOVERSION`.

El módulo entrega dos modos de descarga:

1. **Descarga individual** — un Excel completo de un proyecto específico, generado a partir de la versión marcada como FINAL. Incluye todas las hojas necesarias para que un evaluador del SENA o un auditor SECOP tenga el proyecto entero a la vista sin abrir la aplicación.

2. **Descarga masiva** — un archivo ZIP con los Excel de varios proyectos a la vez, filtrable por estado (Confirmados, Aprobados, Rechazados). Permite al administrador SENA descargar de un solo movimiento toda una convocatoria para evaluación offline.

> **Estado del módulo:** funcionalidad completa, con el archivo Excel generado a partir del JSON congelado en `PROYECTOVERSION.VERSIONSNAPSHOT`. La descarga masiva incluye un header `X-Total-Generados` que reporta cuántos archivos se incluyeron en el ZIP, útil cuando el filtro por estados arroja menos resultados de los esperados.

---

## 2. Flujo General

### Descarga individual

```
Admin en /panel/admin/reportes/proyectos
         │
         ▼
GET /proyectos/admin/reportes/proyectos    → lista de proyectos (con FINAL)
         │
         ▼
Selecciona proyecto → click "Descargar Excel"
         │
         ▼
GET /proyectos/:id/excel
         │
         ▼
Backend: lee VERSIONSNAPSHOT de la versión FINAL
         + ExcelReportService.generarExcelProyecto(snapshot)
         │
         ▼
Stream de respuesta con .xlsx + Content-Disposition
         │
         ▼
Browser descarga "Proyecto_<empresa>_<codigoVersion>.xlsx"
```

### Descarga masiva

```
Admin abre modal "Descarga masiva" en /panel/admin/reportes/proyectos
         │
         ▼
Selecciona estados (1=Confirmado, 3=Aprobado, 4=Rechazado) y opcional convocatoriaId
         │
         ▼
GET /proyectos/admin/excel-bulk?estados=1,3&convocatoriaId=24
         │
         ▼
Backend: lista proyectos que cumplen el filtro Y tienen versión FINAL
         + Para cada uno: genera Excel desde snapshot
         + Empaqueta todos en un ZIP usando jszip
         + Header X-Total-Generados: <N>
         │
         ▼
Stream de respuesta con .zip + Content-Disposition
         │
         ▼
Browser descarga "Proyectos_<convocatoria>_<timestamp>.zip"
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/admin/reportes/proyectos/page.tsx`

### Lo que hace la pantalla

- **Lista de proyectos descargables** — solo proyectos con una versión marcada como FINAL son candidatos. Cada fila muestra: empresa, código del proyecto, convocatoria, estado actual (Confirmado/Aprobado/Rechazado), código de la versión FINAL (`PRY-XXXX-V2`), fecha en que se marcó FINAL, y un botón "Descargar Excel".
- **Filtros** por convocatoria, por estado del proyecto y por nombre/empresa, con búsqueda incremental.
- **Botón "Descarga masiva"** que abre un modal con:
  - Multi-select de estados (Confirmado, Aprobado, Rechazado).
  - Selector opcional de convocatoria (si vacío, descarga todas).
  - Vista previa del conteo de proyectos que cumplen el filtro antes de generar.
  - Botón "Descargar ZIP" que dispara la generación.
- **Indicador de progreso** durante la generación masiva (puede tomar varios segundos según el número de proyectos).
- **Manejo de respuesta vacía:** si el filtro arroja 0 proyectos, no se descarga archivo y se muestra un toast claro.
- **Bloqueo del botón** durante la descarga para evitar dobles clicks que generen ZIPs duplicados.
- **Solo visible para perfil admin** (verificado en backend; en frontend la ruta solo aparece en el sidebar para `perfilId = 1`).

### Acceso

Solo desde el panel admin. Ruta `/panel/admin/reportes/proyectos`. No expuesto al proponente.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | Endpoints REST (líneas 365-412) |
| `backend/src/proyectos/proyectos.service.ts` | Métodos `descargarExcelProyecto`, `descargarExcelMasivo` |
| `backend/src/proyectos/excel-report.service.ts` | Generador Excel — transforma snapshot JSON → workbook XLSX |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/proyectos/:id/excel` | Descarga el Excel de un proyecto. Stream `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Falla con 404 si el proyecto no tiene versión FINAL |
| `GET` | `/proyectos/admin/excel-bulk?estados=1,3,4&convocatoriaId=24` | Descarga ZIP con N Excel. Stream `application/zip`. Header `X-Total-Generados: <N>`. Si N=0 responde 204 No Content |

### Lógica del generador Excel

`ExcelReportService.generarExcelProyecto(snapshot)` arma un workbook con varias hojas, alimentadas exclusivamente del JSON congelado en `VERSIONSNAPSHOT`:

| Hoja | Contenido |
|---|---|
| **Resumen** | Datos de empresa, código de versión, fecha de confirmación, totales financieros consolidados |
| **Contactos** | Contactos de la empresa con cargo, email, teléfono |
| **Acciones de Formación** | Una fila por AF con código, nombre, modalidad, tipo de evento, horas, beneficiarios, grupos, valor total |
| **Presupuesto detallado** | Desglose de rubros por AF con código de rubro, valor, cofinanciación SENA, contraparte en especie, contraparte en dinero, porcentajes |
| **Gastos de Operación** | Bloque GO por AF |
| **Transferencia** | Bloque transferencia (R015) por AF |
| **Unidades Temáticas** | Por AF, con perfiles de capacitador, actividades de aprendizaje y horas por modalidad (presencial, virtual, presencial-asistido, híbrido — variantes prácticas/teóricas) |
| **Grupos y Cobertura** | Departamentos, ciudades y beneficiarios por grupo |
| **Materiales y Recursos** | Material de formación y recursos didácticos por AF |
| **Sectores y Áreas** | Áreas funcionales, niveles ocupacionales, sectores productivos |

Cada hoja se genera con la librería `xlsx` (SheetJS) usando `XLSX.utils.json_to_sheet`. El workbook se serializa a buffer y se envía como stream de respuesta.

### Generador masivo

```ts
async descargarExcelMasivo(estados: number[], convocatoriaId?: number) {
  const proyectos = await this.ds.query(
    `SELECT p.PROYECTOID, e.EMPRESARAZONSOCIAL, pv.VERSIONCODIGO, pv.VERSIONSNAPSHOT
       FROM PROYECTO p
       JOIN PROYECTOVERSION pv
         ON pv.PROYECTOID = p.PROYECTOID AND pv.VERSIONESFINAL = 1
       JOIN EMPRESA e ON e.EMPRESAID = p.EMPRESAID
      WHERE p.PROYECTOESTADO IN (${estados.join(',')})
        ${convocatoriaId ? 'AND p.CONVOCATORIAID = :1' : ''}`,
    convocatoriaId ? [convocatoriaId] : []
  )

  const zip = new JSZip()
  for (const p of proyectos) {
    const snapshot = JSON.parse(p.VERSIONSNAPSHOT)
    const buffer = this.excel.generarExcelProyecto(snapshot)
    const safeName = sanitize(p.EMPRESARAZONSOCIAL)
    zip.file(`${safeName}_${p.VERSIONCODIGO}.xlsx`, buffer)
  }
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  return { buffer: zipBuffer, total: proyectos.length }
}
```

El endpoint del controlador agrega el header `X-Total-Generados: <N>` con el número de Excel incluidos.

### Por qué se descarga del snapshot y no de tablas vivas

Esta es una decisión deliberada y crítica:

- El snapshot en `PROYECTOVERSION.VERSIONSNAPSHOT` es **inmutable**. Lo que se descarga es exactamente lo que el proponente confirmó.
- Si se generara desde tablas vivas, el reporte podría cambiar entre dos descargas si entretanto un admin (en estado 3 = Aprobado) modifica grupos o coberturas. Eso rompe el principio de "el archivo descargado es el documento oficial".
- El hash SHA-256 de la versión sigue siendo válido para verificación: cualquier auditor puede recalcular el hash del snapshot y verificar que coincide con `VERSIONHASH`.
- En estado **3 (Aprobado)** las tablas vivas pueden divergir del snapshot por modificaciones permitidas al admin SENA — esas quedan en `EJECUCIONLOG` (informe 23). El Excel **siempre** se genera del snapshot original aprobado, no de las tablas modificadas.

---

## 5. Modelo de datos

No introduce tablas nuevas — opera sobre `PROYECTOVERSION.VERSIONSNAPSHOT` (CLOB JSON) creado en el informe 21.

Las consultas usan los siguientes joins clave:

```sql
FROM PROYECTO p
JOIN PROYECTOVERSION pv ON pv.PROYECTOID = p.PROYECTOID
                       AND pv.VERSIONESFINAL = 1
JOIN EMPRESA e ON e.EMPRESAID = p.EMPRESAID
LEFT JOIN CONVOCATORIA c ON c.CONVOCATORIAID = p.CONVOCATORIAID
```

El filtro `pv.VERSIONESFINAL = 1` garantiza que solo se descargan proyectos con una versión oficial marcada.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | A nivel controlador |
| Validación de perfil admin en backend | Los endpoints `/excel` y `/excel-bulk` rechazan si `perfilId !== 1` |
| `ParseIntPipe` en `:id`, `convocatoriaId` | Rechaza IDs no numéricos |
| Sanitización del query param `estados` | Se parsea como array de números, se valida contra `[1,3,4]`, se construye SQL con valores literales blanco-listados (no concatenación de strings del cliente) |
| Sanitización de nombres de archivo en ZIP | `sanitize()` quita caracteres prohibidos en nombres de archivo Windows/Linux y limita longitud |
| 204 No Content cuando 0 resultados | Evita descargar un ZIP vacío que confunda al usuario |
| Sin caché de respuesta | Header `Cache-Control: no-store` para evitar que un proxy intermedio sirva un Excel desactualizado |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Lista de proyectos descargables con filtros | Pantalla principal con varios proyectos en estado 1 y 3 |
| 2 | Botón "Descargar Excel" individual con tooltip | Hover sobre la acción |
| 3 | Modal de descarga masiva con filtros | Click en "Descarga masiva" |
| 4 | Vista previa "X proyectos serán incluidos" | Modal con filtros aplicados |
| 5 | Toast de descarga exitosa con conteo | Después de descargar masivo |
| 6 | Excel descargado abierto: hoja Resumen | Abrir el archivo |
| 7 | Excel descargado: hoja Presupuesto detallado | Otra hoja del mismo Excel |
| 8 | Mensaje "0 proyectos cumplen el filtro" | Filtros que no matchean nada |
| 9 | Indicador de progreso durante descarga masiva | Generar ZIP con muchos proyectos |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Descarga de Proyecto en Excel implementado

---

Cordial saludo,

Se informa que el **módulo de Descarga de Proyecto en Excel** del nuevo SEP se encuentra implementado y operativo. Reemplaza el reporte del SEP GeneXus, que se generaba sobre la base de datos viva con riesgo de inconsistencias, por una descarga determinística desde el snapshot inmutable de la versión FINAL del proyecto guardado en la nueva tabla `PROYECTOVERSION`.

**Funcionalidades entregadas:**
- Descarga individual de proyecto en Excel oficial generado a partir del snapshot JSON congelado al momento de marcar la versión como FINAL, garantizando que el archivo descargado es exactamente el documento que se envió al SENA, independientemente de modificaciones posteriores en tablas vivas durante la fase de ejecución
- Descarga masiva en archivo ZIP con filtros por estado del proyecto (Confirmado, Aprobado, Rechazado) y por convocatoria, útil para evaluación offline o auditoría de toda una convocatoria de un solo movimiento
- Generación de Excel multi-hoja con: Resumen ejecutivo, Contactos, Acciones de Formación, Presupuesto detallado por rubros con porcentajes de cofinanciación y contraparte, Gastos de Operación, Transferencia, Unidades Temáticas con perfiles y actividades, Grupos y Cobertura territorial, Materiales y Recursos didácticos, Sectores productivos y Áreas funcionales
- Header `X-Total-Generados` en la respuesta masiva que indica cuántos archivos se incluyeron en el ZIP, para que el administrador valide rápidamente que el filtro fue el esperado
- Vista previa del conteo de proyectos antes de generar la descarga masiva
- Solo perfiles administrativos del SENA (`perfilId = 1`) tienen acceso a estos endpoints; el proponente no puede descargar Excel de proyectos ajenos
- Sanitización rigurosa de nombres de archivo dentro del ZIP para compatibilidad cross-OS y prevención de path traversal
- Respuesta `204 No Content` cuando ningún proyecto cumple el filtro, en lugar de un ZIP vacío que confundiría al usuario
- Compatibilidad mantenida con el flujo de aprobación: aunque el administrador SENA modifique grupos, coberturas o unidades temáticas en estado 3 (Aprobado), el Excel sigue generándose del snapshot original aprobado — los cambios posteriores quedan registrados en el módulo de Ejecución (auditoría con `EJECUCIONLOG`)

**En curso:** mejora de la presentación visual de las hojas (anchos de columna automáticos, totales destacados, encabezados con estilos del SENA).

Se adjunta informe técnico con el detalle de los **2 endpoints REST** (`/proyectos/:id/excel` y `/proyectos/admin/excel-bulk`), las **10 hojas** del workbook generado y la justificación arquitectónica de descargar desde snapshot en vez de tablas vivas.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
