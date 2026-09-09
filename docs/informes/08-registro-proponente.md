# Informe de Desarrollo — Módulo Registro de Proponente
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo de Registro de Proponente permite que cualquier empresa, gremio o asociación que desee participar en los programas del GGPC del SENA se registre en el SEP de forma autónoma, sin intervención del administrador. El registro es público (no requiere autenticación previa) y crea simultáneamente un registro en las tablas `USUARIO` y `EMPRESA` de Oracle, con las mismas reglas de negocio del SEP GeneXus.

---

## 2. Flujo General

```
Usuario llega desde:
  - Modal de registro del Login → opción "Proponente"
  - URL directa: /registro/proponente
            │
            ▼
GET /auth/tipos-documento?para=empresa
(carga tipos de documento para empresas desde Oracle)
            │
            ▼
Usuario completa el formulario:
  Tipo identificación | NIT | Dígito verificación
  Razón social | Sigla
  Correo | Contraseña
  Acepta Habeas Data ✓
            │
            ▼
Validaciones frontend → POST /auth/registrar-empresa
            │
     ┌──────┴──────────────────────────┐
     │ Backend valida:                 │
     │ 1. habeasData === true          │
     │ 2. Email no existe en USUARIO   │
     │ 3. NIT no existe en EMPRESA     │
     └──────┬──────────────────────────┘
            │
  getEncryptionKey() → 16 bytes aleatorios → hex 32 chars
  encrypt64(clave, llave) → Twofish-128 ECB → Base64
            │
  Transacción Oracle:
    INSERT INTO USUARIO (perfilId=7, estado=1, tipo=2)
    INSERT INTO EMPRESA (valores institucionales por defecto)
    COMMIT
            │
            ▼
Toast "¡Registro exitoso!" → redirige a /login (2.5 s)
```

---

## 3. Frontend

### Archivos principales
| Archivo | Rol |
|---|---|
| `frontend/src/app/(public)/registro/proponente/page.tsx` | Formulario completo de registro |
| `frontend/src/app/(public)/registro/proponente/layout.tsx` | Layout específico (cabecera institucional) |
| `frontend/src/components/public/registro/habeas-data-modal.tsx` | Modal con texto legal Habeas Data |

### Campos del formulario

| Campo | Tipo HTML | Requerido | Notas |
|---|---|---|---|
| Tipo de Identificación | `<select>` | ✅ | Cargado dinámicamente desde Oracle |
| Número de Identificación (NIT) | `<input type="number">` | ✅ | — |
| Dígito de Verificación | `<input type="number">` | — | Rango 0–9, por defecto 0 |
| Razón Social | `<input type="text">` | ✅ | Se guarda con `.trim()` |
| Sigla / Nombre corto | `<input type="text">` | — | Si vacío, toma los primeros 10 chars de la razón social |
| Correo Electrónico | `<input type="email">` | ✅ | Será el usuario de acceso al sistema |
| Contraseña | `<input type="password">` | ✅ | Se cifra en el backend con Twofish |
| Habeas Data | `<input type="checkbox">` | ✅ obligatorio | Bloquea el envío si no está marcado |

### Carga dinámica de tipos de documento
Al montar el componente se llama:
```typescript
api.get<TipoDoc[]>('/auth/tipos-documento?para=empresa')
```
El primer tipo retornado queda seleccionado por defecto. El filtro `para=empresa` aplica `WHERE TIPODOCUMENTOIDENTIDADEMPRESA = 1` en Oracle, retornando solo los tipos válidos para organizaciones (NIT, etc.).

### Habeas Data — Modal legal
El enlace "Ver Habeas Data" abre `<HabeasDataModal>`, un modal con el texto oficial de autorización de tratamiento de datos personales del SENA, conforme a:
- **Ley 1581 de 2012** (protección de datos personales)
- **Decreto 1377 de 2013** (reglamentario)
- **Acuerdo No. 009 de 2016** (SENA — tratamiento de datos)

El checkbox de aceptación está vinculado al campo `habeasData` del estado del formulario. Sin marcarlo, el botón Registrarse llama al backend pero este lo rechaza con `400 Bad Request`.

### Validaciones en el frontend
```typescript
if (!form.empresaIdentificacion || !form.empresaRazonSocial ||
    !form.usuarioEmail || !form.usuarioClave) {
  setError('Por favor completa todos los campos obligatorios (*)')
  return
}
if (!form.habeasData) {
  setError('Debes aceptar los Términos y Condiciones de Habeas Data.')
  return
}
```

### Manejo de éxito
```typescript
setToast(true)  // Toast verde "¡Registro exitoso!"
setTimeout(() => router.push('/login'), 2500)  // Redirige en 2.5 s
```

### Manejo de errores del backend
Los errores del backend (email duplicado, NIT duplicado) se muestran en un banner rojo inline dentro del formulario:
```tsx
{error && (
  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
    <AlertCircle size={15} />
    {error}
  </div>
)}
```

### Identidad visual
- Cabecera del formulario: fondo `#00304D`, ícono `<Building2>` (Lucide), texto "Registrarse como Proponente — Empresa / Gremio / Asociación"
- Botón de registro: color cerulean (`#0070C0`)
- Botón "Volver": borde neutral
- Checkbox Habeas Data: `accent-lime-500` (verde SENA)

---

## 4. Backend

### Archivos involucrados
| Archivo | Rol |
|---|---|
| `auth.controller.ts` | Endpoint `POST /auth/registrar-empresa` |
| `auth.service.ts` | Lógica `registrarEmpresa()` |
| `registrar-empresa.dto.ts` | Validación y tipado del body |
| `usuario.entity.ts` | Entidad tabla USUARIO |
| `empresa.entity.ts` | Entidad tabla EMPRESA |

### Endpoint
```
POST /auth/registrar-empresa
Content-Type: application/json

Body:
{
  "tipoDocumentoIdentidadId": 6,
  "empresaIdentificacion": 900123456,
  "empresaDigitoVerificacion": 7,
  "empresaRazonSocial": "EMPRESA EJEMPLO S.A.S.",
  "empresaSigla": "EE SAS",
  "usuarioEmail": "empresa@ejemplo.com",
  "usuarioClave": "MiClave2024",
  "habeasData": true
}
```

### Respuesta exitosa (201)
```json
{
  "message": "Usuario registrado exitosamente",
  "usuarioId": 1234
}
```

### Validaciones del DTO (`RegistrarEmpresaDto`)
```typescript
@IsNumber()       tipoDocumentoIdentidadId
@IsNumber()       empresaIdentificacion
@IsNumber() @Min(0) empresaDigitoVerificacion
@IsString() @IsNotEmpty() empresaRazonSocial
@IsString() @IsNotEmpty() empresaSigla
@IsEmail()        usuarioEmail
@IsString() @IsNotEmpty() usuarioClave
@IsBoolean()      habeasData
```

### Lógica `registrarEmpresa()` — paso a paso

**Paso 1 — Verificar Habeas Data:**
```typescript
if (!dto.habeasData) throw new BadRequestException('Debe aceptar los Términos y Condiciones')
```

**Paso 2 — Verificar email único (`PValidarCorreoRegistro` de GeneXus):**
```typescript
const emailExiste = await this.usuarioRepo.findOne({ where: { usuarioEmail: dto.usuarioEmail } })
if (emailExiste) throw new ConflictException(
  'El correo ya está registrado, por favor verificar o contactar al administrador'
)
```

**Paso 3 — Verificar NIT único (`PValidarNit` de GeneXus):**
```typescript
const nitExiste = await this.empresaRepo.findOne({ where: { empresaIdentificacion: dto.empresaIdentificacion } })
if (nitExiste) throw new ConflictException(
  'El NIT ya está registrado, por favor verificar o contactar al administrador'
)
```

**Paso 4 — Generar llave de encriptación y cifrar contraseña:**
```typescript
// Réplica exacta de GetEncryptionKey() de GeneXus
function getEncryptionKey(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
  // Resultado: string hex de 32 chars → 16 bytes de entropía
}

const llaveEncriptacion = getEncryptionKey()
const claveEncriptada = encrypt64(dto.usuarioClave, llaveEncriptacion)
// encrypt64: Twofish-128 ECB, padding espacios, salida Base64
```

**Paso 5 — Transacción Oracle con QueryRunner:**
```typescript
const queryRunner = this.dataSource.createQueryRunner()
await queryRunner.connect()
await queryRunner.startTransaction()
try {
  // Obtener siguiente ID de sequence Oracle (igual que GeneXus internamente)
  const [{ NEXTVAL: nextUsuarioId }] = await queryRunner.query('SELECT USUARIOID.NEXTVAL FROM dual')

  // INSERT en USUARIO (perfilId=7 → empresa, estado=1, tipo=2)
  const usuario = new Usuario()
  usuario.usuarioId = nextUsuarioId
  usuario.perfilId = 7            // empresa/gremio/asociación
  usuario.usuarioClave = claveEncriptada
  usuario.usuarioFechaRegistro = new Date()
  usuario.usuarioEstado = 1       // activo
  usuario.usuarioTipo = 2         // tipo empresa
  usuario.usuarioEmail = dto.usuarioEmail
  usuario.usuarioLlaveEncriptacion = llaveEncriptacion
  await queryRunner.manager.save(usuario)

  // Obtener siguiente ID para EMPRESA
  const [{ NEXTVAL: nextEmpresaId }] = await queryRunner.query('SELECT EMPRESAID.NEXTVAL FROM dual')

  // INSERT en EMPRESA con valores por defecto institucionales
  const empresa = new Empresa()
  empresa.empresaId = nextEmpresaId
  empresa.tipoDocumentoIdentidadId = dto.tipoDocumentoIdentidadId
  empresa.empresaIdentificacion = dto.empresaIdentificacion
  empresa.empresaDigitoVerificacion = dto.empresaDigitoVerificacion
  empresa.empresaRazonSocial = dto.empresaRazonSocial.trim()
  empresa.empresaSigla = (dto.empresaSigla ?? '').trim()
  empresa.empresaEmail = dto.usuarioEmail
  empresa.empresaFechaRegistro = new Date()
  // Valores por defecto para campos requeridos (igual que GeneXus en registro inicial)
  empresa.coberturaEmpresaId = 1
  empresa.departamentoEmpresaId = 1
  empresa.ciudadEmpresaId = 1
  empresa.ciiuId = 1
  empresa.tipoEmpresaId = 1
  empresa.tamanoEmpresaId = 1
  empresa.sectorId = 1
  empresa.subSectorId = 1
  empresa.tipoIdentificacionRep = 1
  await queryRunner.manager.save(empresa)

  await queryRunner.commitTransaction()
} catch (err) {
  await queryRunner.rollbackTransaction()
  throw err
} finally {
  await queryRunner.release()
}
```

> Los valores por defecto (coberturaId=1, departamentoId=1, etc.) replican el comportamiento de GeneXus, que también crea la empresa con valores placeholder. El usuario los actualiza posteriormente en la sección "Datos Básicos".

### Errores retornados
| HTTP | Código | Mensaje |
|---|---|---|
| 400 | BadRequest | Debe aceptar los Términos y Condiciones |
| 409 | Conflict | El correo ya está registrado |
| 409 | Conflict | El NIT ya está registrado |

---

## 5. Tablas Oracle involucradas

| Tabla | Operación | Campos escritos |
|---|---|---|
| `TIPODOCUMENTOIDENTIDAD` | SELECT | Tipos de documento filtrados por `TIPODOCUMENTOIDENTIDADEMPRESA=1` |
| `USUARIO` | SELECT (validación) + INSERT | `USUARIOID`, `PERFILID`, `USUARIOCLAVE`, `USUARIOLLAVEENCRIPTACION`, `USUARIOFECHAREGISTRO`, `USUARIOESTADO`, `USUARIOTIPO`, `USUARIOEMAIL` |
| `EMPRESA` | SELECT (validación) + INSERT | `EMPRESAID`, todos los campos básicos + valores por defecto |

---

## 6. Seguridad y cumplimiento legal

| Aspecto | Implementación |
|---|---|
| Habeas Data | Texto oficial SENA (Ley 1581/2012, Acuerdo 009/2016) obligatorio antes del registro |
| Contraseña nunca en texto plano | Twofish-128 + llave única por usuario antes de INSERT |
| Llave aleatoria por usuario | `crypto.randomBytes(16)` — cada usuario tiene su propia llave |
| Transacción atómica | Si falla el INSERT de EMPRESA, se revierte el INSERT de USUARIO |
| Sequences Oracle | Se usan `USUARIOID.NEXTVAL` y `EMPRESAID.NEXTVAL` — mismos sequences del SEP GeneXus |

---

## 7. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Formulario completo vacío | Abrir `/registro/proponente` |
| 2 | Modal "Ver Habeas Data" abierto | Clic en el enlace "Ver Habeas Data" |
| 3 | Error "NIT ya está registrado" | Intentar registrar un NIT existente |
| 4 | Error "Correo ya registrado" | Intentar con un email ya en Oracle |
| 5 | Toast verde "¡Registro exitoso!" | Completar un registro con datos nuevos |
| 6 | Formulario en móvil | DevTools → responsive |
| 7 | Modal desde el Login (selección tipo) | Clic en "Registrarse" en `/login` |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Registro de Proponente (Empresa/Gremio/Asociación) implementado

---

Cordial saludo,

Se informa que el **módulo de Registro de Proponente** del nuevo SEP se encuentra implementado y en pruebas.

El módulo permite que empresas, gremios y asociaciones se registren de forma autónoma en el sistema, creando automáticamente su cuenta de usuario y su perfil de empresa en la base de datos Oracle. Se garantiza la unicidad por correo electrónico y por NIT, y se presenta obligatoriamente el texto de Habeas Data conforme a la Ley 1581 de 2012 y el Acuerdo SENA 009 de 2016. Las contraseñas se cifran con el algoritmo Twofish-128 compatible con el SEP GeneXus.

Se adjunta informe técnico con el detalle del formulario, los endpoints, la lógica de transacción Oracle y los aspectos de seguridad y cumplimiento legal.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
