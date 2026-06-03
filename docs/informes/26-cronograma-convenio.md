# Informe de Desarrollo — Módulo Cronograma del Convenio
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Junio 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Implementación del **cronograma de ejecución de las acciones de formación** del convenio. Permite a la empresa programar las sesiones presenciales y virtuales por Unidad Temática (UT), asignar capacitadores aprobados y radicar el cronograma ante el SENA por cortes mensuales.

En el SEP GeneXus el cronograma se llenaba en una tabla plana con postbacks por celda; en el nuevo SEP se reimaginó como un **calendario visual** que muestra las sesiones en su ubicación temporal real y permite editarlas con click, conservando todas las reglas de negocio de modalidad y horas.

**Regla clave de modalidades**: las modalidades 1 (presencial), 2 (PAT) y 3 (híbrida) graban en `CRONOGRAMAPRESENCIAL`. Solo la modalidad 4 (virtual) graba en `CRONOGRAMAVIRTUAL`. Las AFs marcadas como transferencia (`ACCIONFORMACIONTRANSFERENCIA != 0`) quedan **excluidas** del módulo conveniente.

Pantallas: `/convenios/[id]/cronograma` y `/convenios/[id]/cronograma/radicar`.

---

## 2. Flujo General

```
Empresa entra a /cronograma
       │
       ▼  GET /cronograma/:proyectoId  →  AFs activas + UTs + sesiones existentes
       │
       ▼  Render: calendario por AF/UT con sesiones colocadas en su fecha
       │
       ├── Click "Agregar sesión"
       │        │  Modal: fecha, hora inicio, hora fin, capacitador, sigla
       │        │
       │        ▼  POST /cronograma/:af/ut/:utId/presencial   (o /virtual)
       │            assertConvenioEnEjecucion + upsert con NVL(MAX(id),0)+1
       │
       ├── Click sobre sesión → PATCH para editar campos
       │
       └── Cierre de corte → /cronograma/radicar
                │
                ▼  Genera radicado con consecutivo, queda el corte cerrado
                   y el cronograma del periodo se vuelve solo lectura
```

---

## 3. Frontend

| Archivo | Rol |
|---|---|
| `panel/convenios/[id]/cronograma/page.tsx` | Calendario visual + modales de sesión |
| `panel/convenios/[id]/cronograma/radicar/page.tsx` | Cierre de corte mensual |
| `components/cronograma/cronograma-calendario.tsx` | Componente calendario reutilizable |

- **Calendario visual** con vista por AF: filas = UTs, columnas = fechas. Cada celda muestra las sesiones existentes con su sigla y horas.
- **Modal de sesión**: campos fecha, hora inicio (15 min steps), hora fin, capacitador (combobox de aprobados), URL si es virtual.
- **Filtros**: selector de AF al inicio (excluye transferencia automáticamente).
- **Página Radicar**: lista cortes pendientes con total de horas y botón "Radicar este corte". Genera consecutivo y bloquea edición posterior.

---

## 4. Backend

### Archivos

| Archivo | Rol |
|---|---|
| `cronograma/cronograma.service.ts` | Lógica de UPSERT + radicación |
| `cronograma/cronograma.controller.ts` | Endpoints REST |
| `cronograma/dto/*.dto.ts` | Validación de DTOs (sesión presencial/virtual, patch, upsert) |

### Endpoints clave

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/cronograma/:proyectoId` | AFs + UTs + sesiones existentes |
| `POST` | `/cronograma/sesion/presencial` | Agregar sesión presencial (modalidades 1/2/3) |
| `POST` | `/cronograma/sesion/virtual` | Agregar sesión virtual (modalidad 4) |
| `PATCH` | `/cronograma/sesion/presencial/:id` | Actualizar campos puntuales |
| `PATCH` | `/cronograma/sesion/virtual/:id` | Idem virtual |
| `POST` | `/cronograma/:proyectoId/radicar` | Radicar corte mensual |

### Reglas críticas

- **Modalidad → tabla**: el `helperModalidad(afId)` retorna `'presencial'` o `'virtual'` según `MODALIDADID`. Solo `MODALIDADID = 4` va a virtual.
- **AFs de transferencia excluidas**: filtro `AND a.ACCIONFORMACIONTRANSFERENCIA = 0` en el listado.
- **Sin solapamiento por capacitador**: antes de insertar/actualizar, query que verifica que ese capacitador no tenga otra sesión en el mismo rango horario.
- **`assertConvenioEnEjecucion`** al inicio de cada mutación.
- **Radicado con consecutivo**: `NVL(MAX(CRONOGRAMARADICADOCONSEC), 0) + 1` por proyecto.
- **Sesiones radicadas son inmutables**: el PATCH valida que la sesión no esté vinculada a un radicado cerrado.

---

## 5. Modelo de datos

| Tabla | Notas |
|---|---|
| `CRONOGRAMAPRESENCIAL` | Sesiones de modalidades 1/2/3. `CRONOGRAMAPRESID` (PK), `ACCIONFORMACIONID`, `PERFILUTID`, `CAPACITADORID`, fechas, horas, sigla, radicado |
| `CRONOGRAMAVIRTUAL` | Sesiones modalidad 4. Similar con campos `URL`, `USUARIOSENA`, `CLAVESENA`, `PROVEEDOR` |
| `CRONOGRAMARADICADO` | Cabecera del radicado mensual: consec, fecha, total horas, usuario que radicó |

Conversión de hora: `:30` se almacena como `0.5` (decimal) en columnas NUMBER; `:00` como `0`, `:15` como `0.25`, etc.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | A nivel controlador |
| `assertConvenioEnEjecucion` | En cada mutación |
| DTOs con `class-validator` | Validación tipada en presencial/virtual/patch/upsert |
| Validación de modalidad | Backend rechaza si AF y tabla no coinciden |
| Sesiones radicadas inmutables | PATCH/DELETE bloqueado si `CRONOGRAMARADICADOID` no nulo |
| `ParseIntPipe` | Rechaza IDs no numéricos |

---

## 7. Pantallazos sugeridos

| # | Qué capturar |
|---|---|
| 1 | Calendario por AF con varias sesiones colocadas |
| 2 | Modal "Agregar sesión" con campos llenos |
| 3 | Combobox de capacitadores aprobados |
| 4 | Toast rojo "Solapamiento horario del capacitador" |
| 5 | Página Radicar con corte pendiente |
| 6 | Cronograma radicado en modo solo lectura |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Cronograma del convenio implementado

---

Cordial saludo,

Se informa que el **módulo Cronograma del convenio** del nuevo SEP ha sido finalizado y se encuentra en pruebas. Sustituye la tabla plana con postbacks del SEP GeneXus por un calendario visual que conserva todas las reglas de modalidad, horas y radicación por cortes.

**Funcionalidades entregadas:**
- Calendario visual por AF/UT con sesiones colocadas en su fecha real, editables con un click
- Modal de sesión con fecha, horas en pasos de 15 minutos, capacitador (combobox de aprobados) y URL para sesiones virtuales
- **Separación correcta por modalidad**: modalidades 1, 2 (PAT) y 3 graban en `CRONOGRAMAPRESENCIAL`; solo la modalidad 4 va a `CRONOGRAMAVIRTUAL`
- **Exclusión automática** de AFs de transferencia (`ACCIONFORMACIONTRANSFERENCIA != 0`) del módulo conveniente
- Validación de no solapamiento de horarios por capacitador
- Radicación mensual de cortes con consecutivo automático y bloqueo de edición posterior
- Validación transversal "convenio en ejecución" aplicada a todas las escrituras

Se adjunta informe técnico con los **6 endpoints** del módulo, la separación por modalidad y las reglas de inmutabilidad post-radicación.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
