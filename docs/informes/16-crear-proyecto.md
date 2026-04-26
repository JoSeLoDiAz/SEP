# Informe de Desarrollo — Módulo Crear Nuevo Proyecto
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo Crear Nuevo Proyecto replica funcionalmente el modal de creación que aparece en `Proyectos.aspx` del SEP GeneXus. Permite a la empresa o gremio (perfilId=7) iniciar un nuevo proyecto seleccionando la convocatoria activa, la modalidad de presentación y un nombre descriptivo. Al crearse, el proyecto queda en estado borrador y el sistema redirige inmediatamente a la vista de gestión completa para empezar a poblar las secciones (objetivo, acciones de formación, contactos, rubros, etc.).

La regla de negocio crítica que aplica este módulo es: **una empresa solo puede tener un proyecto por convocatoria**. Esta validación se aplica en el backend antes del INSERT — no es solo una restricción visual del frontend.

---

## 2. Flujo General

```
Usuario en /panel/proyectos hace click en "Crear nuevo proyecto"
         │
         ▼
Modal abre con 3 campos:
  - Convocatoria (dropdown)  ← GET /proyectos/convocatorias
  - Modalidad   (dropdown)   ← GET /proyectos/modalidades
  - Nombre del proyecto      (input texto)
         │
         ▼
Usuario llena y click "Crear"
         │
         ▼
POST /proyectos { convocatoriaId, modalidadId, nombre }
         │
         ├── ¿Ya existe proyecto en esta convocatoria para esta empresa?
         │      ├── SÍ → 400 Bad Request "No se puede crear más de 1 proyecto en la misma convocatoria"
         │      │       → Toast rojo, modal sigue abierto
         │      └── NO → INSERT INTO PROYECTO (estado=0, fecha=SYSDATE, codSeguridad=random)
         │              → devuelve { proyectoId }
         │
         ▼
Frontend redirige a /panel/proyectos/[proyectoId]
         │
         ▼
(continúa el flujo en Gestionar Proyecto — informe 17)
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/proyectos/page.tsx` (modal embebido)

### Lo que hace el modal

- **Carga los catálogos en paralelo** al abrir: convocatorias activas y modalidades activas. Solo se muestran las convocatorias con `CONVOCATORIAESTADO = 1` y `CONVOCATORIAOCULTAR = 0` (visibles y vigentes).
- **Validación cliente** previa al envío: convocatoria seleccionada, modalidad seleccionada, nombre no vacío.
- **Mensaje de error específico** cuando el backend rechaza por duplicado: el toast rojo muestra el mensaje exacto del backend ("No se puede crear más de 1 proyecto en la misma convocatoria"), no un genérico.
- **Redirección automática** al `proyectoId` recibido en la respuesta — el usuario no tiene que volver al listado y buscar su proyecto.

---

## 4. Backend

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `backend/src/proyectos/proyectos.controller.ts` | `POST /proyectos` (línea 159) + `GET /proyectos/convocatorias` y `/modalidades` (catálogos) |
| `backend/src/proyectos/proyectos.service.ts` | Método `crear(email, dto)` (líneas 188-213) |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET`  | `/proyectos/convocatorias` | Lista convocatorias activas y visibles (`CONVOCATORIAESTADO = 1 AND CONVOCATORIAOCULTAR = 0`) |
| `GET`  | `/proyectos/modalidades`   | Lista modalidades activas (`MODALIDADESTADO = 1`) |
| `POST` | `/proyectos`               | Crea el proyecto con estado borrador y devuelve su id |

### DTO de creación

```typescript
interface CrearProyectoDto {
  convocatoriaId: number
  modalidadId: number
  nombre: string
}
```

### Reglas de negocio

**Una sola propuesta por convocatoria.** Antes del INSERT, el servicio cuenta cuántos proyectos tiene la empresa en esa convocatoria:
```sql
SELECT COUNT(PROYECTOID) AS "total" FROM PROYECTO
 WHERE EMPRESAID = :1 AND CONVOCATORIAID = :2
```
Si `total > 0`, rechaza con `BadRequestException`. Esto incluye proyectos en cualquier estado (borrador, radicado o reversado): la regla SENA es estricta — una empresa, una propuesta por convocatoria.

**Generación de código de seguridad.** Al crear, se genera un código aleatorio de 24 caracteres hexadecimales (12 bytes vía `crypto.randomBytes(12).toString('hex').toUpperCase()`) que se guarda en `PROYECTOCODSEGURIDAD`. Este código es heredado del modelo GeneXus y se usaba para el seguimiento externo del proyecto; el nuevo aplicativo lo conserva por compatibilidad de datos.

**Estado inicial 0 (borrador).** Todos los proyectos nacen en estado `0` y solo cambian cuando el usuario radica explícitamente desde la vista de gestión.

**Fecha de registro autoritativa.** Se usa `SYSDATE` de Oracle, no la del cliente.

### Devolución del id recién creado

Después del INSERT, el servicio recupera el id mediante la pseudo-tabla `DUAL` y la secuencia:
```sql
SELECT PROYECTOID.CURRVAL AS "id" FROM DUAL
```
`CURRVAL` devuelve el último valor que la **sesión actual** generó con `NEXTVAL`, lo cual es seguro contra concurrencia (cada conexión Oracle ve su propio CURRVAL).

### Aislamiento por empresa

El `empresaId` siempre se deriva del JWT (`getEmpresaId(email)`), nunca se acepta del body. Es imposible que un usuario cree un proyecto a nombre de otra empresa.

---

## 5. Modelo de datos

### Tabla `PROYECTO` — columnas usadas al crear

| Columna | Valor al INSERT |
|---|---|
| `PROYECTOID` | `PROYECTOID.NEXTVAL` (secuencia Oracle) |
| `EMPRESAID` | Resuelto del JWT |
| `PROYECTONOMBRE` | Del DTO, con `.trim()` |
| `CONVOCATORIAID` | Del DTO |
| `MODALIDADID` | Del DTO |
| `PROYECTOCODSEGURIDAD` | Random 12 bytes → 24 hex chars en mayúsculas |
| `PROYECTOFECHAREGISTRO` | `SYSDATE` |
| `PROYECTOESTADO` | `0` (borrador) |

Las demás columnas de `PROYECTO` (`PROYECTOOBJETIVO`, `PROYECTOFECHARADICACION`, etc.) quedan en `NULL` y se llenan en módulos posteriores.

### Catálogos

| Tabla | Filtro | Notas |
|---|---|---|
| `CONVOCATORIA` | `CONVOCATORIAESTADO = 1 AND CONVOCATORIAOCULTAR = 0` | Solo activas y visibles. Una convocatoria cerrada o oculta no aparece en el dropdown |
| `MODALIDAD` | `MODALIDADESTADO = 1` | Solo activas |

Ambos catálogos los administra el SENA, no son editables desde el aplicativo.

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador |
| `empresaId` derivado del JWT | Imposible crear proyecto a nombre de otra empresa |
| Validación "1 por convocatoria" | Se aplica en backend, no solo en cliente — no se puede saltar manipulando el frontend |
| `randomBytes(12)` con `crypto` de Node | Generación criptográficamente segura del código de seguridad, no `Math.random()` |
| `SYSDATE` para `PROYECTOFECHAREGISTRO` | Reloj autoritativo del servidor |
| `synchronize: false` (TypeORM) | Schema Oracle inmutable desde la app |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Modal de creación abierto con campos vacíos | Click en "Crear nuevo proyecto" |
| 2 | Dropdown de convocatorias desplegado | Click en select Convocatoria |
| 3 | Dropdown de modalidades desplegado | Click en select Modalidad |
| 4 | Modal con todos los campos llenos justo antes de guardar | Llenar y posicionarse antes del clic |
| 5 | Toast rojo "No se puede crear más de 1 proyecto en la misma convocatoria" | Intentar crear duplicado |
| 6 | Spinner del botón "Crear" durante el POST | Capturar momento del submit |
| 7 | Vista del proyecto recién creado en `/panel/proyectos/[id]` | Después del redireccionamiento |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Crear Nuevo Proyecto implementado

---

Cordial saludo,

Se informa que el **módulo de Crear Nuevo Proyecto** del nuevo SEP, equivalente al modal de creación de la pantalla `Proyectos.aspx` del SEP GeneXus, ha sido implementado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Modal de creación con tres campos: convocatoria, modalidad y nombre del proyecto
- Carga paralela de catálogos al abrir el modal, mostrando solo convocatorias activas y visibles
- Validación de campos obligatorios en cliente y validación de unicidad en backend: la regla SENA de "una empresa solo puede tener un proyecto por convocatoria" se garantiza a nivel de servicio
- Generación criptográficamente segura del código de seguridad heredado del modelo GeneXus (24 caracteres hex)
- Estado inicial borrador y fecha de registro autoritativa del servidor Oracle
- Redirección automática a la vista de gestión del proyecto recién creado
- Aislamiento estricto por empresa: el id de la empresa siempre se deriva del JWT, imposibilitando crear proyectos a nombre de otra organización

Se adjunta informe técnico con el detalle de los **3 endpoints** involucrados (catálogos + creación) y las reglas de negocio aplicadas en el INSERT.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
