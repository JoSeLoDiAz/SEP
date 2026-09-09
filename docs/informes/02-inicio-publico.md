# Informe de Desarrollo — Módulo Página de Inicio Pública
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

La página de inicio es el portal público del SEP, accesible sin autenticación. Presenta los módulos institucionales del Grupo de Gestión para la Productividad y la Competitividad (GGPC), permite acceder a los módulos públicos (Certificados y Eventos), enlaza a los módulos externos del SENA (FCE, FEEC, CampeSENA), y muestra los canales de redes sociales institucionales.

No tiene backend propio: es completamente estática en el servidor (SSR) y no realiza llamadas a la API.

---

## 2. Arquitectura

```
[Navegador]
     │
     ▼
GET / → redirige a /inicio (middleware Next.js)
     │
     ▼
/inicio → Server Component (sin llamadas a API)
     │
     ├─ <PublicNav />         → Barra de navegación superior
     ├─ <InstitutionalHeader /> → Barra GOV.CO + logos + título
     │
     ├─ Grid de módulos (6 ModuleCard)
     │   ├─ FCE   → externo SENA (nueva pestaña)
     │   ├─ FEEC  → externo SENA (nueva pestaña)
     │   ├─ CampeSENA → externo SENA (nueva pestaña)
     │   ├─ Certificados → /certificados (interno)
     │   ├─ Eventos → /eventos (interno)
     │   └─ Próximamente → deshabilitado
     │
     ├─ <SocialButtons />     → Redes sociales
     ├─ <FacebookWidget />    → Widget embebido
     ├─ <InstagramWidget />   → Widget embebido
     └─ <PublicFooter />      → Pie de página institucional
```

---

## 3. Frontend

### Archivos principales
| Archivo | Rol |
|---|---|
| `frontend/src/app/(public)/inicio/page.tsx` | Página de inicio — SSR, sin estado |
| `frontend/src/app/(public)/layout.tsx` | Layout público: nav + header + footer |
| `frontend/src/components/public/module-card.tsx` | Tarjeta de módulo reutilizable |
| `frontend/src/components/public/public-nav.tsx` | Barra de navegación superior |
| `frontend/src/components/public/institutional-header.tsx` | Cabecera GOV.CO + logos |
| `frontend/src/components/public/social-buttons.tsx` | Botones de redes sociales |
| `frontend/src/components/public/facebook-widget.tsx` | Widget Facebook embebido |
| `frontend/src/components/public/instagram-widget.tsx` | Widget Instagram embebido |
| `frontend/src/components/public/public-footer.tsx` | Footer institucional |

### Módulos definidos
```typescript
const modules: ModuleDef[] = [
  { id: 'fce',          href: '<sena.edu.co/FCE>',  external: true,  disabled: false },
  { id: 'feec',         href: '<sena.edu.co/FEEC>', external: true,  disabled: false },
  { id: 'campesena',    href: '<sena.edu.co/...>',  external: true,  disabled: false },
  { id: 'certificados', href: '/certificados',       external: false, disabled: false },
  { id: 'eventos',      href: '/eventos',            external: false, disabled: false },
  { id: 'proximamente', href: '#',                   external: false, disabled: true  },
]
```

### Componente `ModuleCard`
Cada tarjeta de módulo maneja dos estados:
- **Habilitada:** enlace activo con hover, gradiente de color, ícono o imagen del módulo.
- **Deshabilitada (`disabled: true`):** sin cursor pointer, sin hover, etiqueta "Próximamente".

Para módulos externos (`external: true`), el enlace abre en nueva pestaña (`target="_blank" rel="noopener noreferrer"`).
Para módulos internos (`external: false`), usa `<Link>` de Next.js para navegación SPA sin recarga.

### Diseño visual
| Sección | Color / Estilo |
|---|---|
| Barra GOV.CO | Azul #3465CC (identidad digital gubernamental) |
| Cabecera institucional | Blanco con logos SENA y Mintrabajo |
| Título sección módulos | Verde SENA #39A900, borde inferior verde |
| Grid de módulos | 1 columna (móvil) → 2 columnas (tablet) → 3 columnas (desktop) |
| Tarjetas | Gradientes individuales por módulo, imágenes institucionales |
| Sección redes | Separador, widgets FB + Instagram lado a lado en desktop |
| Footer | Verde SENA, copyright GGPC–DSNFT–SENA |

### Responsividad
```
móvil  (< 640px):  1 columna
tablet (≥ 640px):  2 columnas
desktop (≥ 1024px): 3 columnas
```

---

## 4. Backend

La página de inicio **no tiene backend propio**. Es un Server Component de Next.js que renderiza HTML estático en el servidor. No realiza llamadas a la API.

Los módulos "Certificados" y "Eventos" que son internos sí consumen la API, pero sus propios informes detallan esa integración.

---

## 5. Rendimiento

Al ser un Server Component sin llamadas a API ni estado React:
- **Primera carga:** renderizado en servidor (SSR) → HTML completo enviado al navegador.
- **Navegación interna:** hidratación React → transiciones SPA sin recarga completa.
- Sin skeleton loaders ni estados de carga en esta página.

---

## 6. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Página completa en desktop (1920px) | Abrir `/inicio`, hacer scroll completo |
| 2 | Grid de 6 tarjetas de módulos | Sección superior de la página |
| 3 | Hover sobre una tarjeta habilitada | Pasar el mouse por FCE o Certificados |
| 4 | Página en móvil (una columna) | DevTools → responsive → iPhone 12 Pro |
| 5 | Sección de redes sociales | Scroll al fondo |
| 6 | Cabecera institucional (logos) | Parte superior |
| 7 | En pantalla 27" — diseño amplio | Abrir en monitor grande o resolución 2560px |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Portal Público (Página de Inicio) implementado

---

Cordial saludo,

Se informa que el **portal público del nuevo SEP** ha sido implementado y se encuentra en pruebas.

La página de inicio (`/inicio`) presenta los seis módulos institucionales del GGPC con acceso directo a Certificados y Eventos (módulos internos del SEP), y enlaces a los programas FCE, FEEC y CampeSENA del SENA. Incluye la cabecera institucional completa (GOV.CO, logos SENA y Ministerio del Trabajo) y la sección de redes sociales.

El diseño es completamente responsivo: funciona correctamente desde dispositivos móviles hasta pantallas de 27 pulgadas.

Se adjunta informe técnico con la arquitectura de componentes y recomendaciones de pantallazos.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
