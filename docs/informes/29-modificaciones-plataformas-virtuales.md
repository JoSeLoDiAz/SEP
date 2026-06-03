# Informe de Desarrollo — Módulo Modificaciones y Plataformas Virtuales del Convenio
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Junio 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación de dos sub-módulos del convenio que **comparten patrón operativo**: el conveniente registra una solicitud, la interventoría y el SENA responden en sus propios flujos, y mientras no haya respuesta el conveniente puede editar; tras la respuesta, el registro queda **bloqueado** para el conveniente.

- **Modificaciones**: otrosíes, ajustes, prórrogas y demás cambios al convenio (cambio de director, ampliación de plazo, etc.).
- **Plataformas Virtuales**: accesos (link, usuario, clave) a las plataformas que el convenio requiere para la ejecución de las AFs virtuales.

En el SEP GeneXus cada uno tenía pantallas distintas con código duplicado para el registro y la edición; en el nuevo SEP comparten exactamente el mismo patrón: lista responsive + modal con sección editable + secciones readonly de respuesta interventoría/SENA + banner de bloqueo cuando ya hay veredicto.

**Pantallas**: `/convenios/[id]/modificaciones` y `/convenios/[id]/plataformas`.

---

## 2. Flujo General

```
Conveniente
       │
       ▼  POST /modificaciones/proyecto/:p   (o /plataformas-virtuales/proyecto/:p)
       │   → INSERT con defaults: estado=0/concepto=4 (Pendiente), respuestas=N' '
       │
       ▼  Estado: aún editable
       │
       ▼  PUT /...../:id
       │   exigirEditableConveniente:
       │      Modificaciones → bloquea si concepto != 4 OR aprobacionSena ∈ {1,2}
       │      Plataformas    → bloquea si estado ∈ {1,2}  OR valSena ∈ {1,2}
       │   IF bloqueado → ForbiddenException + banner ámbar al usuario
       │
Interventoría / SENA  (en otros módulos no construidos aún)
       │  Llenan radicado, concepto, observaciones, valSena, aprobacion
       │
       ▼  Conveniente vuelve a entrar
       │   El modal muestra los datos editables PERO deshabilitados,
       │   y abajo los paneles readonly "Respuesta interventoría" y "Respuesta SENA"
       │   con chips de color según el veredicto.
```

---

## 3. Frontend

| Archivo | Rol |
|---|---|
| `panel/convenios/[id]/modificaciones/page.tsx` | Lista de modificaciones |
| `panel/convenios/[id]/plataformas/page.tsx` | Lista de plataformas con clave ocultable + copiar |
| `components/convenios/modificacion-modal.tsx` | Modal con 3 campos editables + paneles readonly |
| `components/convenios/plataforma-virtual-modal.tsx` | Modal con 4 campos editables + paneles readonly |

- **Listas**: tabla con buscador, chips de estado por color, botones Editar/Eliminar (admin), botón Exportar.
- **Modal**: header con icono + título; cuerpo scrolleable (`min-h-0` + `overflow-y-auto`); secciones con `shrink-0` para no comprimirse.
- **Banner "bloqueado"**: ámbar con icono de candado y motivo específico (`"La interventoría ya emitió concepto (VIABLE)"`, etc.).
- **Plataformas**: ojito mostrar/ocultar clave, botón copiar al portapapeles para usuario y clave, link clickeable a la plataforma.

---

## 4. Backend

### Archivos

| Archivo | Rol |
|---|---|
| `modificaciones/modificaciones.service.ts` | CRUD + Excel 28 columnas |
| `plataformas-virtuales/plataformas-virtuales.service.ts` | CRUD + Excel 24 columnas |
| Ambos controllers | Endpoints REST |

### Endpoints (idénticos en ambos módulos, cambia el path raíz)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/.../proyecto/:p` | Lista + flag convenioEnEjecucion |
| `GET` | `/.../proyecto/:p/:id` | Detalle para el modal |
| `POST` | `/.../proyecto/:p` | Crear (solo campos del conveniente) |
| `PUT` | `/.../proyecto/:p/:id` | Actualizar (valida estado antes) |
| `DELETE` | `/.../proyecto/:p/:id` | Eliminar (solo admin) |
| `GET` | `/.../proyecto/:p/excel` | Excel con ExcelJS, fill `#00304D` |

### Reglas críticas

- **Defaults en INSERT**: Oracle trata `''` como NULL y muchas columnas son `NOT NULL`. Se usa `N' '` para textos NCHAR y `SYSDATE` para fechas placeholder (`FECRADRES`, `FECRADSENA` se actualizan cuando interventoría/SENA radiquen).
- **`exigirEditableConveniente`** en `actualizar`: query del estado actual, lanza `ForbiddenException` si la interventoría/SENA ya respondieron.
- **UPDATE selectivo**: solo `tipoModificacionId/fechaEnvio/observaciones` (modificaciones) o `fechaRemi/link/usuario/clave` (plataformas); el resto se preserva.
- **Eliminar solo admin** (`perfilId === 1`).
- **Excel**: ambos con ExcelJS, encabezados merged, fill `#00304D` blanco bold, columnas con ancho personalizado.
- **`assertConvenioEnEjecucion`** en cada escritura.

---

## 5. Modelo de datos

| Tabla | Columnas relevantes | Notas |
|---|---|---|
| `MODIFICACIONES` | `MODIFICACIONESCONCEPTO` (1..4), `MODIFICACIONESCONCEPTOSENA` (1..5), `MODIFICACIONESAPROBACIONSENA` (0/1/2), `MODIFICACIONESRESPUESTASENA` (1..3) | Bloqueo si concepto≠4 o aprobacionSena∈{1,2} |
| `PLATAFORMASVIRTUALES` | `PLATAFORMASVIRTUALESESTADO` (1..3), `PLATAFORMASVIRTUALESVALSENA` (0/1/2) | Bloqueo si estado∈{1,2} o valSena∈{1,2}. **Todas las columnas NOT NULL** |
| `TIPOMODIFICACION` | Catálogo | Combobox del modal |

Etiquetas: `1 VIABLE`, `2 NO VIABLE`, `3 VIABLE PARCIALMENTE`, `4 PENDIENTE`, `5 NO APLICA` (concepto SENA).

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | A nivel controlador |
| `assertConvenioEnEjecucion` | En cada escritura |
| `exigirEditableConveniente` | Bloqueo cuando interventoría/SENA ya respondieron |
| Eliminar solo admin | `perfilId === 1` |
| `ParseIntPipe` | En `proyectoId` e `id` |
| Validaciones de campos requeridos | Frontend + backend (DTO + service) |

---

## 7. Pantallazos sugeridos

| # | Qué capturar |
|---|---|
| 1 | Lista de modificaciones con chips de concepto por color |
| 2 | Modal "Agregar modificación" con 3 campos editables |
| 3 | Modal "Editar modificación" con banner ámbar "Modificación bloqueada" |
| 4 | Lista de plataformas virtuales con clave ocultada y botón ojito |
| 5 | Modal "Agregar plataforma virtual" con 4 campos editables |
| 6 | Excel de modificaciones (28 columnas) con headers azul `#00304D` |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulos Modificaciones y Plataformas Virtuales del convenio implementados

---

Cordial saludo,

Se informa que los **módulos Modificaciones y Plataformas Virtuales del convenio** del nuevo SEP han sido finalizados y se encuentran en pruebas. Ambos comparten un patrón unificado de operación: el conveniente registra, interventoría y SENA responden, y el sistema bloquea automáticamente la edición cuando ya hay veredicto.

**Funcionalidades entregadas (en ambos módulos):**
- Lista responsive con buscador y chips de estado por color
- Modal de registro/edición con la sección editable del conveniente y paneles readonly de "Respuesta de la interventoría" y "Respuesta del SENA"
- **Banner de bloqueo** con motivo específico cuando interventoría/SENA ya emitieron su concepto, y deshabilitación visual de los inputs
- Validación backend `exigirEditableConveniente` que evita la edición incluso si se manipula el frontend
- Eliminación restringida a perfil administrador
- Reporte Excel con ExcelJS y fill `#00304D` azul corporativo (28 columnas en Modificaciones, 24 en Plataformas)
- Validación transversal "convenio en ejecución" en todas las escrituras

**Específico de Plataformas Virtuales:**
- Clave oculta por defecto con botón ojito para mostrar/ocultar
- Copia rápida al portapapeles para usuario y clave
- Enlace clicable directo a la plataforma cuando el formato es `https://...`

Se adjunta informe técnico con los **12 endpoints** distribuidos en los dos módulos, la lógica de bloqueo `exigirEditableConveniente` y el manejo de columnas NOT NULL en `PLATAFORMASVIRTUALES`.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
