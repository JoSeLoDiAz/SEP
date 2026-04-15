# Informe de Desarrollo — Módulo Datos Básicos Empresa
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo de Datos Básicos replica funcionalmente la pantalla `DatosBasicosEmpresa.aspx` del SEP GeneXus. Permite a usuarios con perfil Empresa/Gremio/Asociación (perfilId=7) consultar y actualizar la información completa de su organización, distribuida en 5 secciones independientes con guardado individual por sección. También incluye el cambio de contraseña con el mismo algoritmo Twofish-128 de GeneXus.

---

## 2. Flujo General

```
Usuario accede a /panel/datos (autenticado, perfilId=7)
         │
         ▼
Carga paralela de 6 peticiones API:
  GET /empresa/datos          → Todos los datos de la empresa
  GET /empresa/departamentos  → Lista de departamentos
  GET /empresa/coberturas     → Lista de coberturas
  GET /empresa/tipos-organizacion → Tipos de organización
  GET /empresa/tamanos        → Tamaños de empresa
  GET /empresa/tipos-doc-rep  → Tipos de documento representante
         │
         ▼
Formulario pre-llenado con datos actuales
         │
         ▼
Usuario edita sección por sección → Botón "Actualizar" por sección
         │
         ▼
PUT /empresa/{seccion}  →  Oracle UPDATE  →  Toast de confirmación
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/(dashboard)/panel/datos/page.tsx`

### Tecnologías
- Next.js 15 App Router — Client Component
- React `useState` + `useRef` + `useEffect`
- Axios vía `@/lib/api`
- Lucide React (íconos por sección)

### Secciones del formulario

#### 1. Datos de Identificación (color: #00304D)
| Campo | Tipo | Editable |
|---|---|---|
| Tipo de Identificación | ReadOnly | ❌ |
| Número de Identificación | ReadOnly | ❌ |
| Dígito de Verificación | ReadOnly | ❌ |
| Nombre de la Entidad Proponente | Input text | ✅ |
| Sigla | Input text | ✅ |

**Endpoint:** `PUT /empresa/identificacion`
```json
{ "empresaRazonSocial": "...", "empresaSigla": "..." }
```

#### 2. Datos del Usuario (color: #4A4A8A)
| Campo | Tipo | Editable |
|---|---|---|
| Usuario (correo) | ReadOnly | ❌ |
| Perfil | ReadOnly | ❌ |
| Fecha de Registro | ReadOnly | ❌ |
| Nueva Contraseña | Input password | ✅ (opcional) |

Solo se guarda si el campo de nueva contraseña no está vacío.
**Endpoint:** `PUT /empresa/cambiar-clave`
```json
{ "nuevaClave": "nueva_password" }
```

#### 3. Datos de Ubicación (color: #006633)
| Campo | Tipo | Requerido |
|---|---|---|
| Departamento | Select | ✅ |
| Ciudad de Domicilio | Select (depende del dpto) | ✅ |
| Cobertura | Select | ✅ |
| Dirección | Input text | ✅ |
| Teléfono Fijo | Input text | — |
| Celular | Input text | ✅ |
| Página Web | Input text | — |

**Cascada departamento → ciudad:**
Al cambiar el departamento, se limpia la ciudad y se llama:
```typescript
GET /empresa/ciudades?departamentoId={id}
```

**Endpoint:** `PUT /empresa/ubicacion`

#### 4. Datos Generales (color: #6C29B3)
| Campo | Tipo | Requerido |
|---|---|---|
| Actividad Económica CIIU | Buscador autocomplete | ✅ |
| Tipo de Organización | Select | ✅ |
| Tamaño de la Empresa | Select | ✅ |
| Certificación de competencias SENA | Radio S/N | — |
| Expertos técnicos competencias | Radio S/N | — |

**Buscador CIIU con debounce (350 ms):**
```typescript
function CiiuSearch({ display, onChange }) {
  const timer = useRef(null)
  function handleInput(v) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const res = await api.get(`/empresa/ciiu?q=${encodeURIComponent(v)}`)
      setResults(res.data)
    }, 350)
  }
}
```
La lista desplegable muestra hasta 30 resultados y se cierra al seleccionar.

**Endpoint:** `PUT /empresa/economicos`

#### 5. Datos Representante Legal (color: #B00020)
| Campo | Tipo | Requerido |
|---|---|---|
| Tipo de Identificación | Select | ✅ |
| Número de Documento | Input text | ✅ |
| Nombre Completo | Input text | ✅ |
| Cargo en la Empresa | Input text | ✅ |
| Correo Electrónico | Input email | ✅ |
| Teléfono | Input text | ✅ |

**Endpoint:** `PUT /empresa/representante`

### Componentes de UI internos
| Componente | Descripción |
|---|---|
| `SectionCard` | Tarjeta con cabecera de color, ícono y título |
| `Field` | Wrapper de etiqueta + input con soporte de campo requerido (*) |
| `ReadOnly` | Campo de solo lectura con fondo gris |
| `Select` | Select estilizado con ícono ChevronDown |
| `SaveBtn` | Botón submit con spinner de carga |
| `CiiuSearch` | Buscador autocomplete con debounce para CIIU |
| `ToastBetowa` | Notificación de éxito/error por sección |

### Sistema de Toast por sección
Para evitar conflictos entre secciones que guardan simultáneamente, se usa un contador como key:
```typescript
const toastKey = useRef(0)
const [toastKey2, setToastKey2] = useState(0)

function showToast(tipo, msg) {
  toastKey.current++            // incrementa en cada llamada
  setToast({ tipo, msg })
  setToastKey2(toastKey.current) // cambia el key → React remonta el toast
}
```

### Estado de guardado independiente por sección
```typescript
const [saving, setSaving] = useState<Record<string, boolean>>({})
// 'identificacion', 'cambiar-clave', 'ubicacion', 'economicos', 'representante'
```
Cada sección tiene su propio spinner de carga en el botón sin bloquear las demás.

---

## 4. Backend

### Archivos involucrados
| Archivo | Rol |
|---|---|
| `empresa.controller.ts` | Define los 9 endpoints del módulo empresa |
| `empresa.service.ts` | Lógica de consulta y actualización en Oracle |
| `empresa.entity.ts` | Entidad TypeORM — tabla EMPRESA |
| `empresa.module.ts` | Módulo NestJS con imports y providers |

### Endpoints del módulo

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/empresa/datos` | Datos completos empresa + usuario (JOIN query) |
| GET | `/empresa/departamentos` | Lista todos los departamentos |
| GET | `/empresa/ciudades?departamentoId=X` | Ciudades filtradas por departamento |
| GET | `/empresa/coberturas` | Lista coberturas activas |
| GET | `/empresa/ciiu?q=texto` | Búsqueda CIIU por código o descripción (top 30) |
| GET | `/empresa/tipos-organizacion` | Tipos de empresa/gremio |
| GET | `/empresa/tamanos` | Tamaños de empresa |
| GET | `/empresa/tipos-doc-rep` | Tipos de documento para representante legal |
| GET | `/empresa/menu` | Menú dinámico por perfil del usuario |
| PUT | `/empresa/identificacion` | Actualiza razón social y sigla |
| PUT | `/empresa/ubicacion` | Actualiza ubicación completa |
| PUT | `/empresa/economicos` | Actualiza datos generales (CIIU, tipo, tamaño, certif) |
| PUT | `/empresa/representante` | Actualiza representante legal |
| PUT | `/empresa/cambiar-clave` | Cambia contraseña con Twofish-128 |

### Query principal `getDatos`
Retorna todos los datos de la empresa en una sola query con JOIN:
```sql
SELECT
  e.EMPRESAID, e.TIPODOCUMENTOIDENTIDADID,
  TRIM(tdi.TIPODOCUMENTOIDENTIDADNOMBRE) AS "tipoDocNombre",
  e.EMPRESAIDENTIFICACION, e.EMPRESADIGITOVERIFICACION,
  TRIM(e.EMPRESARAZONSOCIAL) AS "empresaRazonSocial",
  TRIM(e.EMPRESASIGLA) AS "empresaSigla",
  e.EMPRESAEMAIL,
  e.EMPRESAFECHAREGISTRO,
  e.COBERTURAEMPRESAID, e.DEPARTAMENTOEMPRESAID, e.CIUDADEMPRESAID,
  TRIM(e.EMPRESADIRECCION) AS "empresaDireccion",
  TRIM(e.EMPRESATELEFONO) AS "empresaTelefono",
  TRIM(e.EMPRESACELULAR) AS "empresaCelular",
  e.EMPRESAINDICATIVO,
  TRIM(e.EMPRESAWEBSITE) AS "empresaWebsite",
  e.CIIUID, e.TIPOEMPRESAID, e.TAMANOEMPRESAID,
  TRIM(e.EMPRESACERTIFCOMP) AS "empresaCertifComp",
  TRIM(e.EMPRESAEXPERTTECN) AS "empresaExpertTecn",   -- Doble T (EXPERTTECN)
  e.TIPOIDENTIFICACIONREP,
  TRIM(e.EMPRESAREPDOCUMENTO) AS "empresaRepDocumento",
  TRIM(e.EMPRESAREP) AS "empresaRep",
  TRIM(e.EMPRESAREPCARGO) AS "empresaRepCargo",
  TRIM(e.EMPRESAREPCORREO) AS "empresaRepCorreo",
  TRIM(e.EMPRESAREPTEL) AS "empresaRepTel"
FROM EMPRESA e
LEFT JOIN TIPODOCUMENTOIDENTIDAD tdi
       ON tdi.TIPODOCUMENTOIDENTIDADID = e.TIPODOCUMENTOIDENTIDADID
WHERE e.EMPRESAEMAIL = :1 AND ROWNUM = 1
```

Complementado con datos del usuario:
```sql
SELECT u.USUARIOFECHAREGISTRO AS "fechaRegistro",
       TRIM(p.PERFILNOMBRE)   AS "perfilNombre"
FROM USUARIO u JOIN PERFIL p ON p.PERFILID = u.PERFILID
WHERE u.USUARIOEMAIL = :1 AND ROWNUM = 1
```

Y la descripción CIIU (si existe):
```sql
SELECT TRIM(CIIUCODIGO) || ' - ' || TRIM(CIIUDESCRIPCION) AS "desc"
FROM CIIU WHERE CIIUID = :1 AND ROWNUM = 1
```

### Query de búsqueda CIIU
```sql
SELECT CIIUID AS "id",
       TRIM(CIIUCODIGO) || ' - ' || TRIM(CIIUDESCRIPCION) AS "nombre"
FROM CIIU
WHERE UPPER(TRIM(CIIUCODIGO)) LIKE UPPER(:1)
   OR UPPER(TRIM(CIIUDESCRIPCION)) LIKE UPPER(:2)
ORDER BY TRIM(CIIUCODIGO) ASC
FETCH FIRST 30 ROWS ONLY
```

### Cambio de contraseña (`cambiarClave`)
El proceso réplica exactamente GeneXus:
1. Busca el usuario por email y recupera su `USUARIOLLAVEENCRIPTACION`.
2. Encripta la nueva contraseña con `encrypt64(nuevaClave, llave)` usando Twofish-128.
3. Actualiza `USUARIOCLAVE` en la tabla `USUARIO`.

```typescript
const claveEncriptada = encrypt64(nuevaClave, usuario.usuarioLlaveEncriptacion)
await this.usuarioRepo.update(usuario.usuarioId, { usuarioClave: claveEncriptada })
```

### Manejo del campo EMPRESAEXPERTTECN
Un reto encontrado en esta fase fue que el nombre real del campo en Oracle es `EMPRESAEXPERTTECN` (con doble T), diferente al nombre esperado `EMPRESAEXPERTECN`. Esto se identificó mediante:
```sql
SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'EMPRESA'
```
Y se corrigió tanto en la entidad TypeORM como en todas las queries del servicio.

---

## 5. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Todos los endpoints protegidos por JWT |
| `@CurrentUser()` | El email del usuario se extrae del JWT, no del body |
| `ROWNUM = 1` | Previene retornar múltiples filas inesperadas en Oracle |
| `synchronize: false` | TypeORM nunca modifica el schema de Oracle |
| `.trim()` en writes | Limpieza de espacios antes de cada actualización |
| Validación mínima clave | Contraseña nueva debe tener al menos 6 caracteres |

---

## 6. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Página completa scroll top — sección Identificación | Abrir `/panel/datos` |
| 2 | Sección Ubicación con cascada Dpto → Ciudad activa | Cambiar departamento en el select |
| 3 | Buscador CIIU con resultados desplegados | Escribir "transporte" o un código |
| 4 | Sección Representante Legal — todos los campos | Scroll hasta la última sección |
| 5 | Toast de éxito verde "Guardado" | Guardar una sección correctamente |
| 6 | Spinner de carga en botón "Actualizar" | Durante el guardado (brevemente visible) |
| 7 | Campos ReadOnly (Tipo doc, NIT) vs campos editables | Sección de Identificación |
| 8 | Sección cambio de contraseña | Sección "Datos del Usuario" |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Datos Básicos Empresa/Gremio implementado

---

Cordial saludo,

Se informa que el **módulo de Datos Básicos** del nuevo SEP, equivalente a la pantalla `DatosBasicosEmpresa.aspx` del SEP GeneXus, ha sido implementado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Consulta y actualización de los 5 grupos de información: identificación, usuario/contraseña, ubicación, datos generales y representante legal
- Guardado independiente por sección sin necesidad de guardar todo el formulario
- Cascada departamento → ciudad dinámica (cargada desde Oracle)
- Buscador de actividad económica CIIU con autocompletado en tiempo real
- Cambio de contraseña compatible con el algoritmo GeneXus (Twofish-128)
- Todos los campos de solo lectura correctamente identificados (NIT, tipo de documento, correo)

Se adjunta informe técnico con el detalle de los 14 endpoints del módulo, las queries Oracle involucradas y la corrección de nombres de columna identificados durante el desarrollo.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
