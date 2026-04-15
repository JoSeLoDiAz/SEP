# Informe de Desarrollo — Módulo Certificados
**Sistema Especializado de Proyectos — GGPC SENA**
**Fecha:** Abril 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El módulo de Certificados permite a cualquier usuario (sin autenticación requerida) consultar y descargar los certificados de participación en acciones de formación del SEP. La búsqueda puede realizarse por número de documento de identidad o por código de evidencia de validación. El PDF se genera en tiempo real en el servidor con PDFKit, replicando el formato oficial del certificado del SEP GeneXus.

---

## 2. Flujo General

```
Usuario ingresa tipo de doc + número  (o código de evidencia)
                    │
                    ▼
          GET /api/certificados?tipoDocumento=CC&numero=123456
                    │
                    ▼
     [Backend: busca PersonaId en Oracle]
                    │
        ┌───────────┴────────────────────┐
        │ AFGRUPOBENEFICIARIO JOIN       │
        │ ACCIONFORMACION JOIN PROYECTO  │
        │ Filtro: CERTIFICA='SI'         │
        │          VALIDACIONINTERVENTOR │
        │          ='VERIFICADO'         │
        └───────────┬────────────────────┘
                    │
        Lista de certificados (JSON)
                    │
                    ▼
    Usuario hace clic en "Descargar PDF"
                    │
                    ▼
     GET /api/certificados/:id/pdf?personaId=X
                    │
         [Backend: 9 queries Oracle]
         [PDFKit genera PDF A4 landscape]
                    │
                    ▼
        Content-Type: application/pdf
        → inline en el navegador
```

---

## 3. Frontend

### Archivos principales
| Archivo | Rol |
|---|---|
| `frontend/src/app/(public)/certificados/page.tsx` | Página de certificados (wrapper SSR) |
| `frontend/src/components/public/certificados/certificados-form.tsx` | Formulario de búsqueda + tabla de resultados |

### Búsqueda por persona
1. Usuario selecciona tipo de documento (dropdown cargado desde `GET /auth/tipos-documento?para=persona`).
2. Ingresa número de identificación.
3. Clic en "Consultar" → `GET /api/certificados?tipoDocumento=CC&numero=12345`.
4. Se muestra tabla con los certificados encontrados.

### Búsqueda por código de evidencia
1. Usuario ingresa el código de evidencia (ej: `EVD-2024-001`).
2. Clic en "Consultar" → `GET /api/certificados?codigo=EVD-2024-001`.
3. Se muestra tabla con el certificado correspondiente.

### Tabla de resultados
| Columna | Campo Oracle |
|---|---|
| # | Consecutivo (calculado) |
| Empresa | `EMPRESA.EMPRESARAZONSOCIAL` |
| Acción de Formación | `ACCIONFORMACION.ACCIONFORMACIONNOMBRE` |
| Fecha Validación | `AFGRUPOBENEFICIARIO.FECHAVALIDACIONINTERVENTOR` |
| Código Evidencia | `AFGRUPOBENEFICIARIO.EVIDENCIAVALIDACION` |
| Descargar | Botón → `GET /certificados/:id/pdf` |

### Estados de la UI
| Estado | Qué muestra |
|---|---|
| Inicial | Formulario de búsqueda vacío |
| Cargando | Spinner animado |
| Sin resultados | Ícono + mensaje "No se encontraron certificados" |
| Con resultados | Tabla con botón de descarga por fila |
| Error | Banner rojo con mensaje de la API |

---

## 4. Backend

### Archivos involucrados
| Archivo | Rol |
|---|---|
| `backend/src/certificados/certificados.controller.ts` | Endpoints GET /certificados y GET /certificados/:id/pdf |
| `backend/src/certificados/certificados.service.ts` | Lógica de búsqueda y generación PDF |
| `backend/src/certificados/assets/Formato2.png` | Fondo oficial del certificado (watermark SENA) |
| `backend/src/certificados/assets/Formato1.png` | Fondo alternativo |

### Endpoints

**Buscar certificados:**
```
GET /certificados?tipoDocumento=CC&numero=12345678
GET /certificados?codigo=EVD-2024-001
```

**Descargar PDF:**
```
GET /certificados/:afGrupoBeneficiarioId/pdf?personaId=:personaId
→ Content-Type: application/pdf
→ Content-Disposition: inline; filename="certificado_123.pdf"
```

### Lógica de búsqueda

**Por persona:** el servicio primero resuelve el `PersonaId` buscando en la tabla `PERSONA` con `JOIN TIPODOCUMENTOIDENTIDAD` filtrando por abreviatura del tipo de documento (mapa interno `TIPO_DOC_MAP`).

```sql
SELECT P.PERSONAID FROM PERSONA P
JOIN TIPODOCUMENTOIDENTIDAD T ON T.TIPODOCUMENTOIDENTIDADID = P.TIPODOCUMENTOIDENTIDADID
WHERE UPPER(T.TIPODOCUMENTOIDENTIDADNOMBRE) LIKE UPPER('%Ciudadan%')
  AND P.PERSONAIDENTIFICACION LIKE '%12345678%'
```

**Filtro principal de certificados:**
```sql
SELECT AFGB.AFGRUPOBENEFICIARIOID, AFGB.FECHAVALIDACIONINTERVENTOR,
       AFGB.EVIDENCIAVALIDACION, AF.ACCIONFORMACIONNOMBRE,
       E.EMPRESARAZONSOCIAL, PR.PROYECTOID, AFGB.PERSONAID
FROM AFGRUPOBENEFICIARIO AFGB
JOIN AFGRUPO AFG ON AFG.AFGRUPOID = AFGB.AFGRUPOID
JOIN ACCIONFORMACION AF ON AF.ACCIONFORMACIONID = AFG.ACCIONFORMACIONID
JOIN PROYECTO PR ON PR.PROYECTOID = AF.PROYECTOID
JOIN EMPRESA E ON E.EMPRESAID = PR.EMPRESAID
WHERE AFGB.PERSONAID = :1
  AND TRIM(AFGB.CERTIFICA) = 'SI'
  AND TRIM(AFGB.VALIDACIONINTERVENTOR) = 'VERIFICADO'
ORDER BY AFGB.FECHAVALIDACIONINTERVENTOR DESC
```

### Generación del PDF (`generarPdf`)

Se ejecutan **9 queries Oracle en paralelo o secuencial** para recolectar todos los datos necesarios:

| Query # | Tabla(s) | Datos obtenidos |
|---|---|---|
| 1 | `AFGRUPOBENEFICIARIO JOIN PERSONA JOIN TIPODOCUMENTOIDENTIDAD` | Nombre, identificación, tipo doc, fechas |
| 2 | `AFGRUPO JOIN ACCIONFORMACION` | Nombre de la acción, proyecto, modalidad, tipo evento |
| 3 | `PROYECTO JOIN CONVENIOS JOIN CONVOCATORIA` | Proyecto, convenio, convocatoria |
| 4 | `EMPRESA JOIN CIUDAD` | Razón social, ciudad de la empresa |
| 5 | `CONVOCATORIA JOIN PROGRAMA` | Nombre del programa de formación |
| 6 | `TIPOEVENTO` | Tipo de evento (Conferencia, Taller, etc.) |
| 7 | `UNIDADTEMATICA` | Horas de formación según modalidad |
| 8 | `FIRMACERTIFICADOS` | Nombre, cargo e imagen BLOB de la firma |
| 9 | `PROYECTO` + `LOGOCAPACITADORES` | Logos BLOB del proyecto y capacitador |

### Cálculo de horas por modalidad
```typescript
switch(modalidad) {
  case 1: sumaHoras = HORAS_PP   // Presencial
  case 2: sumaHoras = HORAS_PAT  // A distancia tradicional
  case 3: sumaHoras = HORAS_HIB  // Híbrido
  case 4: sumaHoras = HORAS_VIR  // Virtual
  case 5: sumaHoras = HORAS_PP + HORAS_VIR   // Mixta 1
  case 6: sumaHoras = HORAS_PAT + HORAS_VIR  // Mixta 2
}
```

### Estructura del PDF (A4 landscape)
```
┌─────────────────────────────────────────────────────────┐
│  [Logo empresa proyecto]  [Logo capacitadores]          │
│                                                         │
│     El Servicio Nacional de Aprendizaje - SENA          │
│              y [NOMBRE EMPRESA]                         │
│                 Hacen Constar que                       │
│                                                         │
│            NOMBRE COMPLETO BENEFICIARIO                 │
│        con [Tipo Doc] No. [Identificación]              │
│                                                         │
│         Asistió a la Conferencia/Taller/etc.            │
│            NOMBRE ACCIÓN DE FORMACIÓN                   │
│                                                         │
│               NOMBRE DEL PROGRAMA                       │
│                                                         │
│  Convenio N° XXX ... duración de X horas               │
│  En testimonio, firmado en CIUDAD, a los...             │
│                                                         │
│         [Imagen de firma manuscrita BLOB]               │
│            NOMBRE FIRMANTE / CARGO                      │
│                                                         │
│  Convocatoria XXX — son gratuitas para los beneficiarios│
│                                                         │
│  La autenticidad puede verificarse en: EVD-2024-001    │
└─────────────────────────────────────────────────────────┘
```

### Manejo de LOBs Oracle
Los logos y firmas se almacenan como BLOB en Oracle. El servicio los convierte a `Buffer` antes de pasarlos a PDFKit:
```typescript
private readLob(lob: any): Promise<Buffer | null> {
  if (Buffer.isBuffer(lob)) return Promise.resolve(lob.length ? lob : null)
  // Stream Oracle LOB → Buffer
  return new Promise(resolve => {
    const chunks: Buffer[] = []
    lob.on('data', c => chunks.push(c))
    lob.on('end', () => { lob.close?.(() => {}); resolve(Buffer.concat(chunks)) })
    lob.on('error', () => { lob.close?.(() => {}); resolve(null) })
  })
}
```

### Texto de fecha en letras (réplica GeneXus)
GeneXus expresa la fecha del certificado en letras. Se replicó esta lógica en TypeScript:
```
"a los quince (15) días del mes de ABRIL (4) de dos mil veintiséis (2026)"
```

---

## 5. Pantallazos sugeridos

| # | Qué capturar | Cómo obtenerlo |
|---|---|---|
| 1 | Página de certificados — formulario vacío | Abrir `/certificados` |
| 2 | Tabla de resultados con certificados | Buscar con CC de un beneficiario de prueba |
| 3 | PDF del certificado abierto en el navegador | Clic en "Descargar" de un resultado |
| 4 | PDF completo con firma e imágenes | Desplegar un registro con todos los datos |
| 5 | Estado "Sin resultados" | Buscar con un número de documento inexistente |
| 6 | Búsqueda por código de evidencia | Seleccionar pestaña/opción código y buscar |

---

## Correo Ejecutivo

**Para:** proyectoar@sena.edu.co
**Asunto:** SEP — Módulo de Certificados implementado

---

Cordial saludo,

Se informa que el **módulo de Certificados** del nuevo SEP se encuentra implementado y en pruebas.

El módulo permite a cualquier persona (sin autenticación) consultar sus certificados de participación en acciones de formación del SENA, buscando por número de documento de identidad o por código de evidencia. Los certificados se generan en formato PDF de manera inmediata, con el fondo oficial del SENA, la firma digital del responsable y los logos del proyecto, replicando fielmente el formato actual del SEP GeneXus.

Se adjunta informe técnico con el detalle de las 9 consultas Oracle involucradas, el flujo de generación del PDF y la estructura del documento.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
