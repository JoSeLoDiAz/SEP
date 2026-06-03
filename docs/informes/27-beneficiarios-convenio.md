# Informe de Desarrollo — Módulo Beneficiarios del Convenio
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Junio 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación del **registro y administración de beneficiarios** del convenio: las personas a quienes el SENA destina la formación. Cubre el alta con HabeasData, la asociación de la empresa beneficiaria (empleador del aprendiz), la asociación rápida a un grupo (modal único reutilizado en distintos puntos), la separación entre activos e inactivos y el reporte Excel con 39 columnas en el formato del SEP legacy.

En el SEP GeneXus el flujo estaba dividido en cinco pantallas con saltos entre ellas; en el nuevo SEP se reagrupa en **una página única** con stepper (Datos → Postulación → Asociar) y los flujos secundarios (registrar empresa beneficiaria, asociar rápido) viven en modales para no perder el contexto.

**Regla clave del 5%**: un beneficiario puede estar en máximo dos AFs distintas. La regla solo aplica cuando la persona ya pertenece a otra AF — al agregarla a una AF nueva, el porcentaje de repetidos del proyecto no debe superar el 5%.

Pantallas: `/convenios/[id]/beneficiarios`, `/convenios/[id]/beneficiarios/registrar`, `/convenios/[id]/beneficiarios/empresas`.

---

## 2. Flujo General

```
/beneficiarios   (cabecera con 4 botones: Empresa · Registrar · + Asociar · Grupos)
       │
       ▼  GET /convenios/:id/beneficiarios  →  activos + inactivos + meta empresa
       │
       ├── + Asociar  (modal asociar-rapido)
       │       │  Busca por identificación → 4 estados:
       │       │    sin-persona  →  CTA "Ir a registrar"
       │       │    sin-postulación → registrar postulación
       │       │    desactualizada → actualizar datos
       │       │    vigente → asociar directo a AF/grupo
       │
       ├── Registrar (stepper)
       │       Datos → Postulación → Asociar a grupo
       │       Auto-search por ?tipoDocumentoId&identificacion
       │
       ├── Empresa beneficiaria (modal inline)
       │       Si no existe, se crea sin salir de la pantalla
       │
       └── Ver inactivos → lista separada con label "INACTIVO"
```

---

## 3. Frontend

| Archivo | Rol |
|---|---|
| `panel/convenios/[id]/beneficiarios/page.tsx` | Listado activos + acceso a inactivos |
| `panel/convenios/[id]/beneficiarios/registrar/page.tsx` | Stepper de registro completo |
| `panel/convenios/[id]/beneficiarios/empresas/page.tsx` | Listado de empresas beneficiarias |
| `components/convenios/asociar-rapido-modal.tsx` | Modal 4-estados con CTAs por situación |
| `components/convenios/registrar-empresa-modal.tsx` | Alta inline de empresa beneficiaria |
| `components/convenios/asociar-grupo-modal.tsx` | Selección de AF/grupo final |

- **Cabecera 4 botones**: Empresa beneficiaria · Registrar · + Asociar · Grupos (en ese orden, igual al legacy).
- **Stats bar responsive**: total · activos · inactivos · % cumplido. Search wraps en mobile.
- **Modal asociar-rápido** muestra el nombre de la persona en los 4 estados con CTAs específicas y un `onIrARegistrar(tipoDoc, num)` que abre el stepper precargado.
- **Toast en errores**: la validación 5% y "1 grupo por AF" lanzan toast rojo en vez de error inline.

---

## 4. Backend

### Archivos

| Archivo | Rol |
|---|---|
| `convenios/convenios.service.ts` | Lista, asociar, cambiar estado, empresas, registro persona |
| `convenios/convenios.controller.ts` | Endpoints REST |
| `personas/personas.service.ts` | Upsert PERSONA + HABEASDATA |

### Endpoints clave

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/convenios/:id/beneficiarios` | Activos + inactivos + flag convenioEnEjecucion |
| `POST` | `/convenios/:id/beneficiarios` | Registrar beneficiario (persona + postulación) |
| `POST` | `/convenios/:id/beneficiarios/asociar` | Asociar a AF/grupo (upsert preserva fila existente) |
| `POST` | `/convenios/:id/beneficiarios/:personaId/estado` | Activar/inactivar |
| `GET` | `/convenios/:id/beneficiarios/reporte` | Excel 39 columnas (compressed) |
| `POST` | `/convenios/beneficiarios/empresas` | Alta inline de empresa beneficiaria |

### Reglas críticas

- **Upsert al asociar**: si `(PERSONAID, AFGRUPOID)` ya existe, UPDATE a ACTIVO; solo INSERT si no existe. Previene duplicados (bug histórico de project 1350).
- **Regla 5%** (solo si `yaEra >= 1`): bloquea agregar a una AF si excede el 5% de repetidos del proyecto.
- **1 grupo por AF**: una persona no puede estar en dos grupos de la misma AF.
- **NOT NULL en AFGRUPOBENEFICIARIO**: `PORCENTAJECUMPLIMIENTO`, `NUMEROACTIVIDADES`, `CERTIFICA`, `HORAS*` se inicializan en `0`/`'NO'`.
- **Estado computado**: el "estado global" de la persona se calcula como ACTIVO si tiene al menos un grupo activo; afsGrupos del listado muestra solo grupos activos.
- **`assertConvenioEnEjecucion`** en cada escritura.

---

## 5. Modelo de datos

| Tabla | Notas |
|---|---|
| `PERSONA` | Datos básicos del beneficiario; vincula con CIUDAD |
| `POSTULACION` | PK compuesta `PERSONAID + POSTULACIONANO` |
| `HABEASDATA` | Versión + fecha aceptación |
| `AFGRUPOBENEFICIARIO` | Persona ↔ grupo de AF. Estados ACTIVO/RETIRADO |
| `EMPRESABENEFICIARIA` | Empresa empleadora del aprendiz |

`PERSONA` solo guarda `CIUDADID`; el departamento se deriva con JOIN a `CIUDAD`.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a controladores |
| `assertConvenioEnEjecucion` | En cada escritura |
| Aislamiento por empresa | Salvo perfiles SENA/interventoría/admin |
| `ParseIntPipe` | Rechaza IDs no numéricos |
| `synchronize: false` (TypeORM) | Schema inmutable |
| HabeasData obligatorio | Versión + aceptación al registrar |

---

## 7. Pantallazos sugeridos

| # | Qué capturar |
|---|---|
| 1 | Listado de beneficiarios con stats bar y 4 botones en cabecera |
| 2 | Modal asociar-rápido en estado "sin-persona" con CTA "Ir a registrar" |
| 3 | Stepper de registro en paso 2 (Postulación) |
| 4 | Modal alta de empresa beneficiaria |
| 5 | Toast rojo "Excede el 5% de repetidos del proyecto" |
| 6 | Lista de inactivos con label INACTIVO |
| 7 | Excel descargado (39 columnas) |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Beneficiarios del convenio implementado

---

Cordial saludo,

Se informa que el **módulo Beneficiarios del convenio** del nuevo SEP ha sido finalizado y se encuentra en pruebas. Reúne en una sola pantalla lo que en el SEP GeneXus estaba disperso entre cinco pantallas y agrega un flujo de asociación rápida que reduce significativamente el tiempo de gestión.

**Funcionalidades entregadas:**
- Listado responsive con stats de activos/inactivos y porcentaje de cumplimiento
- Stepper de registro completo (Datos → Postulación → Asociar) con auto-búsqueda por identificación
- Modal de **asociación rápida** con cuatro estados detectados automáticamente (sin persona / sin postulación / desactualizada / vigente) y CTAs específicas en cada caso
- Alta inline de empresa beneficiaria sin perder contexto de la pantalla actual
- Separación visual entre beneficiarios activos e inactivos con vista dedicada
- **Regla del 5%** de beneficiarios repetidos entre AFs aplicada en backend
- Regla "un beneficiario, un grupo por AF" validada en backend
- Reporte Excel con las 39 columnas exactas del SEP legacy, comprimido con SheetJS
- Validación transversal "convenio en ejecución" en todas las escrituras

Se adjunta informe técnico con los **6 endpoints** del módulo, las reglas de unicidad y el detalle del reporte Excel.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
