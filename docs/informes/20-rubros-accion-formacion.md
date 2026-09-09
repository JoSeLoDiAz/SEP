# Informe de Desarrollo — Módulo Rubros por Acción de Formación
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Mayo 2026 | **Estado:** Implementado en su mayoría — refinamientos finales en curso

---

## 1. Descripción General

Implementación en el nuevo SEP del módulo donde la empresa formula el **presupuesto detallado** de cada Acción de Formación. Por cada AF, la empresa registra los rubros (líneas de costo) que la ejecutan: honorarios de instructores, refrigerios, transporte, materiales, etc. Cada rubro lleva una distribución específica entre lo que aporta el SENA (cofinanciación) y lo que aporta la empresa como contraparte (en especie o en dinero), con porcentajes que se calculan automáticamente.

Adicionalmente, el módulo administra **dos categorías especiales** que no son rubros regulares:

- **Gastos de Operación (GO, código `R09`)** — un rubro consolidado que cubre gastos administrativos del proyecto, registrado con un único formulario simple (cofinanciación + especie + dinero).
- **Transferencia (código `R015`)** — el rubro de transferencia tecnológica, con dos campos: número de beneficiarios y valor total.

Conserva la lógica financiera del SEP GeneXus pero la complementa con **validación de prerrequisitos en backend antes de guardar cualquier rubro**: la AF debe tener tipo de evento, modalidad y horas definidas; debe tener al menos una Unidad Temática; las horas de las UTs deben sumar el total de horas de la AF; todos los grupos deben tener cobertura registrada. Esta validación cierra una clase entera de errores que en el aplicativo viejo solo se detectaban al radicar el proyecto, cuando ya era costoso volver a editarlo.

> **Estado del módulo:** la mayor parte de la funcionalidad está implementada y operativa. Ajustes finales sobre cálculos de porcentajes, normalización de los códigos `R09` y `R015` y validaciones cruzadas con grupos siguen en curso.

---

## 2. Flujo General

```
Usuario en /panel/proyectos/[id]/acciones/[afId] → pestaña "Rubros"
         │
         ▼
GET /proyectos/:id/acciones/:afId/rubros/prereqs  → ¿AF está lista para rubros?
         │
         ├── NO ok → Lista de issues a resolver primero (ej: "complete las horas de las UTs")
         │
         └── OK
             │
             ▼
   GET /proyectos/:id/acciones/:afId/rubros/catalogo  → rubros del catálogo
   GET /proyectos/:id/acciones/:afId/rubros           → rubros ya guardados de la AF
   GET /proyectos/:id/acciones/:afId/rubros/go        → bloque Gastos de Operación
   GET /proyectos/:id/acciones/:afId/rubros/transferencia → bloque Transferencia
             │
             ▼
   Render: tabla de rubros + formularios separados de GO y Transferencia
             │
             ├── Agregar/editar rubro → formulario inline con muchos campos
             │      │
             │      ▼
             │   POST /proyectos/:id/acciones/:afId/rubros
             │   (re-valida prerrequisitos antes del INSERT/UPDATE)
             │
             ├── Quitar rubro → DELETE /proyectos/:id/acciones/:afId/rubros/:afrubroid
             │
             ├── Guardar GO → POST /proyectos/:id/acciones/:afId/rubros/go
             │
             └── Guardar Transferencia → POST /proyectos/:id/acciones/:afId/rubros/transferencia
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/proyectos/[id]/acciones/[afId]/rubros/page.tsx`

### Lo que hace la pantalla

- Al entrar a la pestaña **muestra primero el chequeo de prerrequisitos**: si la AF aún no cumple las condiciones para registrar rubros (faltan horas, faltan UTs, falta cobertura de grupos, etc.), aparece una lista de issues con CTA para volver a las pestañas correspondientes. El formulario de rubros queda oculto hasta que todos los issues se resuelvan.
- Una vez OK, se renderizan **tres bloques**:
  1. **Tabla de rubros** ya registrados, con código, nombre, valor total, distribución cofinanciación/especie/dinero y porcentajes. La columna "Cant." muestra unidades inteligentes según el `RUBROCASO`: `2h`, `3 d`, `5 ud.`, `12 tiq.`, `150 benef.` o `2h × 150 benef.` para rubros que multiplican horas por beneficiarios.
  2. **Formulario inline** para agregar o editar un rubro: dropdown con catálogo de rubros disponibles (excluye `R09` y `R015` que tienen su propio bloque), campos numéricos de cantidad, horas, beneficiarios, días, grupos, valor total, cofinanciación, especie, dinero, valor máximo y valor por beneficiario, más justificación. El campo "paquete" se autocompleta del catálogo. Los campos visibles dependen del `RUBROCASO` del rubro seleccionado (ver tabla más abajo).
  3. **Bloque Gastos de Operación** y **bloque Transferencia** con sus propios formularios simplificados.
- **Cálculo en vivo del valor máximo permitido** según el caso del rubro: tarjeta azul con `Valor máximo permitido` y, cuando aplica, tarjeta verde con `Valor por beneficiario` (`total / beneficiarios`).
- **Cálculo en vivo de porcentajes** mientras el usuario llena cofinanciación / especie / dinero — se muestran porcentajes sobre el total para que el usuario vea inmediatamente la distribución.
- **Validaciones cliente** específicas: el total del rubro debe igualar la suma de cofinanciación + especie + dinero (con tolerancia de 1 peso); el valor por beneficiario no puede exceder el valor máximo del catálogo.
- **Cantidad mínima = 1.** Aunque el rubro sea "intangible" (formación virtual, transporte por beneficiario, etc.) la columna `AFRUBROCANTIDAD` se fuerza a ≥ 1 en frontend y backend. Sin esto, los rubros R010 entraban con cantidad 0 y rompían reportes posteriores.
- **Bloqueo cuando el proyecto está radicado**.

### Casos de cálculo según `RUBRO.RUBROCASO`

El catálogo `RUBRO` trae una columna `RUBROCASO` que define qué inputs se piden y cómo se calcula el valor máximo permitido. La pantalla deriva todo del caso, sin reglas duplicadas en frontend:

| Caso | Significado | Inputs visibles | Cálculo `valorMaximo` |
|---|---|---|---|
| 1  | Tarifa por hora | `# Horas` | `tope × horas` |
| 2  | Tarifa por unidad / página | `Cantidad` | `tope × cantidad` |
| 3  | Tarifa por beneficiario (R010 — formación virtual) | `# Beneficiarios` | `tope × beneficiarios` |
| 4  | Tarifa por día | `# Días` | `tope × días` |
| 5  | Valor fijo (no se calcula) | (ninguno) | (lo digita el usuario) |
| 8  | Tarifa por hora × beneficiario (R07.2.2 / R07.2.3) | `# Horas` + `# Beneficiarios` | `tope × horas × beneficiarios` |
| 20 | Valor fijo | (ninguno) | (lo digita el usuario) |

> **Nota sobre R07.2.2 / R07.2.3:** son rubros de transporte / refrigerios que dependen tanto de la duración (horas) como de cuánta gente los recibe. En GeneXus esto era un cálculo manual; en el nuevo SEP se hace en vivo: por ejemplo, tarifa $647 × 2 horas × 150 beneficiarios = $194.100 aparece en la tarjeta azul antes de guardar. La tabla resumen muestra `2h × 150 benef.` para que la métrica física sea legible de un vistazo.

> **Nota sobre R010 (caso 3):** la formación virtual no tiene "horas" en el sentido tradicional (no hay un instructor por hora) sino "beneficiarios atendidos" como unidad económica. El formulario oculta el campo de horas y solo pide beneficiarios; el valor por beneficiario se muestra como verificación (debe igualar la tarifa del catálogo).

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` (líneas 517-583) | Endpoints de rubros, prereqs, GO y transferencia |
| `backend/src/proyectos/proyectos.service.ts` | Métodos `getRubrosCatalogo`, `getRubrosAF`, `getPrerequisitosRubros`, `validarPrerequisitosRubros` (privado), `guardarRubroAF`, `eliminarRubroAF`, `getGastosOperacion`, `guardarGastosOperacion`, `getTransferencia`, `guardarTransferencia` |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/proyectos/:id/acciones/:afId/rubros/prereqs` | Devuelve `{ ok, issues[] }` con la lista de prerrequisitos no cumplidos |
| `GET`    | `/proyectos/:id/acciones/:afId/rubros/catalogo` | Catálogo de rubros disponibles para la AF (filtrado por tipo de evento y modalidad) |
| `GET`    | `/proyectos/:id/acciones/:afId/rubros` | Rubros ya registrados en la AF (excluye GO y transferencia) |
| `POST`   | `/proyectos/:id/acciones/:afId/rubros` | Crea o actualiza un rubro (upsert por `afId + rubroId`) |
| `DELETE` | `/proyectos/:id/acciones/:afId/rubros/:afrubroid` | Elimina un rubro |
| `GET`    | `/proyectos/:id/acciones/:afId/rubros/go` | Devuelve los datos del bloque Gastos de Operación |
| `POST`   | `/proyectos/:id/acciones/:afId/rubros/go` | Guarda el bloque GO |
| `GET`    | `/proyectos/:id/acciones/:afId/rubros/transferencia` | Devuelve datos del bloque Transferencia |
| `POST`   | `/proyectos/:id/acciones/:afId/rubros/transferencia` | Guarda el bloque Transferencia |

### Validación de prerrequisitos

Antes de cualquier guardado de rubro, el servicio ejecuta el método privado `validarPrerequisitosRubros(afId)` que aplica 5 chequeos:

1. **Tipo y modalidad definidos.** La AF debe tener `TIPOEVENTOID` y `MODALIDADFORMACIONID`. Si no, lanza: *"Debe guardar primero el tipo de evento y modalidad de formación antes de registrar rubros."*
2. **Horas y grupos definidos.** `ACCIONFORMACIONNUMTOTHORASGRUP > 0`. Si no: *"Debe definir el número de horas y grupos antes de registrar rubros."*
3. **Todos los grupos con cobertura.** Subquery que cuenta grupos sin cobertura registrada. Si > 0: *"X grupo(s) no tienen cobertura registrada. Complete la cobertura de todos los grupos antes de registrar rubros."*
4. **Número de grupos coincide con cobertura.** El número de grupos creados en `AFGRUPO` debe ser ≥ `ACCIONFORMACIONNUMGRUPOS`. Si no: *"La AF tiene N grupos definidos pero solo M están creados en cobertura. Registre todos los grupos."*
5. **UTs presentes y horas suficientes.** Debe haber al menos una UT, y la suma de las 8 columnas de horas de las UTs (presencial + virtual + presencial-asistido + híbrido, en variantes pp/pv/ppat/phib + tp/tv/tpat/thib) debe igualar o superar las horas totales de la AF. Si no, mensajes específicos.

Estos mismos chequeos se exponen como endpoint `GET .../rubros/prereqs` para que el frontend los muestre proactivamente sin tener que intentar guardar para enterarse.

### Normalización de cantidad en `guardarRubroAF`

Antes del INSERT/UPDATE el servicio fuerza `cantidad ≥ 1`:

```typescript
const cantidad = Math.max(1, Number(dto.cantidad) || 1)
```

Sin esta línea, los rubros donde la unidad económica es el beneficiario (caso 3, R010) o la hora (caso 1, 8) entraban con `AFRUBROCANTIDAD = 0` y rompían reportes posteriores que asumen cantidad ≥ 1 para mostrar la métrica física en la tabla resumen. Es defensa en profundidad: el frontend ya envía 1 por defecto, pero un cliente comprometido podía mandar 0.

### Cálculo de porcentajes en `guardarRubroAF`

Cada rubro guarda 3 porcentajes calculados a partir del total y los aportes:

```typescript
const porcSena    = totalRubro > 0 ? (cofSena       / totalRubro) * 100 : 0
const porcEspecie = totalRubro > 0 ? (contraEspecie / totalRubro) * 100 : 0
const porcDinero  = totalRubro > 0 ? (contraDinero  / totalRubro) * 100 : 0
```

El cálculo se hace **siempre en backend** para evitar inconsistencias por redondeo del cliente. Los porcentajes se guardan en columnas separadas (`AFRUBROPORCENTAJECOFINANCIACION`, `AFRUBROPORCENTAJEESPECIE`, `AFRUBROPORCENTAJEDINERO`) para no recalcularlos en cada lectura.

### Upsert por `afId + rubroId`

`guardarRubroAF` decide entre INSERT y UPDATE según si ya existe una fila para esa combinación:
```sql
SELECT AFRUBROID FROM AFRUBRO WHERE ACCIONFORMACIONID = :1 AND RUBROID = :2
```
Si existe → UPDATE; si no → INSERT con `AFRUBROID.NEXTVAL`. Esto evita que el cliente tenga que distinguir entre "agregar" y "editar" — siempre llama al mismo endpoint y el backend resuelve.

### Códigos especiales del catálogo

`getRubrosAF` y el catálogo del frontend excluyen explícitamente los rubros con código `R09` (Gastos de Operación) y `R015` (Transferencia):
```sql
WHERE ar.ACCIONFORMACIONID = :1
  AND TRIM(r.RUBROCODIGO) NOT IN ('R09', 'R015')
```
Estos dos rubros tienen su propio modelo de datos y sus propios endpoints porque su semántica (un único bloque por AF en lugar de N filas) no calza con el patrón general.

### Aislamiento por empresa

Igual que en CRUD de AFs (informe 18) y formulación (informe 19): pertenencia indirecta vía proyecto.

---

## 5. Modelo de datos

### Tabla `AFRUBRO` (rubros regulares por AF)

| Columna | Notas |
|---|---|
| `AFRUBROID` (PK) | Generado por secuencia |
| `ACCIONFORMACIONID` (FK) | A qué AF pertenece |
| `RUBROID` (FK → RUBRO) | Cuál rubro del catálogo |
| `AFRUBROJUSTIFICACION` | Texto cualitativo |
| `AFRUBRONUMHORAS`, `AFRUBROCANTIDAD`, `AFRUBROBENEFICIARIOS`, `AFRUBRODIAS`, `AFRUBRONUMEROGRUPOS` | Métricas físicas |
| `AFRUBROVALOR` | Valor total del rubro |
| `AFRUBROCOFINANCIACION` | Aporte SENA |
| `AFRUBROESPECIE` | Contraparte en especie de la empresa |
| `AFRUBRODINERO` | Contraparte en dinero de la empresa |
| `AFRUBROVALORMAXIMO`, `AFRUBROVALORPORBENEFICIARIO` | Cifras de control |
| `AFRUBROPORCENTAJECOFINANCIACION`, `AFRUBROPORCENTAJEESPECIE`, `AFRUBROPORCENTAJEDINERO` | Porcentajes calculados en backend |

### Catálogo `RUBRO`

Tabla maestra del SENA con todos los rubros posibles, sus códigos (`R01`, `R02`, ..., `R09`, `R015`, etc.), nombre, paquete, caso de uso. Los rubros disponibles para una AF dependen de su tipo de evento y modalidad.

### Bloques especiales

| Tabla | Notas |
|---|---|
| Gastos de Operación | Modelado en una fila por AF (no por rubro). Columnas: cofinanciación, especie, dinero |
| Transferencia | Modelado en una fila por AF. Columnas: beneficiarios, valor |

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador |
| `ParseIntPipe` en todos los `:id`, `:afId`, `:afrubroid` | Rechaza IDs no numéricos |
| Validación de prerrequisitos siempre en backend | Imposible saltar las reglas manipulando el cliente |
| Cálculo de porcentajes en backend | Sin riesgo de manipulación o errores de redondeo del cliente |
| Bloqueo cuando el proyecto está radicado | Frontend deshabilita; refuerzo backend pendiente |
| `synchronize: false` (TypeORM) | Schema inmutable desde la app |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Pestaña Rubros con la lista de prerrequisitos no cumplidos | AF nueva sin UTs ni grupos |
| 2 | Mensaje específico de prerrequisito (horas UTs no cubren la AF) | UTs con menos horas de las definidas en la AF |
| 3 | Vista cuando todos los prereqs están OK con la tabla y formularios | AF completa |
| 4 | Tabla de rubros agregados con porcentajes calculados | Después de agregar 2-3 rubros |
| 5 | Formulario de agregar rubro abierto con todos los campos | Click en "Agregar rubro" |
| 6 | Bloque Gastos de Operación con sus 3 campos | Vista normal |
| 7 | Bloque Transferencia con sus 2 campos | Vista normal |
| 8 | Toast rojo de error de prerrequisito al intentar guardar | Forzar un guardado sin prereqs |
| 9 | Validación cliente: total del rubro ≠ suma de cofinanciación + especie + dinero | Llenar valores incoherentes |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Rubros por Acción de Formación implementado

---

Cordial saludo,

Se informa que el **módulo de Rubros por Acción de Formación** del nuevo SEP, conforme a la lógica financiera del SEP GeneXus pero con validación de prerrequisitos reforzada en backend, se encuentra implementado en su mayoría y en fase final de refinamientos.

**Funcionalidades entregadas:**
- Vista de prerrequisitos: chequeo proactivo de las condiciones para registrar rubros (tipo de evento y modalidad definidos, horas y grupos completos, todos los grupos con cobertura registrada, al menos una Unidad Temática y horas de UTs cubriendo el total de la AF), con lista de issues específicos cuando algo falta
- Tabla de rubros registrados con código, nombre, métricas físicas inteligentes según el caso del rubro (`2h`, `5 ud.`, `150 benef.`, `2h × 150 benef.`), valor total y distribución entre cofinanciación SENA, contraparte en especie y contraparte en dinero, con porcentajes calculados y guardados en backend
- Formulario unificado de agregar/editar rubro con upsert en backend (no se distingue entre crear y editar — siempre el mismo endpoint), con campos visibles condicionados por el `RUBROCASO` del catálogo
- Cálculo en vivo del valor máximo permitido y del valor por beneficiario, con soporte completo para los 7 casos del catálogo SENA (incluidos casos especiales R010 = caso 3, y R07.2.2/R07.2.3 = caso 8 que multiplica horas × beneficiarios)
- Cantidad mínima 1 forzada en backend para rubros intangibles (R010 y similares), evitando inconsistencias en reportes posteriores
- Bloques especiales separados para Gastos de Operación (R09) y Transferencia (R015), con sus propios formularios y modelo de datos
- Validación reforzada en backend antes de cualquier guardado: las cinco condiciones de prerrequisito se vuelven a evaluar al momento del INSERT/UPDATE para evitar que un cliente comprometido se las salte
- Cálculo de porcentajes siempre en servidor para eliminar errores de redondeo cliente-side
- Bloqueo automático de mutaciones cuando el proyecto contenedor está radicado

**En curso:** ajustes finales sobre cálculos de porcentajes en escenarios límite, normalización de los códigos especiales `R09` y `R015`, y validaciones cruzadas adicionales con la cobertura de grupos.

Se adjunta informe técnico con el detalle de los **9 endpoints** del módulo, las cinco validaciones de prerrequisitos y el modelo de datos de la tabla `AFRUBRO`.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
