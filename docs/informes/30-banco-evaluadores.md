# Informe de Desarrollo — Módulo Banco de Evaluadores y Retroalimentación 360
**Sistema Especializado de Proyectos — GGPC SENA**
**Periodo:** Agosto y septiembre de 2026 | **Estado:** Implementado y en pruebas

---

## 1. Descripción General

El **Banco de Evaluadores** es el módulo que el SEP de GeneXus no tenía. Antes, la información de quienes evalúan los proyectos vivía en un Excel que se rearmaba cada convocatoria: sin historial por año, sin soportes archivados y sin forma de saber a quién se puede volver a convocar.

El módulo construye tres cosas que antes no existían:

- **La ficha del evaluador**: datos personales, hoja de vida, estudios, certificaciones TIC, experiencia laboral y en proyectos, con cada soporte guardado.
- **El ciclo anual**: cada año el evaluador participa con un rol, un área y un proceso; con su autorización del jefe, su curso de formación, su prueba de conocimiento, los proyectos que evaluó y su certificado de participación.
- **La retroalimentación 360**: al cierre del ciclo, los pares se evalúan entre sí con un instrumento que cuelga de la convocatoria.

Y añade una cuarta, que es la que cambia la operación: **el evaluador entra con su propia cuenta** y mantiene su expediente al día, en vez de que la gestión persiga los soportes por correo.

**Pantallas de gestión**: `/panel/evaluadores` y lo que cuelga de ahí.
**Pantalla del evaluador**: `/panel/mi-expediente`.

### Tamaño

| | |
|---|---|
| Backend | 28 archivos, 13.838 líneas, 2 módulos de Nest |
| Endpoints | **168** (95 del banco, 35 del portal del evaluador, 26 de retroalimentación, 11 del ciclo, 1 público) |
| Frontend | 11 rutas y 12 componentes propios |
| Tablas | escribe en 30, lee de unas 45 |
| Migraciones | v19 a v71; **30 de ellas en este periodo** |

---

## 2. Cronología de agosto y septiembre

Del historial de git en la ventana del informe salen **63 commits con alcance del módulo**: 30 de funcionalidad nueva, 23 de corrección, 5 de datos, 2 de estilo, 2 de documentación y 1 de reordenamiento.

**El reparto por mes conviene decirlo sin adornos: 61 de los 63 son de agosto y 2 de septiembre.** Agosto fue el mes del módulo. En septiembre el trabajo se movió a la infraestructura —la migración a la base de datos del SENA y el despliegue automatizado a preproducción—, y el módulo quedó congelado a propósito: no se toca lo que se está trasladando.

| Semana | Qué se hizo | Tipo |
|---|---|---|
| 2 ago | Grupos y estado del ciclo editables desde la pantalla. Con eso, los 50 endpoints de escritura del módulo ya tienen pantalla que los llame | feat |
| 3–9 ago | Corregir una participación sin borrarla; antes cambiar un rol mal escogido se llevaba por delante los documentos, el curso, la prueba y el certificado del año | feat |
| 3–9 ago | Registrar a mano un proyecto evaluado que no está en el SEP, marcado como *Histórico*: los proyectos anteriores al módulo nunca se importaron | feat |
| 3–9 ago | Miniatura de la foto para el listado: la pantalla pasa de 796 kB a 117 kB, un 85 % menos. La original se conserva para la descarga y la ficha | feat |
| 3–9 ago | Visor de la ficha sin descargarla, mostrando el mismo PDF que se imprime y no una copia en HTML | feat |
| 3–9 ago | Cuatro correcciones de archivos: fotos que no cargaban, «tiene foto» sin mirar si traía bytes, subidas que no mandaban el archivo y documentos que no se dejaban abrir | fix |
| 3–9 ago | Catálogos que le faltaban al banco: despacho de las 34 regionales, dos centros y las convocatorias de 2019, 2020 y 2021 | chore |
| 10–16 ago | La prueba se aprueba por **porcentaje** y no por puntaje bruto | fix |
| 10–16 ago | Registrar quién dinamizó la mesa; el curso del año se puede corregir | feat |
| 10–16 ago | Nace el **portal del evaluador**: mi expediente | feat |
| 17–23 ago | Ficha por fases: hitos, anillo de progreso y recorrido año por año | feat |
| 24–30 ago | Cargue del histórico de retroalimentación por convocatoria, registrado en quien la recibió | feat |
| 24–30 ago | El certificado de participación cuenta como experiencia. El recorrido anual toma la mejor prueba del año | feat |
| 24–30 ago | Cada quien cambia su propia contraseña desde el panel | feat |
| 31 ago – 6 sep | El dinamizador del GGPC califica aparte del ciclo, con su centinela | feat |
| 7–13 sep | *(fuera del módulo)* migración a la base del SENA: 39 tablas, 25 del banco y 7 de la retroalimentación | chore |

---

## 3. Flujo General

```
GESTIÓN DEL BANCO                          EL EVALUADOR
        │                                        │
        ▼  Registrar evaluador                   │
        │   Busca la persona por documento       │
        │   ANTES de crearla: si ya está en el   │
        │   SEP se reutiliza y NO se sobrescribe │
        │   lo que ya tenía                      │
        │                                        │
        ▼  Se crea usuario y perfil              ▼  Entra con su cuenta
        │   → clave inicial irrepetible             /panel/mi-expediente
        │                                        │
        ▼  Abrir el ciclo del año                ▼  Completa su expediente
        │   sobre una convocatoria del SEP          hoja de vida, estudios,
        │   (hereda año y nombre)                   TIC, experiencia, soportes
        │                                        │
        ▼  Participación del evaluador           │
        │   rol + área + proceso + modalidad     │
        │                                        │
        ├─▶ autorización del jefe                │
        ├─▶ curso de formación                   │
        ├─▶ prueba de conocimiento ──────────────┤  se aprueba por PORCENTAJE
        ├─▶ proyectos evaluados                  │
        │                                        │
        ▼  Retroalimentación 360 del ciclo       ▼  Diligencia la suya
        │   se genera para TODO el ciclo,           /panel/retroalimentacion
        │   no evaluador por evaluador           │
        │   regenerar no toca lo diligenciado    │
        │                                        │
        ▼  Certificado de participación          ▼  Descarga su certificado
        │   firma CONGELADA en el snapshot          y su ficha en PDF
        │                                        │
        ▼                                        │
   Verificación pública ◀───────────────────────┘
   ruta sin sesión, valida por código
```

---

## 4. Frontend

| Pantalla | Rol |
|---|---|
| `panel/evaluadores/page.tsx` | Banco: 24 tarjetas por página, 4 métricas —tres de ellas filtros rápidos (sin cédula, sin foto, sin prueba vigente)—, filtros que viven en la URL y exportación a Excel del banco filtrado |
| `panel/evaluadores/nuevo/page.tsx` | Registrar evaluador: busca la persona por documento antes de crearla; cierra con clave inicial o con el aviso de los datos que ya tenía el SEP |
| `panel/evaluadores/[id]/page.tsx` | **Ficha del evaluador** (3.202 líneas). 4 pestañas: Trayectoria, Perfil (4 subpestañas), Documentos y Control de cambios |
| `panel/evaluadores/convocatorias/page.tsx` | Listado de ciclos con filtro por año y estado, chip de modalidad y número de documentos |
| `panel/evaluadores/convocatorias/nueva/page.tsx` | Crear el ciclo del año encima de una convocatoria del SEP |
| `panel/evaluadores/convocatorias/[cid]/page.tsx` | Ficha del ciclo. 3 pestañas: Datos, Reglas y certificados, Documentos |
| `panel/evaluadores/convocatorias/[cid]/matriz/page.tsx` | Retroalimentación 360: abrir y cerrar el instrumento, simular los pares, alertas de quién no retroalimenta y a quién nadie retroalimenta, avance por persona y Excel |
| `panel/evaluadores/catalogos/page.tsx` | Catálogos del banco: se activan y desactivan, nunca se borran |
| `panel/mi-expediente/page.tsx` | **Mi expediente**: el evaluador mantiene sus datos y descarga su ficha. Chip «Ficha inactiva · solo consulta» cuando no está activo |
| `panel/retroalimentacion/...` | Mi retroalimentación: lo que le toca diligenciar |

Dentro de Trayectoria, un ciclo abierto despliega otras 5 subpestañas: Documentos, Formación y pruebas, Proyectos evaluados, Retroalimentación y Certificado.

**Los ids de perfil no están escritos en el código.** Llegan de `GET /perfiles/claves`, porque el perfil «gestor de evaluadores» es el 15 en la base de desarrollo y el 103 en la del SENA. Cablearlos habría roto el menú al pasar a producción.

---

## 5. Backend

### Archivos

| Archivo | Rol |
|---|---|
| `evaluadores/evaluadores.service.ts` | Núcleo (2.800 líneas): alta con usuario y perfil, listado con filtros, foto, expediente y documentos |
| `evaluadores/ciclo.service.ts` | Todo lo que cuelga del ciclo: autorización del jefe, capacitación, proyectos evaluados y grupos |
| `evaluadores/trayectoria.service.ts` | Hitos, anillo de progreso y recorrido año por año. **Los hitos se calculan, no se guardan** |
| `evaluadores/certificado.service.ts` | Emisión individual y por lote, anulación, PDF y verificación pública |
| `evaluadores/convocatorias.service.ts` | El ciclo del banco con sus notas de corte, texto y firma del certificado |
| `evaluadores/catalogos.service.ts` | Los 14 catálogos del banco |
| `evaluadores/control-cambios.service.ts` | Único camino de escritura al registro de cambios: siete operaciones con foto antes y después |
| `evaluadores/mi-expediente.service.ts` | Resuelve el evaluador desde la sesión y comprueba la pertenencia de cada registro |
| `evaluadores/mi-expediente.guard.ts` | Autoriza **por tener ficha en el banco, no por perfil** |
| `evaluadores/ficha-pdf.service.ts` | Hoja de vida imprimible; informativa, no certifica |
| `evaluadores/reportes.service.ts` | Sábana en Excel: una hoja por persona y otra por participación |
| `evaluadores/miniatura-foto.ts` | Miniatura de 400 px sobre lienzo blanco |
| `evaluadores/firma-imagen.ts` | Detecta el formato real de una imagen **por sus bytes de cabecera**, no por la extensión |
| `evaluadores/subida-archivo.ts` | Filtro de subidas compartido; corrige el nombre que llega mal codificado |
| `evaluadores/responder-archivo.ts` | Sirve un documento forzando la descarga de lo que el navegador ejecutaría |
| `retroalimentacion/retro-matriz.service.ts` | Genera la matriz del ciclo y simula los pares |
| `retroalimentacion/retro-historico.service.ts` | Cargue del histórico por convocatoria |
| `retroalimentacion/retro-reporte.service.ts` | Avance y reporte del ciclo |
| `retroalimentacion/dinamizador.ts` | El centinela del dinamizador del GGPC |

### Endpoints, por propósito

| Grupo | Cuántos | Quién entra |
|---|---|---|
| Banco: catálogos, ficha, expediente, ciclos, certificados y documentos | 95 | gestión |
| Portal del evaluador | 35 | el propio evaluador |
| Retroalimentación 360 | 26 | gestión y evaluador, según la ruta |
| Ciclo del banco y sus documentos | 11 | gestión |
| Verificación de un certificado | 1 | **público, sin sesión** |

### Reglas críticas

- **La prueba se aprueba por porcentaje**, nunca por puntaje bruto. 40 sobre 50 no es lo mismo que 40 sobre 100.
- **«Sin evaluar» no es «reprobado»**: se pinta en gris, jamás en rojo.
- El recorrido anual toma la **mejor** prueba del año, no la última cargada.
- La **firma del certificado queda congelada** al emitirlo.
- Corregir una participación **no borra** lo que cuelga de ella.
- Regenerar la matriz **no toca** lo ya diligenciado.
- El registro de cambios no tiene forma de modificarse ni borrarse desde la aplicación.

---

## 6. Modelo de datos

El módulo nace en la migración **v20** y llega a la **v71**. En este periodo entraron 30 migraciones.

**Tablas propias** (25 del banco y 7 de la retroalimentación):

```
EVALUADOR ──┬── EVALUADORPARTICIPACION ──┬── EVALUADORAPROBACION
            │        (el ciclo del año)  ├── EVALUADORCAPACITACION
            │                            ├── EVALUADORPRUEBA
            │                            ├── EVALUADORPARTPROYECTO
            │                            └── EVALUADORCERTIFICADO
            ├── EVALUADORESTUDIO
            ├── EVALUADOREXPERIENCIA
            ├── EVALUADORTIC
            ├── EVALUADORDOCUMENTO
            └── EVALUADORLOG  (registro de cambios)

EVALUADORCONVOCATORIA ──┬── CONVOCATORIADOCUMENTO
                        └── RETROFORMULARIO ──┬── RETROPREGUNTA
                                              ├── RETROASIGNACION
                                              ├── RETROSESION ── RETRORESPUESTA ── RETRORESPUESTAITEM
                                              └── RETROSUGERENCIA
```

Los documentos y las fotos se guardan dentro de la fila que los usa. Existe además una capa opcional que los lee de disco y, si el archivo no aparece, vuelve al contenido de la base sin que el usuario note nada.

**Migraciones de este periodo que conviene destacar:**

| Versión | Qué hace |
|---|---|
| v42 | Admite el proyecto histórico registrado a mano |
| v43, v45, v46 | Completan el catálogo de centros: el despacho de las 34 regionales y los dos centros que de verdad faltaban |
| v47 | Crea las convocatorias de 2019, 2020 y las dos de 2021 |
| v50 | La columna de la miniatura de la foto |
| v61 | Deshace una convocatoria duplicada |
| v66 | Reclasifica 20 soportes leyendo su contenido |
| v67 | Quita un género que el sistema afirmaba sin que nadie lo hubiera declarado |
| v68 | El dinamizador del GGPC, como fuente externa al ciclo |
| v69–v71 | Paquete de paso a la base del SENA: 39 tablas y sus llaves |

---

## 7. Decisiones de diseño y problemas resueltos

Esta sección es la que explica **por qué** el módulo quedó como quedó. El hilo que las une es uno: *la pantalla no debe afirmar nada que el dato no respalde.*

### Criterios que medían otra cosa de la que decían

**La prueba se aprueba por porcentaje.** Se medía el puntaje bruto contra la nota de corte, y el puntaje cambia de significado cada año según cuántas preguntas tenga la prueba. Había una prueba con corte de 70 comparada contra 41 aciertos —que eran el 82 %— marcada como **no aprobada**. Afectaba a 156 de 180 pruebas.

**«Sin evaluar» en gris, nunca en rojo.** 64 de 66 pruebas no traían ni porcentaje ni corte. Pintarlas en rojo era afirmar que reprobó gente que probablemente pasó, justamente en la pantalla que decide a quién se vuelve a convocar.

**La mejor prueba del año, no la última.** 22 pares evaluador-año tienen más de una prueba, con hasta 17 puntos de diferencia entre ellas. Se imprimía la última cargada.

**La retroalimentación se registra en quien la recibió**, no en quien la emitió. No todos hacen retroalimentación, así que cargándola por autor media plantilla no tenía nada que registrar. Y lo recibido es lo que alimenta el promedio y las alertas de la ficha.

### Datos que el sistema inventaba

Tres valores por defecto afirmaban cosas que nadie había declarado: un género que en el catálogo significa algo concreto, una ciudad que en realidad es «Ninguna», y un año de referencia prellenado con el año en curso. Se quitaron, y la migración v67 deshizo los que ya estaban guardados.

También se marcaba como «Vigente» una experiencia que no tenía fechas.

### Cosas que solo se ven ejecutando de verdad

- **Las fotos no cargaban** porque el contenido de la base llega como un flujo que hay que leer *después* de que la consulta terminó, y para entonces la conexión ya volvió al pool. Se piden completas, y el frontend encola las descargas de tres en tres.
- **«Tiene foto»** se resolvía mirando si la columna estaba llena, sin comprobar si traía bytes: una carga a medias afirmaba que la foto estaba.
- **Los documentos no se dejaban abrir** porque la pestaña se pedía *después* de descargar el archivo, y el bloqueador de emergentes la tumbaba. Ahora se abre vacía primero.
- **Las subidas nuevas no mandaban el archivo**: la configuración común de peticiones marcaba el tipo de contenido también en los formularios con archivo, donde lo tiene que escribir el navegador.
- **Las fechas se mostraban un día antes** al formatear una fecha de calendario en zona horaria de Bogotá.
- **Las tildes** rompían la búsqueda y el orden alfabético: «CORREDOR» aparecía entre Barón y Caballero.

### Dos decisiones que evitan que el pasado se reescriba

**La firma del certificado queda congelada al emitirlo.** La coordinación del GGPC cambia cada año; al regenerar el PDF, un certificado de 2024 pasaba a decir que lo firmó quien coordina hoy. Del catálogo solo se toma la imagen de la rúbrica.

**Las preguntas del instrumento cuelgan de la convocatoria, no del año.** La hoja de retroalimentación cambió de un proceso a otro; atarla al año habría invalidado todas las respuestas anteriores al primer cambio.

**El certificado de participación cuenta como experiencia**, pero se deriva al momento de leer y no se copia a la tabla de experiencia: una copia mentiría si el ciclo cambia de año o de convocatoria.

---

## 8. Seguridad

- **La autorización se comprueba en cada método**, no con etiquetas en la ruta: `exigirGestion()` y `exigirAdmin()` contra la lista de perfiles de gestión.
- **El portal del evaluador autoriza por tener ficha en el banco**, no por perfil, y comprueba la pertenencia de cada registro que se toca: nadie puede llegar al expediente de otro cambiando un número en la dirección.
- **El evaluador inactivo consulta pero no modifica.**
- **Los documentos se sirven forzando la descarga** de todo lo que el navegador ejecutaría, y el formato se detecta por los bytes de cabecera y no por la extensión del nombre.
- **El registro de cambios es de solo escritura**: la aplicación no tiene forma de modificarlo ni de borrarlo.
- **La única ruta sin sesión** es la verificación de un certificado por su código, que responde si es válido y nada más.

---

## 9. Pantallazos sugeridos

1. Banco de Evaluadores con las cuatro métricas y los filtros aplicados.
2. Ficha del evaluador — pestaña Trayectoria, con el anillo de progreso y el recorrido por años.
3. Ficha del evaluador — un ciclo abierto con sus cinco subpestañas.
4. Matriz de retroalimentación del ciclo, con las alertas y el avance por persona.
5. Mi expediente, tal como lo ve el evaluador.
6. Certificado de participación en PDF.
7. Verificación pública de un certificado por su código.

---

## Correo Ejecutivo

Se informa que el **módulo Banco de Evaluadores** del nuevo SEP, junto con su **retroalimentación 360**, ha sido finalizado y se encuentra en pruebas. El módulo no existía en el SEP de GeneXus: la información de los evaluadores se llevaba en un archivo de Excel que se rearmaba en cada convocatoria, sin historial por año ni soportes archivados.

**Funcionalidades entregadas:**

- **Ficha del evaluador** con hoja de vida, estudios, certificaciones TIC, experiencia laboral y en proyectos, cada una con su soporte archivado.
- **Ciclo anual** por evaluador: rol, área y proceso, con autorización del jefe, curso de formación, prueba de conocimiento, proyectos evaluados y certificado.
- **Retroalimentación 360** del ciclo, con simulación de los pares, alertas de quién no retroalimenta y a quién nadie retroalimenta, y avance por persona.
- **Portal del evaluador**: cada evaluador entra con su cuenta y mantiene su propio expediente, en lugar de que la gestión persiga los soportes por correo.
- **Certificado de participación** con verificación pública por código, y la firma congelada en el momento de la emisión.
- **Registro de cambios** con foto antes y después de cada operación, sin forma de alterarlo desde la aplicación.
- **Reportes en Excel** del banco y del ciclo de retroalimentación.

**Sobre el periodo del informe:** el trabajo se concentró en agosto —61 de los 63 cambios registrados—, con especial atención a los criterios de medición. El más relevante: la prueba de conocimiento se calificaba comparando el puntaje bruto contra la nota de corte, lo que marcaba como no aprobadas pruebas que sí lo estaban; afectaba a 156 de 180 registros. En septiembre el módulo se mantuvo estable de forma deliberada, mientras el esfuerzo pasó al traslado de la información a la base de datos del SENA y a la automatización del despliegue a preproducción.

Se adjunta informe técnico con los **168 endpoints**, el modelo de 32 tablas propias y el detalle de las 30 migraciones aplicadas en el periodo.

Cordialmente,

---
*Grupo de Gestión para la Productividad y la Competitividad — GGPC SENA*
