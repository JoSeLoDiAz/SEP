# Informe de Desarrollo — Módulo Contactos
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo Contactos replica funcionalmente la pantalla `ContactosEmpresa.aspx` del SEP GeneXus. Permite a usuarios con perfil Empresa/Gremio/Asociación (perfilId=7) gestionar la **libreta de contactos institucional** de su organización: representante legal, responsable del proyecto y contacto administrativo. Cada contacto puede estar **sin asignar** o **asociado a un proyecto específico** del catálogo de la empresa.

El módulo se expone en dos lugares de la aplicación:

- **`/panel/contactos`** — la libreta general de la empresa: alta, edición y baja de contactos.
- **Pestaña "Contactos del proyecto"** dentro de cada proyecto — operaciones contextuales para asignar contactos existentes al proyecto, crear uno nuevo ya asociado, o desasignar (sin borrar de la libreta).

Ambas vistas operan sobre la misma tabla Oracle (`CONTACTOEMPRESA`) y respetan el aislamiento por empresa: un usuario nunca ve ni puede modificar contactos de otra organización.

---

## 2. Flujo General

```
Usuario accede a /panel/contactos (autenticado, perfilId=7)
         │
         ▼
Carga paralela:
  GET /contactos              → contactos de la empresa (con proyecto asociado)
  GET /contactos/proyectos    → catálogo de proyectos para el dropdown
  GET /contactos/tipos-doc    → tipos de identificación
         │
         ▼
Render: tabla en desktop, tarjetas en móvil
         │
         ├── Agregar contacto    → POST /contactos       → toast verde + recarga
         ├── Editar contacto     → PUT /contactos/:id    → toast verde + recarga
         └── Eliminar contacto   → modal de confirmación → DELETE /contactos/:id
```

Flujo desde el módulo de proyectos:

```
Usuario en /panel/proyectos/[id] → pestaña "Contactos del proyecto"
         │
         ├── GET /proyectos/:id/contactos             → ya asignados
         ├── GET /proyectos/:id/contactos/disponibles → libres para asignar
         │
         ├── Asignar existente   → PUT  /proyectos/:id/contactos/:contactoId/asignar
         ├── Crear nuevo         → POST /proyectos/:id/contactos
         └── Desasignar          → DELETE /proyectos/:id/contactos/:contactoId
                                  (no borra: solo lo regresa a "sin asignar")
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/contactos/page.tsx`

### Lo que hace la pantalla

- Carga **en paralelo** los contactos, el catálogo de proyectos y los tipos de identificación, para que la página esté lista de un solo viaje.
- Muestra **tabla en escritorio y tarjetas en móvil** mediante el split `hidden md:block` / `md:hidden`. Ambas vistas se alimentan del mismo arreglo de contactos.
- Un **único formulario inline** sirve para crear y editar — el estado `editandoId` define el modo (`null` = nuevo, número = edición).
- El campo **Cargo es un catálogo cerrado** de 3 valores (`Representante Legal`, `Responsable del Proyecto`, `Contacto Administrativo`) para evitar variaciones tipográficas que romperían filtros posteriores.
- **Validación previa** en el cliente: nombre, cargo y correo son obligatorios. Si faltan, se cancela el envío y se muestra un toast rojo.
- **Modal de confirmación** antes de borrar; mientras el borrado está en curso, el botón "Cancelar" del modal queda deshabilitado para evitar cerrarlo a mitad de la request.
- El proyecto asociado se muestra como un **badge** con el nombre del proyecto, o como texto en gris cursivo "No asignado a proyecto" cuando no tiene.
- Sistema de **toast con re-mount forzado** (key incremental) para que dos toasts del mismo tipo en sucesión se vean correctamente.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/contactos/contactos.controller.ts` | 6 endpoints REST de la libreta general |
| `backend/src/contactos/contactos.service.ts` | Lógica de listado, alta, edición y baja |
| `backend/src/contactos/contactos.module.ts` | Wiring NestJS (importa `Empresa` y `AuthModule`) |
| `backend/src/proyectos/proyectos.controller.ts` (líneas 185-217) | 5 subendpoints contextuales al proyecto |
| `backend/src/proyectos/proyectos.service.ts` (líneas 215-282) | Métodos de listado, asignación y desasignación |

### Endpoints — superficie `/contactos`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/contactos` | Lista los contactos de la empresa, con el nombre del proyecto resuelto |
| `GET` | `/contactos/proyectos` | Catálogo de proyectos de la empresa (para el dropdown) |
| `GET` | `/contactos/tipos-doc` | Tipos de identificación filtrados a personas naturales (excluye NIT) |
| `POST` | `/contactos` | Crea un contacto. Si no se asigna proyecto, queda con el sentinel "sin asignar" |
| `PUT` | `/contactos/:id` | Actualiza un contacto. Solo afecta filas de la empresa que invoca |
| `DELETE` | `/contactos/:id` | Borra el contacto. Solo afecta filas de la empresa que invoca |

### Endpoints — superficie `/proyectos/:id/contactos`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/proyectos/:id/contactos` | Contactos ya asignados al proyecto |
| `GET` | `/proyectos/:id/contactos/disponibles` | Contactos de la empresa NO asignados a este proyecto |
| `POST` | `/proyectos/:id/contactos` | Crea un contacto YA asociado al proyecto en una sola operación |
| `PUT` | `/proyectos/:id/contactos/:contactoId/asignar` | Mueve un contacto existente al proyecto |
| `DELETE` | `/proyectos/:id/contactos/:contactoId` | Desasigna del proyecto (no borra la libreta) |

### Sentinel "sin asignar" (`PROYECTO_SIN_ASIGNAR = 1`)

El modelo legacy GeneXus no usa `NULL` para representar "contacto sin proyecto", sino una fila técnica en la tabla `PROYECTO` con id `1`. Se preserva esta convención por compatibilidad con datos históricos. El backend la maneja transparentemente:

- Al **insertar** sin proyecto → escribe `PROYECTOIDCONTACTOS = 1`.
- Al **leer** → mapea tanto `1` como `NULL` a `proyectoNombre: null` para que el frontend solo conozca el caso "sin asignar" como un único valor `null`.
- Al **desasignar** desde un proyecto → no borra la fila, solo vuelve `PROYECTOIDCONTACTOS = 1`.

### Aislamiento por empresa

Antes de cualquier operación, el servicio resuelve el `empresaId` desde el email del JWT y lo añade como cláusula `WHERE EMPRESAIDCONTACTO = :empresaId` en SELECT, UPDATE y DELETE. Nunca se acepta el `empresaId` desde el body o la URL — es imposible que un usuario actúe sobre contactos de otra organización.

### Listado de contactos disponibles para asignar

La query de "disponibles" utiliza `LEFT JOIN PROYECTO` y la cláusula:
```
WHERE c.EMPRESAIDCONTACTO = :empresaId
  AND (c.PROYECTOIDCONTACTOS != :proyectoId OR c.PROYECTOIDCONTACTOS IS NULL)
```
El `OR ... IS NULL` es necesario porque en SQL `NULL != X` evalúa a `UNKNOWN` (no `TRUE`), por lo que sin esa cláusula se excluirían filas con `NULL` legacy. Resultado: aparecen los contactos sin asignar y los asignados a otro proyecto, con un campo extra `proyectoActual` que indica dónde están actualmente para que el usuario decida si quiere moverlos.

---

## 5. Modelo de datos

### Tabla `CONTACTOEMPRESA`

| Columna | Notas |
|---|---|
| `CONTACTOEMPRESAID` (PK) | Autogenerado por trigger/secuencia legacy |
| `EMPRESAIDCONTACTO` (FK → EMPRESA) | Filtro de aislamiento, siempre presente |
| `CONTACTOEMPRESANOMBRE` | Obligatorio |
| `CONTACTOEMPRESACARGO` | Validado en cliente contra catálogo cerrado de 3 valores |
| `CONTACTOEMPRESACORREO` | Obligatorio |
| `CONTACTOEMPRESATELEFONO` | Opcional |
| `CONTACTOEMPRESADOCUMENTO` | Opcional |
| `TIPOIDENTIFICACIONCONTACTOP` (FK → TIPODOCUMENTOIDENTIDAD) | Opcional. La `P` final del nombre viene del legacy GeneXus |
| `PROYECTOIDCONTACTOS` (FK → PROYECTO) | Default `1` (sentinel sin-asignar). `NULL` se trata igual |

### Tabla `TIPODOCUMENTOIDENTIDAD` (lectura)

Se filtra a `TIPODOCUMENTOIDENTIDADPERSONA = 1` para excluir tipos de empresa. Resultado típico: CC, CE, TI, PA.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador — los 6 endpoints requieren JWT válido |
| `@CurrentUser()` | El email se extrae del JWT, no del body — identidad no falsificable |
| Filtro `EMPRESAIDCONTACTO = :empresaId` | Aplicado en SELECT, UPDATE y DELETE — aislamiento estricto entre empresas |
| `ParseIntPipe` en `:id` | Rechaza IDs no numéricos antes de tocar el servicio |
| Borrado físico solo desde libreta general | El endpoint contextual del proyecto NO borra, solo desasigna |
| `synchronize: false` (TypeORM) | Nunca modifica el schema de Oracle automáticamente |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Vista desktop con tabla de contactos (mezcla asignados y sin asignar) | `/panel/contactos` con datos de prueba |
| 2 | Vista móvil con tarjetas | DevTools → 375px |
| 3 | Formulario "Nuevo contacto" abierto, dropdown de Cargo desplegado | Click en "Agregar contacto" |
| 4 | Formulario "Editar" pre-llenado | Click en lápiz de un contacto existente |
| 5 | Toast verde "Contacto registrado correctamente" | Llenar form y guardar |
| 6 | Toast rojo "Nombre, cargo y correo son obligatorios" | Intentar guardar con campos vacíos |
| 7 | Modal de confirmación de eliminación con nombre del contacto | Click en basura |
| 8 | Pestaña "Contactos del proyecto" con asignados + disponibles | `/panel/proyectos/[id]` → pestaña Contactos |
| 9 | Estado vacío sin contactos | Empresa nueva sin contactos creados |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Contactos implementado

---

Cordial saludo,

Se informa que el **módulo de Contactos** del nuevo SEP, equivalente a la pantalla `ContactosEmpresa.aspx` del SEP GeneXus, ha sido implementado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Listado, creación, edición y eliminación de contactos institucionales (representante legal, responsable de proyecto, contacto administrativo)
- Asociación opcional de cada contacto a un proyecto específico de la empresa
- Vista responsive: tabla en escritorio, tarjetas en dispositivos móviles
- Validación de campos obligatorios en cliente (nombre, cargo y correo)
- Carga paralela de catálogos para minimizar la latencia inicial
- Modal de confirmación previo al borrado
- Operaciones contextuales desde la vista del proyecto: asignar contacto existente, crear nuevo asociado, desasignar (sin borrar de la libreta)
- Aislamiento estricto por empresa: todas las queries filtran por la organización derivada del JWT

Se adjunta informe técnico con el detalle de los **11 endpoints** del módulo, las queries Oracle involucradas y el manejo del valor sentinel heredado del modelo legacy para representar "contacto sin proyecto".

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
