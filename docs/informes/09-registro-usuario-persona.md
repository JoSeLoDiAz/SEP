# Informe de Desarrollo — Módulo Registro de Usuario (Persona Natural)
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo de Registro de Usuario permite que personas naturales que participan en los programas del GGPC del SENA se registren en el SEP de forma autónoma. El registro es público y crea simultáneamente un registro en las tablas `USUARIO` y `PERSONA` de Oracle. Este tipo de usuario recibe el `perfilId=8` y puede acceder al panel del sistema con funcionalidades propias de persona natural (a diferencia del proponente/empresa con `perfilId=7`).

---

## 2. Diferencias clave vs. Registro Proponente

| Aspecto | Proponente (Empresa/Gremio) | Usuario (Persona natural) |
|---|---|---|
| Ruta | `/registro/proponente` | `/registro/usuario` |
| Endpoint | `POST /auth/registrar-empresa` | `POST /auth/registrar-persona` |
| Tabla creada | `USUARIO` + `EMPRESA` | `USUARIO` + `PERSONA` |
| perfilId | 7 | 8 |
| usuarioTipo | 2 | 1 |
| Validación única | NIT (EMPRESA.EMPRESAIDENTIFICACION) | Identificación (PERSONA.PERSONAIDENTIFICACION) |
| Nombre en el sistema | Razón Social | Nombres + Primer Apellido |
| Color del botón | Cerulean (azul `#0070C0`) | Lime (verde lima) |
| Ícono cabecera | `<Building2>` | `<UserPlus>` |

---

## 3. Flujo General

```
Usuario llega desde:
  - Modal de registro del Login → opción "Usuario / Persona natural"
  - URL directa: /registro/usuario
            │
            ▼
GET /auth/tipos-documento?para=persona
(carga tipos de documento para personas desde Oracle)
            │
            ▼
Usuario completa el formulario:
  Tipo identificación | Número identificación
  Nombres | Primer apellido | Segundo apellido (opcional)
  Correo | Contraseña
  Acepta Habeas Data ✓
            │
            ▼
Validaciones frontend → POST /auth/registrar-persona
            │
     ┌──────┴─────────────────────────────────────┐
     │ Backend valida:                             │
     │ 1. habeasData === true                      │
     │ 2. Email no existe en USUARIO              │
     │ 3. Identificación no existe en PERSONA      │
     └──────┬─────────────────────────────────────┘
            │
  getEncryptionKey() → llave Twofish única
  encrypt64(clave, llave) → Twofish-128 → Base64
            │
  Transacción Oracle:
    INSERT INTO USUARIO (perfilId=8, estado=1, tipo=1)
    INSERT INTO PERSONA (nombres, apellidos, email, habeasData='SI')
    COMMIT
            │
            ▼
Toast "¡Registro exitoso!" → redirige a /login (2.5 s)
```

---

## 4. Frontend

### Archivos principales
| Archivo | Rol |
|---|---|
| `frontend/src/app/(public)/registro/usuario/page.tsx` | Formulario completo de registro |
| `frontend/src/app/(public)/registro/usuario/layout.tsx` | Layout específico (cabecera institucional) |
| `frontend/src/components/public/registro/habeas-data-modal.tsx` | Modal legal Habeas Data (compartido con proponente) |

### Campos del formulario

| Campo | Tipo HTML | Requerido | Notas |
|---|---|---|---|
| Tipo de Identificación | `<select>` | ✅ | Cargado desde Oracle — `para=persona` |
| Número de Identificación | `<input type="number">` | ✅ | CC, CE, TI, Pasaporte, etc. |
| Nombres | `<input type="text">` | ✅ | Puede incluir nombres compuestos |
| Primer Apellido | `<input type="text">` | ✅ | — |
| Segundo Apellido | `<input type="text">` | — | Opcional, se envía como `undefined` si está vacío |
| Correo Electrónico | `<input type="email">` | ✅ | Será el usuario de acceso al sistema |
| Contraseña | `<input type="password">` | ✅ | Cifrada con Twofish en el backend |
| Habeas Data | `<input type="checkbox">` | ✅ | Bloquea el envío si no está marcado |

### Tipos de documento para persona (filtro Oracle)
```typescript
api.get<TipoDoc[]>('/auth/tipos-documento?para=persona')
// WHERE TIPODOCUMENTOIDENTIDADPERSONA = 1
// Incluye: CC, CE, TI, Pasaporte, Registro Civil, etc.
// Excluye: NIT y documentos exclusivos de empresas
```

### Diseño del formulario
Los apellidos están en un grid de dos columnas (primer y segundo apellido lado a lado) para aprovechar el espacio en pantallas medianas:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>Primer Apellido *</div>
  <div>Segundo Apellido (opcional)</div>
</div>
```

### Segundo apellido — campo opcional
En el envío al backend, si el segundo apellido está vacío se convierte en `undefined` para evitar insertar una cadena vacía en Oracle:
```typescript
personaSegundoApellido: form.personaSegundoApellido || undefined
```

### Habeas Data — Modal legal (componente compartido)
Igual que en el registro de proponente, el enlace "Ver Habeas Data" abre `<HabeasDataModal>` con el texto oficial del SENA. Este componente es **compartido** entre ambos módulos de registro. El modal incluye:
- Logo SENA en la cabecera (invertido a blanco sobre fondo `#00304D`)
- Texto con referencias a Ley 1581 de 2012, Decreto 1377 de 2013 y Acuerdo SENA 009 de 2016
- Enlace directo a la normograma del SENA para el Acuerdo 009
- Botón "Entendido" en verde lima para cerrar

### Validaciones en el frontend
```typescript
if (!form.personaIdentificacion || !form.personaNombres ||
    !form.personaPrimerApellido || !form.usuarioEmail || !form.usuarioClave) {
  setError('Por favor completa todos los campos obligatorios (*)')
  return
}
if (!form.habeasData) {
  setError('Debes aceptar los Términos y Condiciones de Habeas Data.')
  return
}
```

### Identidad visual
- Cabecera del formulario: fondo `#00304D`, ícono `<UserPlus>` (Lucide)
- Botón de registro: **lime verde** (`bg-lime-500 hover:bg-lime-600`) — diferente del proponente
- Botón "Volver": borde neutral

---

## 5. Backend

### Archivos involucrados
| Archivo | Rol |
|---|---|
| `auth.controller.ts` | Endpoint `POST /auth/registrar-persona` |
| `auth.service.ts` | Lógica `registrarPersona()` |
| `registrar-persona.dto.ts` | Validación y tipado del body |
| `usuario.entity.ts` | Entidad tabla USUARIO |
| `persona.entity.ts` | Entidad tabla PERSONA |

### Endpoint
```
POST /auth/registrar-persona
Content-Type: application/json

Body:
{
  "tipoDocumentoIdentidadId": 1,
  "personaIdentificacion": 1234567890,
  "personaNombres": "Juan Carlos",
  "personaPrimerApellido": "Gómez",
  "personaSegundoApellido": "Martínez",  ← opcional
  "usuarioEmail": "juan@ejemplo.com",
  "usuarioClave": "MiClave2024",
  "habeasData": true
}
```

### Respuesta exitosa (201)
```json
{
  "message": "Usuario registrado exitosamente",
  "usuarioId": 5678
}
```

### Validaciones del DTO (`RegistrarPersonaDto`)
```typescript
@IsNumber()             tipoDocumentoIdentidadId
@IsNumber()             personaIdentificacion
@IsString() @IsNotEmpty() personaNombres
@IsString() @IsNotEmpty() personaPrimerApellido
@IsString() @IsOptional() personaSegundoApellido?   // opcional
@IsEmail()              usuarioEmail
@IsString() @IsNotEmpty() usuarioClave
@IsBoolean()            habeasData
```

### Lógica `registrarPersona()` — paso a paso

**Paso 1 — Verificar Habeas Data:**
```typescript
if (!dto.habeasData) throw new BadRequestException('Debe aceptar los Términos y Condiciones')
```

**Paso 2 — Verificar email único (`PValidarEmailPersona` de GeneXus):**
```typescript
const emailExiste = await this.usuarioRepo.findOne({ where: { usuarioEmail: dto.usuarioEmail } })
if (emailExiste) throw new ConflictException(
  'El correo ya está registrado, por favor verificar o contactar al administrador'
)
```

**Paso 3 — Verificar identificación única (`PValidarIdentificacionPersona` de GeneXus):**
```typescript
const idExiste = await this.personaRepo.findOne({ where: { personaIdentificacion: dto.personaIdentificacion } })
if (idExiste) throw new ConflictException(
  'El número de identificación ya está registrado, por favor verificar o contactar con el administrador'
)
```

**Paso 4 — Generar llave y cifrar contraseña (idéntico al proponente):**
```typescript
const llaveEncriptacion = getEncryptionKey()  // 16 bytes aleatorios → hex 32 chars
const claveEncriptada = encrypt64(dto.usuarioClave, llaveEncriptacion)
```

**Paso 5 — Transacción Oracle con QueryRunner:**
```typescript
const queryRunner = this.dataSource.createQueryRunner()
await queryRunner.connect()
await queryRunner.startTransaction()
try {
  const [{ NEXTVAL: nextUsuarioId }] = await queryRunner.query('SELECT USUARIOID.NEXTVAL FROM dual')

  // INSERT en USUARIO (perfilId=8 → persona, tipo=1)
  const usuario = new Usuario()
  usuario.usuarioId = nextUsuarioId
  usuario.perfilId = 8          // persona natural
  usuario.usuarioClave = claveEncriptada
  usuario.usuarioFechaRegistro = new Date()
  usuario.usuarioEstado = 1     // activo
  usuario.usuarioTipo = 1       // tipo persona
  usuario.usuarioEmail = dto.usuarioEmail
  usuario.usuarioLlaveEncriptacion = llaveEncriptacion
  await queryRunner.manager.save(usuario)

  const [{ NEXTVAL: nextPersonaId }] = await queryRunner.query('SELECT PERSONAID.NEXTVAL FROM dual')

  // INSERT en PERSONA
  const persona = new Persona()
  persona.personaId = nextPersonaId
  persona.tipoDocumentoIdentidadId = dto.tipoDocumentoIdentidadId
  persona.personaIdentificacion = dto.personaIdentificacion
  persona.personaNombres = dto.personaNombres.trim()
  persona.personaPrimerApellido = dto.personaPrimerApellido.trim()
  persona.personaSegundoApellido = (dto.personaSegundoApellido ?? '').trim()
  persona.personaEmail = dto.usuarioEmail
  persona.personaFechaRegistro = new Date()
  // Valores por defecto institucionales
  persona.generoId = 3          // no especificado / por defecto
  persona.ciudadId = 1          // ciudad por defecto
  persona.personaHabeasData = 'SI'   // acepta tratamiento de datos
  persona.personaHabeasDataE = 'NA'  // habeas data empresarial: no aplica
  await queryRunner.manager.save(persona)

  await queryRunner.commitTransaction()
} catch (err) {
  await queryRunner.rollbackTransaction()
  throw err
} finally {
  await queryRunner.release()
}
```

### Errores retornados
| HTTP | Código | Mensaje |
|---|---|---|
| 400 | BadRequest | Debe aceptar los Términos y Condiciones |
| 409 | Conflict | El correo ya está registrado |
| 409 | Conflict | El número de identificación ya está registrado |

---

## 6. Tablas Oracle involucradas

| Tabla | Operación | Campos escritos |
|---|---|---|
| `TIPODOCUMENTOIDENTIDAD` | SELECT | Filtro `TIPODOCUMENTOIDENTIDADPERSONA=1` |
| `USUARIO` | SELECT (validación) + INSERT | `USUARIOID`, `PERFILID=8`, `USUARIOTIPO=1`, `USUARIOCLAVE`, `USUARIOLLAVEENCRIPTACION`, `USUARIOFECHAREGISTRO`, `USUARIOESTADO=1`, `USUARIOEMAIL` |
| `PERSONA` | SELECT (validación) + INSERT | `PERSONAID`, `TIPODOCUMENTOIDENTIDADID`, `PERSONAIDENTIFICACION`, `PERSONANOMBRES`, `PERSONAPRIMERAPELLIDO`, `PERSONASEGUNDOAPELLIDO`, `PERSONAEMAIL`, `PERSONAFECHAREGISTRO`, `GENEROID=3`, `CIUDADID=1`, `PERSONAHABEASDATA='SI'`, `PERSONAHABEASDATAE='NA'` |

---

## 7. Relación entre los dos módulos de registro

Ambos módulos comparten la misma infraestructura base y difieren solo en el tipo de entidad creada:

```
POST /auth/registrar-empresa  →  USUARIO (perfilId=7) + EMPRESA
POST /auth/registrar-persona  →  USUARIO (perfilId=8) + PERSONA
```

Ambos usan:
- El mismo algoritmo de cifrado (`getEncryptionKey` + `encrypt64`)
- El mismo mecanismo de transacción Oracle (`QueryRunner`)
- Los mismos sequences Oracle (`USUARIOID.NEXTVAL`)
- El mismo componente visual `<HabeasDataModal>`
- El mismo endpoint para tipos de documento (`GET /auth/tipos-documento`)

---

## 8. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Formulario completo vacío — persona natural | Abrir `/registro/usuario` |
| 2 | Comparativa lado a lado: proponente vs usuario | Abrir ambas páginas en pestañas |
| 3 | Modal Habeas Data con texto legal visible | Clic en "Ver Habeas Data" |
| 4 | Error "identificación ya registrada" | Intentar registrar una cédula existente en Oracle |
| 5 | Toast "¡Registro exitoso!" verde | Completar un registro con datos nuevos |
| 6 | Grid de apellidos (primer y segundo) lado a lado | En viewport ≥ 640px |
| 7 | Modal de selección en Login: ambas opciones | Clic en "Registrarse" en `/login` |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Registro de Usuario (Persona Natural) implementado

---

Cordial saludo,

Se informa que el **módulo de Registro de Usuario (Persona Natural)** del nuevo SEP se encuentra implementado y en pruebas.

El módulo permite que personas naturales creen su cuenta en el SEP, registrando su información de identificación, nombre completo y datos de acceso. Al igual que el registro de proponente, incluye validaciones de unicidad por número de documento y correo electrónico, presentación obligatoria del Habeas Data conforme a la normativa vigente, y cifrado de contraseña con el algoritmo compatible con el SEP GeneXus.

Los dos tipos de registro (proponente y persona natural) están disponibles desde el modal de la página de login, donde el usuario selecciona el tipo de cuenta que desea crear.

Se adjunta informe técnico con el detalle del formulario, la lógica de transacción Oracle y la comparativa técnica entre ambos módulos de registro.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
