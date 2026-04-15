# Informe de Contexto — Renovación Tecnológica SEP
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Tipo:** Documento ejecutivo-técnico de inicio de proyecto

---

## 1. Antecedentes

El **Sistema Especializado de Proyectos (SEP)** es la plataforma institucional del Grupo de Gestión para la Productividad y la Competitividad (GGPC) del SENA. Fue desarrollado originalmente sobre **GeneXus**, una plataforma propietaria de desarrollo low-code que genera código fuente automáticamente para múltiples entornos.

El SEP gestiona el ciclo completo de proyectos de formación empresarial: registro de proponentes (empresas, gremios y asociaciones), necesidades de formación, proyectos, convenios, acciones de formación, beneficiarios, certificados y desembolsos.

### Limitaciones del sistema GeneXus actual
| Limitación | Impacto |
|---|---|
| Licencia propietaria GeneXus | Costo elevado, dependencia de proveedor |
| Sin control de versiones estándar | Imposible aplicar Git, CI/CD |
| Interfaz web del año ~2014 | No responsiva, UX deficiente en dispositivos móviles |
| Monolítico | Imposible escalar componentes de forma independiente |
| Autenticación propietaria | No estándar, difícil de auditar |
| Despliegue manual | Sin contenedores, sin automatización |

---

## 2. Objetivo de la Renovación

Migrar el SEP de GeneXus a una arquitectura moderna, desacoplada y de código abierto, manteniendo **compatibilidad total con la base de datos Oracle existente** y con todos los datos históricos, sin migración de datos.

### Premisas del proyecto
- La base de datos Oracle de producción **no se modifica**: misma estructura de tablas, mismos campos, mismos tipos `NCHAR`.
- Los usuarios existentes continúan con las mismas credenciales (compatibilidad con el cifrado GeneXus Twofish-128).
- La nueva aplicación replica la lógica de negocio de GeneXus en TypeScript moderno.
- La transición es progresiva: módulo por módulo.
- El desarrollo se realiza sobre un **entorno privado controlado** con clon exacto de la base de datos de producción, con acceso web habilitado desde la máquina local durante la fase de pruebas.

---

## 3. Entorno Actual (Pruebas)

```
[Internet / Red local]
        │
        ▼
[Máquina local del desarrollador]
        │
        ▼
[Docker Compose — Entorno privado controlado]
   ├─ sep-nginx    → Reverse proxy + dominio privado
   ├─ sep-frontend → Next.js (interfaz web)
   └─ sep-backend  → NestJS (API REST)
        │
        ▼
[Base de datos Oracle — Clon exacto de producción]
```

El entorno cuenta con salida web desde la máquina local, lo que permite pruebas reales con datos institucionales sin afectar la base de datos de producción del SEP GeneXus.

---

## 4. Stack Tecnológico Seleccionado

### Backend
| Tecnología | Versión | Rol |
|---|---|---|
| **NestJS** | v10 | Framework Node.js — API REST, guards, módulos, decoradores |
| **TypeORM** | v0.3 | ORM para Oracle — entidades, repositorios, queries nativas |
| **node-oracledb** | v6 | Driver Oracle nativo para Node.js |
| **JWT** | HS256 | Autenticación stateless con tokens firmados |
| **Twofish-128** | npm `twofish` | Compatibilidad con cifrado de contraseñas GeneXus |
| **PDFKit** | v0.15 | Generación de certificados PDF en memoria |
| **Swagger / OpenAPI** | — | Documentación automática de la API REST |

### Frontend
| Tecnología | Versión | Rol |
|---|---|---|
| **Next.js** | v15 App Router | Framework React con SSR, enrutamiento file-based |
| **React** | v19 | UI declarativa basada en componentes y hooks |
| **TypeScript** | v5 | Tipado estático estricto |
| **Tailwind CSS** | v4 | Estilos utility-first, diseño responsivo |
| **Lucide React** | — | Biblioteca de íconos modernos (reemplaza FontAwesome) |
| **Axios** | — | Cliente HTTP para consumo de la API REST |
| **react-google-recaptcha** | — | Protección anti-bot en formularios públicos |

### Infraestructura
| Tecnología | Rol |
|---|---|
| **Ubuntu Server 22.04 LTS** | Sistema operativo del servidor |
| **Docker + Docker Compose** | Orquestación de contenedores |
| **Nginx** | Reverse proxy, enrutamiento, terminación SSL |
| **Oracle Database** | Base de datos institucional existente (sin modificar) |

---

## 5. Arquitectura General

```
[Navegador]
     │
     ▼
[Nginx — Proxy inverso]
     │
     ├─ /api/* ───► [NestJS Backend :3001]
     │                        │
     │               [Oracle DB — clon exacto]
     │
     └─ /* ──────► [Next.js Frontend :3000]
```

---

## 6. Compatibilidad con GeneXus (Retos Técnicos)

| Reto | Solución implementada |
|---|---|
| Cifrado Twofish-128 de contraseñas | Se replicó `Encrypt64()`/`Decrypt64()` de GeneXus en TypeScript |
| Campos NCHAR con padding de espacios | `TRIM()` en todas las lecturas SQL, `.trim()` en todas las escrituras |
| Menú dinámico por perfil | `GET /empresa/menu` lee tabla `MENU` Oracle por `PERFILID`, igual que GeneXus |
| URLs `.aspx` → rutas nuevas | `URL_MAP` en el frontend mapea cada URL GeneXus a su ruta Next.js |
| Íconos FontAwesome → Lucide | `ICON_MAP` mapea cada clase FA usada en MENU.MENUXICONO a su equivalente Lucide |
| Sequences Oracle para IDs | Se llama `USUARIOID.NEXTVAL` y `EMPRESAID.NEXTVAL` vía query antes de cada INSERT |
| Transacciones dobles GeneXus | Se usan `QueryRunner` de TypeORM con `startTransaction` / `commitTransaction` |

---

## 7. Módulos — Estado de Desarrollo

| Módulo | Tipo de acceso | Estado |
|---|---|---|
| Portal público — Inicio | Público | ✅ Implementado |
| Autenticación — Login | Público/Privado | ✅ Implementado |
| Registro Proponente | Público | ✅ Implementado |
| Registro Usuario | Público | ✅ Implementado |
| Certificados | Público | ✅ Implementado |
| Eventos Programados | Público | ✅ Implementado |
| Panel Empresa — Inicio | Privado (perfilId=7) | ✅ Implementado |
| Datos Básicos Empresa | Privado (perfilId=7) | ✅ Implementado |
| Mis Necesidades | Privado | 🔄 En desarrollo |
| Mis Proyectos | Privado | 🔄 En desarrollo |
| Mis Convenios | Privado | 🔄 En desarrollo |
| Panel Administrador | Privado | 📋 Planeado |
| Beneficiarios | Privado | 📋 Planeado |
| Desembolsos | Privado | 📋 Planeado |
| Evaluaciones | Privado | 📋 Planeado |
| Cronograma | Privado | 📋 Planeado |

---

## 8. Pantallazos sugeridos para este informe

| # | Qué capturar | Dónde tomarlo |
|---|---|---|
| 1 | Portal público en desktop | Página `/inicio` |
| 2 | Portal público en móvil | DevTools → modo responsivo |
| 3 | Panel empresa — sidebar expandido | `/panel` autenticado como empresa |
| 4 | Panel empresa — sidebar colapsado | Clic en botón colapsar |
| 5 | Swagger API docs | `http://localhost:3001/api/docs` |
| 6 | `docker compose ps` con contenedores corriendo | Terminal del servidor |

---

## Correo Ejecutivo — Email 1

**Para:** proyectoar@sena.edu.co
**Asunto:** Inicio formal — Renovación tecnológica del Sistema Especializado de Proyectos (SEP)

---

Cordial saludo,

Por medio de este correo se informa el inicio formal del proceso de **renovación tecnológica del Sistema Especializado de Proyectos (SEP)**, sistema actualmente desarrollado sobre la plataforma propietaria GeneXus.

El proyecto tiene como objetivo modernizar el SEP utilizando tecnologías de código abierto ampliamente adoptadas en la industria (**NestJS, Next.js, TypeScript, Docker**), garantizando compatibilidad total con la base de datos Oracle institucional, los usuarios y los datos históricos existentes, sin necesidad de migración de datos.

El desarrollo se lleva a cabo en un **entorno local controlado con clon exacto de la base de datos de producción**, con acceso web habilitado para pruebas, lo que garantiza que las validaciones se realizan con datos reales sin comprometer el sistema en producción.

A la fecha se encuentran implementados y en pruebas los módulos de: portal público, autenticación, registro de proponentes, certificados, eventos, y el panel de gestión para empresas y gremios.

Se adjunta informe técnico con el detalle del stack tecnológico, arquitectura del sistema y estado de cada módulo.

Quedo atento a observaciones y requerimientos adicionales.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
