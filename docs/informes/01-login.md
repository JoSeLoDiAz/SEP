# Informe de Desarrollo — Módulo Login
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo de Login es el punto de entrada al área privada del SEP. Autentica usuarios contra la base de datos Oracle heredada del SEP GeneXus, valida credenciales con el mismo algoritmo de cifrado (Twofish-128), y emite un token JWT que autoriza el acceso a los módulos privados.

---

## 2. Flujo General

```
Usuario ingresa correo + clave
          │
          ▼
Completa reCAPTCHA v2
          │
          ▼
POST /api/auth/login
          │
    ┌─────┴──────┐
    │  Backend   │
    │ Busca en   │
    │  USUARIO   │
    └─────┬──────┘
          │
   Decrypt64(Twofish-128)
   Compara clave plana
          │
    ┌─────┴──────────────┐
    │ Resuelve nombre:   │
    │ perfilId=7→EMPRESA │
    │ otros→PERSONA      │
    └─────┬──────────────┘
          │
     Firma JWT (HS256)
          │
          ▼
  { accessToken, usuario }
          │
          ▼
  localStorage: sep_token
                sep_usuario
          │
          ▼
   router.push('/panel')
```

---

## 3. Frontend

### Archivo principal
`frontend/src/app/login/page.tsx`

### Tecnologías
- Next.js 15 App Router — Client Component (`'use client'`)
- React `useState` + `useRef` (hooks)
- `react-google-recaptcha` v2
- Axios vía `@/lib/api`

### Estructura visual
| Elemento | Descripción |
|---|---|
| Barra GOV.CO | Identidad digital estatal (fondo azul #3465CC) |
| Cabecera institucional | Logo SENA + "Sistema Especializado de Proyectos — SEP" + Logo Mintrabajo |
| Formulario de acceso | Email, contraseña, reCAPTCHA, botón Ingresar |
| Link "Olvidé mi contraseña" | Enlace a `/recuperar-contrasena` |
| Link "Registrarse" | Abre modal de selección de tipo de registro |
| Footer SENA | Color verde institucional #39a900 |

### Lógica de validación (frontend)
1. Verifica que email y clave no estén vacíos.
2. Verifica que el reCAPTCHA esté completado (`captchaOk === true`).
3. Si alguna validación falla → muestra banner de error.
4. Si pasa → llama a la API.

### Manejo de errores — Banner animado
El banner de error fue diseñado con una técnica especial para evitar que desaparezca prematuramente debido a los re-renders del widget reCAPTCHA:

```typescript
// El temporizador vive en useRef — no se destruye con re-renders
const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

function showErr(msg: string) {
  if (errTimer.current) clearTimeout(errTimer.current)
  setErrMsg(msg)
  setErrVisible(true)
  // 6 segundos visibles
  errTimer.current = setTimeout(() => setErrVisible(false), 6000)
}
```

El banner está **siempre en el DOM** y solo cambia de visibilidad por CSS:
```typescript
style={{
  opacity: errVisible ? 1 : 0,
  transform: errVisible ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.97)',
  transition: 'opacity 0.25s ease, transform 0.25s ease',
}}
```

Incluye una **barra de progreso roja** animada con CSS puro (`@keyframes sep-err-bar`) que se consume en 6 segundos, indicando cuánto tiempo queda antes de que desaparezca.

### Manejo de éxito
```typescript
localStorage.setItem('sep_token', res.data.accessToken)
localStorage.setItem('sep_usuario', JSON.stringify({
  email: res.data.usuario.email,
  nombre: res.data.usuario.nombre,  // Razón social o nombre persona
  perfilId: res.data.usuario.perfilId,
}))
// Toast de bienvenida → redirige al panel en 1.8 segundos
setTimeout(() => router.push('/panel'), 1800)
```

### Modal de registro
Al hacer clic en "Registrarse en el SEP" se abre un modal con dos opciones:
- **Proponente** (Empresa / Gremio / Asociación) → `/registro/proponente`
- **Usuario** (Persona natural) → `/registro/usuario`

---

## 4. Backend

### Archivos involucrados
| Archivo | Rol |
|---|---|
| `auth.controller.ts` | Define el endpoint `POST /auth/login` |
| `auth.service.ts` | Lógica de autenticación completa |
| `login.dto.ts` | Validación del body de entrada |
| `usuario.entity.ts` | Entidad TypeORM tabla USUARIO |
| `jwt.strategy.ts` | Validación del JWT en requests protegidos |

### Endpoint
```
POST /auth/login
Content-Type: application/json

Body:
{
  "email": "correo@empresa.com",
  "clave": "contraseña_plana"
}
```

### Respuesta exitosa (200)
```json
{
  "accessToken": "<JWT firmado HS256>",
  "usuario": {
    "usuarioId": 123,
    "email": "correo@empresa.com",
    "nombre": "NOMBRE DE LA RAZÓN SOCIAL O PERSONA",
    "perfilId": 7,
    "rol": "empresa"
  }
}
```

### Lógica interna (`AuthService.login`)

**Paso 1 — Consulta Oracle:**
```sql
SELECT * FROM USUARIO WHERE USUARIOEMAIL = :1
```
- No existe → `401 Usuario incorrecto`
- `USUARIOESTADO = 0` → `401 Usuario inactivo`

**Paso 2 — Desencriptación Twofish (réplica exacta de GeneXus):**
```typescript
function decrypt64(encryptedBase64: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex'))
  const encArr = Array.from(Buffer.from(encryptedBase64, 'base64'))
  const decArr = tf.decrypt(keyArr, encArr)
  return Buffer.from(decArr).toString('utf8').trimEnd()
}
// Compara: claveDesencriptada === dto.clave
```

**Paso 3 — Resolución del nombre:**
```sql
-- Si perfilId = 7 (empresa/gremio)
SELECT TRIM(EMPRESARAZONSOCIAL) FROM EMPRESA WHERE EMPRESAEMAIL = :1

-- Si otro perfil (usuario/persona)
SELECT TRIM(PERSONANOMBRES), TRIM(PERSONAPRIMERAPELLIDO)
FROM PERSONA WHERE PERSONAEMAIL = :1
```

**Paso 4 — Emisión del JWT:**
```typescript
const payload = { sub: usuarioId, email, perfilId, rol }
const token = this.jwtService.sign(payload)  // HS256, expira en 8h
```

### Mapa de perfiles
| perfilId | rol asignado |
|---|---|
| 1 | administrador |
| 2, 3, 12, 13, 14 | gestor |
| 4 | financiera |
| 5 | juridica |
| 6 | tecnica |
| 7 | empresa |
| 8 | usuario |
| 9 | evaluador |
| 10, 11 | interventor |

### Errores retornados
| HTTP | Mensaje |
|---|---|
| 400 | Correo y contraseña son requeridos |
| 401 | Usuario incorrecto |
| 401 | Contraseña incorrecta |
| 401 | Usuario inactivo. Comuníquese con el administrador del sistema |
| 401 | Error al verificar credenciales |

---

## 5. Seguridad

| Medida | Detalle |
|---|---|
| Google reCAPTCHA v2 | Bloquea bots y ataques de fuerza bruta automatizados |
| Twofish-128 ECB | Compatibilidad con contraseñas existentes de GeneXus |
| JWT HS256 | Token firmado con secreto de 8h de expiración |
| Campo `USUARIOESTADO` | Bloquea cuentas inactivas antes de verificar contraseña |
| HTTPS (Nginx) | Tráfico cifrado en el entorno de pruebas |
| Timers en useRef | Previene fugas de estado en el banner de error |

---

## 6. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Página de login completa — escritorio | Abrir `/login` en browser |
| 2 | Página de login en móvil | DevTools → ícono responsive → iPhone 12 Pro |
| 3 | Banner de error rojo con barra de progreso | Ingresar una contraseña incorrecta |
| 4 | Toast verde "¡Bienvenido!" | Ingresar correctamente |
| 5 | Modal de selección de registro | Clic en "Registrarse en el SEP" |
| 6 | Cabecera con logos SENA + Mintrabajo | Scroll arriba de la página login |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo de Autenticación (Login) implementado

---

Cordial saludo,

Se informa que el módulo de **autenticación (Login)** del nuevo SEP ha sido implementado y se encuentra disponible en el entorno de pruebas.

**Funcionalidades entregadas:**
- Inicio de sesión compatible con las credenciales actuales del SEP GeneXus (sin necesidad de resetear contraseñas)
- Validación anti-bot con Google reCAPTCHA v2
- Resolución automática del nombre: razón social para empresas/gremios, nombre completo para personas
- Notificación de error con duración visible de 6 segundos (corregido bug de desaparición prematura)
- Redirección al panel interno tras autenticación exitosa

Se adjunta informe técnico detallado con el flujo, endpoints, lógica de cifrado y recomendaciones de pantallazos.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
