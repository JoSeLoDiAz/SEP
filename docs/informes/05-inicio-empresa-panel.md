# Informe de Desarrollo — Módulo Panel de Inicio Empresa
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El panel de inicio es la primera pantalla privada que ve un usuario autenticado con perfil Empresa/Gremio/Asociación (perfilId=7) después de iniciar sesión. Reemplaza la "Master Page Interna" de GeneXus. Incluye un sistema de precarga de pantalla completa (mínimo 1 segundo), autenticación basada en localStorage, un menú lateral dinámico cargado desde Oracle, y una vista de bienvenida con las 4 tarjetas de módulos disponibles.

---

## 2. Componentes del Panel

```
/panel (ruta privada)
     │
     ├─ DashboardLayout (layout.tsx)
     │       ├─ PanelPreloader          → Pantalla completa mientras carga
     │       ├─ Guarda de autenticación → Redirige a /login si sin token
     │       ├─ AppSidebar              → Menú lateral dinámico (desktop + móvil)
     │       ├─ PanelTopbar             → Barra superior con usuario + logout
     │       └─ <main>                  → Contenido de cada sub-ruta
     │
     └─ PanelHome (page.tsx)
             ├─ EmpresaHome (perfilId=7)  → 4 tarjetas de módulos
             └─ AdminHome  (otros)        → Estadísticas placeholder
```

---

## 3. Frontend — Layout (`dashboard/layout.tsx`)

### Archivo
`frontend/src/app/(dashboard)/layout.tsx`

### Guarda de autenticación
En el `useEffect` de montaje, verifica `localStorage`:
```typescript
const token = getSepToken()   // lee 'sep_token'
if (!token) {
  router.replace('/login')    // redirige si no hay sesión
  return
}
setUsuario(getSepUsuario())   // lee 'sep_usuario' → { email, nombre, perfilId }
```

### Preloader de pantalla completa (doble compuerta)
El preloader se mantiene visible hasta que se cumplan **dos condiciones simultáneamente**:
1. El check de autenticación terminó (`authDone.current = true`)
2. Pasó al menos 1 segundo (`minDelayDone.current = true`)

Esto evita un parpadeo del layout para usuarios que ya están autenticados:
```typescript
const minDelayDone = useRef(false)
const authDone = useRef(false)

function tryShow() {
  if (minDelayDone.current && authDone.current) setReady(true)
}

// Gate 1: mínimo 1 segundo
setTimeout(() => { minDelayDone.current = true; tryShow() }, 1000)

// Gate 2: autenticación resuelta
authDone.current = true; tryShow()
```

### Preloader visual (`PanelPreloader`)
- Círculo SVG de progreso verde (#39A900) que avanza aleatoriamente.
- Logo SENA rotando con animación CSS `sep-spin` (360°/s, infinito).
- Contador de porcentaje dinámico (0% → 100%).
- Texto: "Sistema Especializado de Proyectos" + "Cargando tu espacio de trabajo…"

### Layout principal (post-carga)
```
┌─────────────────────────────────────────────────────┐
│ AppSidebar (desktop, 240px expandido / 68px colaps) │
├─────────────────────────────────────────────────────┤
│ PanelTopbar (barra superior, 48px altura)           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  <main>  (contenido de la sub-ruta activa)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 4. Frontend — Sidebar (`AppSidebar`)

### Archivo
`frontend/src/components/layout/app-sidebar.tsx`

### Menú dinámico desde Oracle
Al montar el componente, carga el menú vía API:
```typescript
useEffect(() => {
  api.get<MenuItem[]>('/empresa/menu')
    .then(r => setMenuItems(r.data))
    .catch(() => setMenuItems([]))
}, [])
```

La respuesta contiene los ítems del menú según el perfil del usuario, leídos de la tabla `MENU` de Oracle:
```typescript
interface MenuItem {
  desc: string   // MENUXDESC → etiqueta del ítem
  url: string    // MENXURL   → URL GeneXus (.aspx)
  icono: string  // MENUXICONO → "nav-icon fas fa-address-card"
}
```

### Mapeo URL GeneXus → Next.js (`URL_MAP`)
```typescript
const URL_MAP: Record<string, string> = {
  'InicioEmpresa.aspx':       '/panel',
  'DatosBasicosEmpresa.aspx': '/panel/datos',
  'Necesidades.aspx':         '/panel/necesidades',
  'Proyectos.aspx':           '/panel/proyectos',
  'WPConvenios.aspx':         '/panel/convenios',
  'wptratamientodatos.aspx':  '/panel/beneficiarios',
  'Empresas.aspx':            '/panel/empresas',
  'Convenios.aspx':           '/panel/convenios',
  'Cronograma.aspx':          '/panel/cronograma',
  'Certificados.aspx':        '/panel/certificacion',
  'Desembolsos.aspx':         '/panel/desembolsos',
  'Evaluaciones.aspx':        '/panel/evaluaciones',
}
```

### Mapeo FontAwesome → Lucide (`ICON_MAP`)
```typescript
const ICON_MAP: Record<string, LucideIcon> = {
  'fa-home':            Home,
  'fa-address-card':    Building2,
  'fa-list':            ClipboardList,
  'fa-tasks':           ClipboardList,
  'fa-folder':          FolderKanban,
  'fa-handshake':       ScrollText,
  'fa-users':           Users,
  'fa-certificate':     Award,
  'fa-calendar':        CalendarDays,
  'fa-money-bill':      Wallet,
  // ... más mappings
}
```

La función `faToLucide("nav-icon fas fa-address-card")` extrae `fa-address-card` y retorna `Building2`.

### Comportamiento de ítems del menú
- **URL mapeada:** enlace `<Link>` de Next.js activo, con indicador verde si es la ruta actual.
- **URL sin mapeo:** ítem deshabilitado (cursor no permitido) con etiqueta "próximo".
- **Estado activo:** fondo `bg-white/15`, punto verde (`bg-green-400`) a la derecha.

### Modos de visualización
| Modo | Comportamiento |
|---|---|
| Desktop expandido (240px) | Ícono + texto del ítem |
| Desktop colapsado (68px) | Solo ícono, tooltip con texto al hover |
| Móvil — drawer cerrado | Sidebar fuera de la pantalla (translateX -100%) |
| Móvil — drawer abierto | Sidebar visible con backdrop semitransparente |

### Información del usuario en el footer del sidebar
```
┌──────────────────────────────┐
│ [G]  Razón Social Empresa    │ ← Inicial + nombre de localStorage
│      Gremio / Empresa /      │ ← Rol para perfilId=7
│      Asociación              │
│                      [Salir] │ ← clearSepAuth() + router.push('/login')
└──────────────────────────────┘
```

---

## 5. Frontend — Topbar (`PanelTopbar`)

### Archivo
`frontend/src/components/layout/panel-topbar.tsx`

| Elemento | Desktop | Móvil |
|---|---|---|
| Hamburger | Oculto | Visible → abre sidebar drawer |
| Logo SENA | Oculto | Visible (centrado) |
| Nombre + rol usuario | Visible (derecha) | Oculto |
| Botón cerrar sesión | Visible (icono) | Visible (icono) |

---

## 6. Frontend — Página de Inicio (`PanelHome`)

### Archivo
`frontend/src/app/(dashboard)/panel/page.tsx`

### Selección de vista por perfil
```typescript
if (isEmpresa(perfilId)) {  // perfilId === 7
  return <EmpresaHome nombre={usuario.nombre} />
}
return <AdminHome />
```

### Vista Empresa (`EmpresaHome`)
**Banner de bienvenida:**
- Barra de color superior con gradiente `#00304D → #39A900 → #6C29B3`
- Nombre de la razón social del usuario
- Texto: "Señor Gremio / Empresario, le damos la bienvenida al Sistema Especializado de Proyectos — SEP"

**4 tarjetas de módulos:**

| Módulo | Color | Ruta | Descripción |
|---|---|---|---|
| Mis Datos | #00304D (azul oscuro) | /panel/datos | Información básica empresa/gremio |
| Mis Necesidades | #39A900 (verde SENA) | /panel/necesidades | Diagnóstico de necesidades de formación |
| Mis Proyectos | #6C29B3 (púrpura) | /panel/proyectos | Proyecto de formación diseñado |
| Mis Convenios | #0070C0 (azul) | /panel/convenios | Ejecución del convenio |

Cada tarjeta contiene: barra de color, ícono en contenedor con color suave, título en recuadro coloreado, texto de objetivo, descripción, instrucción de uso, botón de acción.

Grid responsivo:
```
móvil:   1 columna
tablet:  2 columnas (sm)
desktop: 4 columnas (xl)
```

---

## 7. Backend — Menú dinámico

### Endpoint
```
GET /empresa/menu
Authorization: Bearer <JWT>
```

### Query Oracle
```sql
SELECT TRIM(MENUXDESC)  AS "desc",
       TRIM(MENXURL)    AS "url",
       TRIM(MENUXICONO) AS "icono"
FROM MENU
WHERE MENXEST   = 'A'       -- Solo ítems activos
  AND MENXPADRE = 0         -- Solo ítems de primer nivel (sin submenú)
  AND PERFILID  = :1        -- Filtrado por perfil del usuario autenticado
ORDER BY MENUXPOSI ASC      -- Orden de posición definido en GeneXus
```

### Seguridad del endpoint
El endpoint usa `@UseGuards(JwtAuthGuard)` y `@CurrentUser()`, por lo que el `perfilId` se extrae directamente del JWT firmado, no del body de la request:
```typescript
getMenu(@CurrentUser() user: JwtUser) {
  return this.empresaService.getMenu(user.perfilId)
}
```

### Respuesta ejemplo (perfilId=7)
```json
[
  { "desc": "Inicio",        "url": "InicioEmpresa.aspx",      "icono": "nav-icon icon-home" },
  { "desc": "Datos Básicos", "url": "DatosBasicosEmpresa.aspx", "icono": "nav-icon fas fa-address-card" },
  { "desc": "Mis Necesidades","url": "Necesidades.aspx",        "icono": "nav-icon fas fa-list" },
  { "desc": "Mis Proyectos", "url": "Proyectos.aspx",           "icono": "nav-icon fas fa-folder" },
  { "desc": "Mis Convenios", "url": "WPConvenios.aspx",         "icono": "nav-icon fas fa-handshake" }
]
```

### Lib de autenticación frontend
`frontend/src/lib/auth.ts` centraliza las operaciones de sesión:
```typescript
export interface SepUsuario { email: string; nombre: string; perfilId: number }
export function getSepUsuario(): SepUsuario | null    // lee localStorage
export function getSepToken(): string | null           // lee localStorage
export function clearSepAuth(): void                  // borra ambas claves
export function isEmpresa(perfilId: number): boolean  // perfilId === 7
```

---

## 8. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Preloader completo (logo girando + círculo + %) | Recargar `/panel` con F5 |
| 2 | Panel con sidebar expandido + 4 tarjetas | Desktop, sidebar expandido |
| 3 | Panel con sidebar colapsado (solo íconos) | Clic en botón colapsar (círculo >) |
| 4 | Sidebar en móvil — drawer abierto | DevTools → responsive → clic hamburger |
| 5 | Banner de bienvenida con nombre empresa | Parte superior del panel |
| 6 | Hover sobre una tarjeta de módulo | Mouse encima de "Mis Datos" |
| 7 | Ítem de menú activo (punto verde + fondo) | Estar en la ruta correspondiente |
| 8 | Footer sidebar con nombre + rol + logout | Parte inferior del sidebar |
| 9 | Panel en pantalla 27" — 4 tarjetas horizontales | Monitor grande o resolución 2560px |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Panel de inicio para Empresas/Gremios implementado

---

Cordial saludo,

Se informa que el **panel de inicio privado para usuarios Empresa/Gremio/Asociación** del nuevo SEP ha sido implementado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Pantalla de precarga de mínimo 1 segundo con logo SENA girando y círculo de progreso
- Guarda de autenticación: usuarios sin sesión son redirigidos automáticamente al login
- Menú lateral dinámico cargado desde la tabla MENU de Oracle (igual que el SEP GeneXus), con mapeo automático de íconos FontAwesome → Lucide y URLs `.aspx` → rutas del nuevo sistema
- Menú completamente colapsable en desktop e implementado como drawer deslizante en móvil
- Vista de bienvenida con 4 tarjetas de módulos (Datos, Necesidades, Proyectos, Convenios)
- Identificación del usuario con nombre de la razón social y rol "Gremio / Empresa / Asociación"

Se adjunta informe técnico detallado con la arquitectura de componentes, lógica de precarga y mapeos GeneXus → Next.js.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
