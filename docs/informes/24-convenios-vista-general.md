# Informe de Desarrollo — Módulo Convenios (vista general y panel del convenio)
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Junio 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

Punto de entrada a la **etapa de ejecución** del convenio. Una vez el proyecto del proponente queda aprobado y suscrito, todos los módulos de seguimiento (director, capacitadores, cronograma, beneficiarios, grupos, certificación, modificaciones, plataformas virtuales) cuelgan de esta vista. En el SEP GeneXus la empresa entraba a una pantalla con enlaces verticales; en el nuevo SEP se unifica en un dashboard por convenio con la información administrativa centralizada y los seis sub-módulos como tarjetas accionables.

Aporta además una **validación transversal**: cuando `CONVENIOSESTADO ≠ 1` (convenio fuera de ejecución), el backend bloquea TODA escritura aguas abajo y el frontend muestra un banner informativo + inputs deshabilitados.

Pantallas: `/panel/convenios` (listado) y `/panel/convenios/[id]` (panel).

---

## 2. Flujo General

```
/panel/convenios
       │
       ▼  GET /convenios  →  cards con chip de estado + buscador
       │
       ▼  Click "Gestionar"
       │
/panel/convenios/[id]
       │
       ▼  GET /convenios/:proyectoId  →  detalle admin + flag convenioEnEjecucion
       │
       ▼  Render: cabecera administrativa + 6 tarjetas (sub-módulos)
       │
       ▼  Sub-módulo invoca assertConvenioEnEjecucion antes de cada escritura
              │
              └── estado ≠ 1  →  ForbiddenException + banner ámbar al usuario
```

---

## 3. Frontend

| Archivo | Rol |
|---|---|
| `app/(dashboard)/panel/convenios/page.tsx` | Listado paginable con buscador |
| `app/(dashboard)/panel/convenios/[id]/page.tsx` | Panel del convenio + tarjetas |
| `components/layout/convenio-nav.tsx` | Barra superior con dropdowns reutilizada en sub-páginas |

- **Listado**: cards con SECOP, proyecto, modalidad, convocatoria, chip de estado y fecha inicio. Buscador global.
- **Panel**: cabecera institucional con datos administrativos (SECOP, banco, póliza, aseguradora, fechas, link SECOP II) y grid 1/2/3 columnas con 6 tarjetas en colores corporativos. Hover eleva la card.
- **`ConvenioNav`**: 5 grupos con dropdowns (Inicio · Directores · Capacitadores · Cronograma · Beneficiarios). Resalta el activo según `pathname`.

---

## 4. Backend

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/convenios` | Lista filtrada por empresa (admin/SENA ven todo) |
| `GET` | `/convenios/:proyectoId` | Detalle administrativo + flag convenioEnEjecucion |

### Validación transversal

Helper privado replicado en cada módulo aguas abajo. Se invoca al inicio de toda escritura:

```typescript
private async assertConvenioEnEjecucion(proyectoId: number) {
  const [conv] = await this.ds.query(
    `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
      WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
    [proyectoId],
  )
  if (Number(conv?.estado) !== 1) {
    throw new ForbiddenException(
      'El convenio no está en ejecución. No puedes realizar esta acción.',
    )
  }
}
```

Aplicado en: `capacitadores`, `cronograma`, `convenios`, `grupos`, `modificaciones`, `plataformas-virtuales`, `certificacion`. Las lecturas siguen abiertas para auditoría histórica.

---

## 5. Modelo de datos

Tabla `CONVENIOS` (columnas relevantes):

| Columna | Notas |
|---|---|
| `CONVENIOSID` (PK) | Identificador |
| `PROYECTOID` (FK) | Vincula al proyecto aprobado |
| `CONVENIOSNUMERO` | Número SECOP II |
| `CONVENIOSESTADO` | **1 = en ejecución**, otros = bloqueado |
| `CONVENIOSFECHASUSCRIPCION` · `CONVENIOSFECHAINICIO` | Fechas administrativas |
| `CONVENIOSBANCO` · `CONVENIOSCUENTA` | Datos bancarios |
| `CONVENIOSPOLIZA` · `CONVENIOSASEGURADORA` | Datos de la póliza |
| `CONVENIOSLINKSECOP` | URL SECOP II |

Chips de estado: verde (en ejecución), ámbar (subsanación), gris (inactivo/finalizado).

---

## 6. Seguridad

| Medida | Detalle |
|---|---|
| `@UseGuards(JwtAuthGuard)` | Aplicado a nivel controlador |
| Filtro por empresa | Excepto perfiles 1/2/3/10/11 (admin/SENA/interventoría) |
| `ParseIntPipe` en `:proyectoId` | Rechaza IDs no numéricos |
| `assertConvenioEnEjecucion` | Bloqueo de escrituras en convenios fuera de ejecución |
| `synchronize: false` (TypeORM) | Schema inmutable desde la app |

---

## 7. Pantallazos sugeridos

| # | Qué capturar |
|---|---|
| 1 | Listado de convenios con buscador y chips de estado |
| 2 | Panel del convenio con cabecera administrativa completa |
| 3 | Grid de las 6 tarjetas en sus colores corporativos |
| 4 | `ConvenioNav` con dropdown abierto |
| 5 | Banner ámbar "Convenio no está en ejecución" |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo Convenios (vista general y panel del convenio) implementado

---

Cordial saludo,

Se informa que el **módulo Convenios — vista general y panel del convenio** del nuevo SEP, punto de entrada a toda la etapa de ejecución, ha sido finalizado y se encuentra en pruebas.

**Funcionalidades entregadas:**
- Listado de convenios con buscador global y chips de estado por color
- Panel del convenio con datos administrativos centralizados (SECOP, banco, póliza, aseguradora, fechas, link SECOP II)
- Grid con seis sub-módulos accionables: Directores, Capacitadores, Cronograma, Beneficiarios, Modificaciones y Plataformas Virtuales
- Componente `ConvenioNav` reutilizable en cada sub-página
- **Validación transversal "convenio en ejecución"** en backend: bloquea escrituras cuando `CONVENIOSESTADO ≠ 1`, con banner visible en el frontend
- Aislamiento por empresa para perfiles proponentes; visibilidad total para SENA, interventoría y administración

Se adjunta informe técnico con los **2 endpoints** del módulo, el helper transversal y los criterios de visualización por perfil.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
