import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { EvaluadoresService } from './evaluadores.service'
import { TrayectoriaService } from './trayectoria.service'
import type { ProgresoCiclo } from './trayectoria.service'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument: new (opts?: Record<string, unknown>) => any = require('pdfkit')

/**
 * Ficha PDF del evaluador — la hoja de vida imprimible del banco.
 *
 * Es un documento de trabajo del gestor, no una constancia: se arma en vivo
 * contra la base (no hay snapshot ni consecutivo) y por eso lleva impreso que
 * es informativo. Certificar participación es tarea de `CertificadoService`.
 *
 * Dos reglas gobiernan el archivo:
 *
 *   - **Nunca revienta por datos incompletos.** La mayoría del banco está a
 *     medio llenar; una ficha que falla con un evaluador sin foto ni ciclos no
 *     sirve justamente para el caso en que más se necesita (ver qué falta).
 *     Todo valor ausente se imprime como "—" y toda sección vacía dice por qué.
 *   - **Una consulta por bloque, no una por fila.** Los ciclos salen de
 *     `TrayectoriaService.getTrayectoria`, que ya trae hitos y contadores de
 *     todos los años en dos consultas; los proyectos, de un solo SELECT
 *     agrupado en memoria.
 */

const PRIMARY = '#00304D'
const VERDE = '#39A900'
const GRIS_LINEA = '#E2E6EA'
const GRIS_FONDO = '#F4F6F8'
const GRIS_TEXTO = '#555555'
const GRIS_SUAVE = '#7A868F'
const NEGRO = '#1A1A1A'
const AMBAR = '#B45309'
const AMBAR_FONDO = '#FFF8EC'
const VERDE_FONDO = '#F1F8EC'
const BLANCO = '#FFFFFF'

/**
 * Tokens de `ESTADOPARTICIPACION.COLOR` traducidos a hexadecimal. El catálogo
 * guarda el nombre de la paleta, no un color, porque quien lo consume de
 * primera mano es el panel (clases de Tailwind); el PDF necesita el valor.
 */
const COLOR_ESTADO: Record<string, string> = {
  neutral: '#737373',
  blue: '#2563EB',
  indigo: '#4F46E5',
  cyan: '#0E7490',
  amber: '#D97706',
  orange: '#EA580C',
  green: '#059669',
  red: '#DC2626',
}

/** Margen lateral y franja inferior reservada para el pie de página. */
const M = 46
const RESERVA_PIE = 42
/**
 * Alto aproximado del bloque de un ciclo: título con sello + las 5 filas de la
 * grilla de 14 campos, ~24pt cada una. Se usa para no partirlo entre páginas.
 * Es una estimación, no una medida: si se queda corta el corte sigue siendo
 * legible porque la página nueva repite el año.
 */
const ALTO_CICLO = 150
const FOTO_W = 88
const FOTO_H = 108

/** Estado del dibujo: el documento y el cursor vertical. */
interface Lienzo {
  doc: any
  y: number
  x: number
  ancho: number
  /** Nombre del evaluador, para el encabezado de las páginas siguientes. */
  titular: string
  /**
   * Año que se está dibujando. Si un ciclo se parte entre dos páginas, la
   * continuación repite el año: sin esto, la página siguiente mostraba
   * "Aprobación del jefe: Registrada" sin decir de qué año, y en una hoja de
   * vida con seis años eso no se puede reconstruir leyendo.
   */
  anioActual?: number
}

interface ProyectoCiclo {
  participacionId: number
  nit: string | null
  razonSocial: string | null
  nombreProyecto: string | null
  puntajeOtorgado: number | null
}

/** Forma de un año del rail (los marcadores de hueco se filtran antes). */
interface AnioTrayectoria {
  anio: number
  participaciones: Array<Record<string, unknown>>
  soloPrueba: boolean
  pruebasSueltas: number
  mejorPuntajeSuelto: number | null
}

@Injectable()
export class FichaPdfService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly evaluadores: EvaluadoresService,
    private readonly trayectoria: TrayectoriaService,
  ) {}

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Entrada                                                               ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async generar(evaluadorId: number): Promise<{ buffer: Buffer; nombre: string }> {
    // La ficha es la única lectura obligatoria: si el evaluador no existe,
    // `getFicha` lanza el 404 y no se genera nada.
    const ficha = await this.evaluadores.getFicha(evaluadorId) as Record<string, unknown>

    const [resumen, trayectoria, estudios, experiencias, tics, foto, tieneCedula, proyectos] =
      await Promise.all([
        this.trayectoria.getResumen(evaluadorId),
        this.trayectoria.getTrayectoria(evaluadorId),
        this.evaluadores.listarEstudios(evaluadorId),
        this.evaluadores.listarExperiencias(evaluadorId),
        this.evaluadores.listarTics(evaluadorId),
        // Un evaluador sin foto es lo normal, no un error: 404 → sin foto.
        this.evaluadores.getFoto(evaluadorId).catch(() => null),
        this.tieneCedula(evaluadorId),
        this.proyectosPorCiclo(evaluadorId),
      ])

    const nombreCompleto = this.nombreCompleto(ficha)
    const buffer = await this.construirPdf({
      ficha, resumen, trayectoria, estudios, experiencias, tics,
      foto, tieneCedula, proyectos, nombreCompleto,
    })

    const identificacion = this.txt(ficha.identificacion, String(evaluadorId))
    return { buffer, nombre: `Ficha_evaluador_${this.limpiarNombre(identificacion)}.pdf` }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Datos que no expone ningún servicio                                   ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /** Alerta de la ficha: la cédula es el documento que traba todo lo demás. */
  private async tieneCedula(evaluadorId: number): Promise<boolean> {
    const filas: Array<{ tiene: number }> = await this.dataSource.query(
      `SELECT CASE WHEN EXISTS (
                SELECT 1 FROM EVALUADORDOCUMENTO d
                  JOIN TIPODOCUMENTOEVAL t ON t.TIPODOCUMENTOEVALID = d.TIPODOCUMENTOEVALID
                 WHERE d.EVALUADORID = :1
                   AND UPPER(TRIM(t.CODIGO)) = 'CEDULA')
              THEN 1 ELSE 0 END AS "tiene"
         FROM DUAL`,
      [evaluadorId],
    )
    return Number(filas[0]?.tiene ?? 0) === 1
  }

  /**
   * Proyectos evaluados de todos los ciclos en una sola consulta. Pedirlos
   * ciclo por ciclo (`getParticipacion`) sería un N+1 sobre un evaluador con
   * seis años de historia, para pintar cuatro líneas por año.
   */
  private async proyectosPorCiclo(evaluadorId: number): Promise<Map<number, ProyectoCiclo[]>> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pp.PARTICIPACIONID   AS "participacionId",
              TRIM(pp.NIT)         AS "nit",
              TRIM(pp.RAZONSOCIAL) AS "razonSocial",
              TRIM(pp.NOMBREPROYECTO) AS "nombreProyecto",
              pp.PUNTAJEOTORGADO   AS "puntajeOtorgado"
         FROM EVALUADORPARTPROYECTO pp
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = pp.PARTICIPACIONID
        WHERE pa.EVALUADORID = :1
        ORDER BY pp.PARTICIPACIONID, pp.PARTPROYECTOID`,
      [evaluadorId],
    )

    const mapa = new Map<number, ProyectoCiclo[]>()
    for (const f of filas) {
      const id = Number(f.participacionId)
      if (!mapa.has(id)) mapa.set(id, [])
      mapa.get(id)!.push({
        participacionId: id,
        nit: (f.nit as string | null) ?? null,
        razonSocial: (f.razonSocial as string | null) ?? null,
        nombreProyecto: (f.nombreProyecto as string | null) ?? null,
        puntajeOtorgado: f.puntajeOtorgado != null ? Number(f.puntajeOtorgado) : null,
      })
    }
    return mapa
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Documento                                                             ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  private construirPdf(d: {
    ficha: Record<string, unknown>
    resumen: Awaited<ReturnType<TrayectoriaService['getResumen']>>
    trayectoria: Awaited<ReturnType<TrayectoriaService['getTrayectoria']>>
    estudios: Array<Record<string, unknown>>
    experiencias: Array<Record<string, unknown>>
    tics: Array<Record<string, unknown>>
    foto: { buffer: Buffer; mime: string; nombre: string | null } | null
    tieneCedula: boolean
    proyectos: Map<number, ProyectoCiclo[]>
    nombreCompleto: string
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // `bufferPages` permite volver sobre las páginas ya escritas al final
      // para numerarlas: el total no se conoce hasta cerrar el contenido.
      const doc = new PDFDocument({
        size: 'LETTER', layout: 'portrait', margin: 0, bufferPages: true,
      })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const l: Lienzo = {
        doc, y: 0, x: M,
        ancho: doc.page.width - M * 2,
        titular: d.nombreCompleto,
      }

      this.abrirPagina(l, true)
      this.cabecera(l, d.ficha, d.foto, d.nombreCompleto)
      this.kpis(l, d.resumen)
      this.alertas(l, d.ficha, d.resumen, d.tieneCedula)

      this.titulo(l, 'Formación académica')
      this.tabla(l,
        [
          { titulo: 'Tipo', ancho: 0.18 },
          { titulo: 'Título', ancho: 0.34 },
          { titulo: 'Institución', ancho: 0.26 },
          { titulo: 'Grado', ancho: 0.12 },
          { titulo: 'Soporte', ancho: 0.10, alineacion: 'center' },
        ],
        d.estudios.map(e => [
          this.txt(e.tipoEstudio), this.txt(e.titulo), this.txt(e.institucion),
          this.fechaCorta(e.fechaGrado), e.tieneArchivo ? 'Sí' : '—',
        ]),
        'Sin estudios registrados en la ficha.',
      )

      this.titulo(l, 'Experiencia laboral')
      this.tabla(l,
        [
          { titulo: 'Cargo', ancho: 0.30 },
          { titulo: 'Entidad', ancho: 0.34 },
          { titulo: 'Desde', ancho: 0.12 },
          { titulo: 'Hasta', ancho: 0.12 },
          { titulo: 'Soporte', ancho: 0.12, alineacion: 'center' },
        ],
        d.experiencias.map(x => [
          this.txt(x.cargo), this.txt(x.entidad),
          this.fechaCorta(x.fechaInicio), this.fechaCorta(x.fechaFin),
          x.tieneArchivo ? 'Sí' : '—',
        ]),
        'Sin experiencia laboral registrada.',
      )

      this.titulo(l, 'Competencias TIC')
      this.tabla(l,
        [
          { titulo: 'Evento', ancho: 0.22 },
          { titulo: 'Nombre', ancho: 0.44 },
          { titulo: 'Horas', ancho: 0.10, alineacion: 'right' },
          { titulo: 'Fecha', ancho: 0.12 },
          { titulo: 'Soporte', ancho: 0.12, alineacion: 'center' },
        ],
        d.tics.map(t => [
          this.txt(t.tipoEvento), this.txt(t.nombre),
          t.horas != null ? String(Number(t.horas)) : '—',
          this.fechaCorta(t.fechaFin), t.tieneArchivo ? 'Sí' : '—',
        ]),
        'Sin formación ni eventos TIC registrados.',
      )

      this.titulo(l, 'Trayectoria como evaluador')
      this.trayectoriaPdf(l, d.trayectoria.anios, d.proyectos)

      this.pie(doc)
      doc.end()
    })
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Bloques                                                               ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /** Abre página con la banda superior y, salvo la primera, el hilo de quién es. */
  private abrirPagina(l: Lienzo, primera = false) {
    const { doc } = l
    if (!primera) doc.addPage({ size: 'LETTER', layout: 'portrait', margin: 0 })

    doc.rect(0, 0, doc.page.width, 12).fill(PRIMARY)
    l.y = 30

    if (primera) return

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY)
    // Sin recorte, un nombre largo se dibujaría por encima del rótulo de la
    // derecha: `lineBreak: false` no respeta el ancho, solo evita el salto.
    doc.text(this.recortar(doc, l.titular.toUpperCase(), l.ancho * 0.6), l.x, l.y, {
      width: l.ancho * 0.65, lineBreak: false,
    })
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS_SUAVE)
    doc.text('Ficha del evaluador (continuación)', l.x, l.y + 1, {
      width: l.ancho, align: 'right', lineBreak: false,
    })
    l.y += 14
    doc.moveTo(l.x, l.y).lineTo(l.x + l.ancho, l.y).lineWidth(0.7).stroke(GRIS_LINEA)
    l.y += 12

    // Si el salto ocurrió en mitad de un año, se repite el año arriba. Lo que
    // sigue son datos de ese ciclo y sin la banda quedan huérfanos.
    if (l.anioActual != null) {
      doc.rect(l.x, l.y, l.ancho, 15).fill(PRIMARY)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLANCO)
      doc.text(String(l.anioActual), l.x + 9, l.y + 3.5, { width: 70, lineBreak: false })
      doc.font('Helvetica').fontSize(7).fillColor('#BFD0DA')
      doc.text('continuación', l.x + 80, l.y + 4.5,
        { width: l.ancho - 90, align: 'right', lineBreak: false })
      l.y += 22
    }
  }

  /** Salta de página si lo que viene no cabe encima del pie. */
  private asegurar(l: Lienzo, alto: number) {
    if (l.y + alto <= l.doc.page.height - RESERVA_PIE) return
    this.abrirPagina(l)
  }

  private cabecera(
    l: Lienzo,
    ficha: Record<string, unknown>,
    foto: { buffer: Buffer; mime: string; nombre: string | null } | null,
    nombreCompleto: string,
  ) {
    const { doc } = l

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PRIMARY)
    doc.text('SERVICIO NACIONAL DE APRENDIZAJE — SENA', l.x, l.y, { width: l.ancho * 0.7 })
    doc.font('Helvetica').fontSize(7.8).fillColor(GRIS_TEXTO)
    doc.text('Grupo de Gestión para la Productividad y la Competitividad',
      l.x, l.y + 12, { width: l.ancho * 0.7 })
    doc.font('Helvetica-Bold').fontSize(7.8).fillColor(VERDE)
    doc.text('Banco de Evaluadores', l.x, l.y + 23, { width: l.ancho * 0.7 })

    doc.font('Helvetica-Bold').fontSize(13).fillColor(PRIMARY)
    doc.text('FICHA DEL EVALUADOR', l.x, l.y + 4, { width: l.ancho, align: 'right' })
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS_SUAVE)
    doc.text(`Generada el ${this.fechaLarga(new Date())}`,
      l.x, l.y + 22, { width: l.ancho, align: 'right' })

    l.y += 42
    doc.moveTo(l.x, l.y).lineTo(l.x + l.ancho, l.y).lineWidth(1.4).stroke(VERDE)
    l.y += 16

    const yBloque = l.y
    // Las iniciales salen de los campos, no del nombre armado: si la persona
    // no tiene nombre registrado no deben inventarse letras del texto de relleno.
    const iniciales = [ficha.nombres, ficha.primerApellido]
      .map(v => this.txt(v, '').charAt(0)).join('').toUpperCase()
    this.retrato(l, yBloque, foto, iniciales)

    const xTexto = l.x + FOTO_W + 14
    const anchoTexto = l.ancho - FOTO_W - 14

    // El estado va como sello a la derecha: saber que la ficha es de alguien
    // inactivo cambia la lectura de todo lo que sigue.
    const activo = Number(ficha.activo) === 1
    const anchoSello = this.sello(
      l, activo ? 'ACTIVO' : 'INACTIVO',
      activo ? VERDE : '#9AA5AD', BLANCO,
      l.x + l.ancho, yBloque + 2, 'derecha',
    )

    doc.font('Helvetica-Bold').fontSize(15.5).fillColor(PRIMARY)
    doc.text(nombreCompleto, xTexto, yBloque, { width: anchoTexto - anchoSello - 10 })

    let y = Math.max(doc.y, yBloque + 18) + 3
    doc.font('Helvetica').fontSize(8.6).fillColor(GRIS_TEXTO)
    doc.text(`Documento: ${this.txt(ficha.identificacion)}`, xTexto, y, { width: anchoTexto })
    y = doc.y + 8

    l.y = y
    this.grilla(l, [
      { k: 'Correo', v: this.txt(ficha.email) },
      { k: 'Correo institucional', v: this.txt(ficha.emailInstitucional) },
      { k: 'Celular', v: this.txt(ficha.celular) },
      { k: 'Cargo', v: this.txt(ficha.cargo) },
      { k: 'Profesión', v: this.txt(ficha.profesion) },
      { k: 'Posgrado', v: this.txt(ficha.posgrado) },
      { k: 'Regional', v: this.txt(ficha.regionalNombre) },
      { k: 'Centro de formación', v: this.txt(ficha.centroNombre) },
      { k: 'Municipio', v: this.municipio(ficha) },
      { k: 'Jefe inmediato', v: this.jefe(ficha) },
    ], 2, FOTO_W + 14)

    // El bloque no puede cerrar por encima del retrato o la sección siguiente
    // se dibujaría encima de la foto.
    l.y = Math.max(l.y, yBloque + FOTO_H) + 14
  }

  /** Foto del evaluador o, si no hay, un marco con sus iniciales. */
  private retrato(
    l: Lienzo, y: number,
    foto: { buffer: Buffer; mime: string; nombre: string | null } | null,
    iniciales: string,
  ) {
    const { doc } = l
    doc.rect(l.x, y, FOTO_W, FOTO_H).fill(GRIS_FONDO)

    if (foto?.buffer?.length) {
      try {
        doc.image(foto.buffer, l.x + 2, y + 2, {
          fit: [FOTO_W - 4, FOTO_H - 4], align: 'center', valign: 'center',
        })
      } catch {
        // Una imagen corrupta o en un formato que pdfkit no lee (HEIC, TIFF)
        // no puede tumbar la ficha completa: se cae al marco con iniciales.
        this.marcoVacio(l, y, iniciales)
      }
    } else {
      this.marcoVacio(l, y, iniciales)
    }

    doc.rect(l.x, y, FOTO_W, FOTO_H).lineWidth(0.8).stroke(GRIS_LINEA)
  }

  private marcoVacio(l: Lienzo, y: number, iniciales: string) {
    const { doc } = l
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#C3CCD3')
    doc.text(iniciales || '—', l.x, y + FOTO_H / 2 - 20, { width: FOTO_W, align: 'center' })
    doc.font('Helvetica').fontSize(6.4).fillColor(GRIS_SUAVE)
    doc.text('SIN FOTO', l.x, y + FOTO_H - 18, { width: FOTO_W, align: 'center' })
  }

  private kpis(l: Lienzo, r: Awaited<ReturnType<TrayectoriaService['getResumen']>>) {
    const { doc } = l
    const datos = [
      { k: 'Años', v: String(r.aniosParticipados) },
      { k: 'Ciclos', v: String(r.totalParticipaciones) },
      { k: 'Proyectos', v: String(r.totalProyectos) },
      { k: 'Certificados', v: String(r.totalCertificados) },
      { k: 'Retro. prom.', v: r.promedioRetro != null ? r.promedioRetro.toFixed(2) : '—' },
      { k: 'Prueba vigente', v: r.pruebaVigente?.vigente ? String(r.pruebaVigente.anio) : '—' },
    ]

    const alto = 42
    this.asegurar(l, alto + 12)
    const gap = 8
    const ancho = (l.ancho - gap * (datos.length - 1)) / datos.length

    datos.forEach((kpi, i) => {
      const x = l.x + i * (ancho + gap)
      doc.roundedRect(x, l.y, ancho, alto, 3).fill(GRIS_FONDO)
      doc.font('Helvetica-Bold').fontSize(14).fillColor(PRIMARY)
      doc.text(kpi.v, x, l.y + 8, { width: ancho, align: 'center', lineBreak: false })
      doc.font('Helvetica').fontSize(6.3).fillColor(GRIS_SUAVE)
      doc.text(kpi.k.toUpperCase(), x + 3, l.y + 27, {
        width: ancho - 6, align: 'center', lineBreak: false,
      })
    })

    l.y += alto + 14
  }

  /**
   * Lo que le falta a la ficha, arriba y en un recuadro. Es el bloque por el
   * que el gestor imprime esto: si las alertas quedaran al final o mezcladas
   * con el resto, nadie las vería.
   */
  private alertas(
    l: Lienzo,
    ficha: Record<string, unknown>,
    resumen: Awaited<ReturnType<TrayectoriaService['getResumen']>>,
    tieneCedula: boolean,
  ) {
    const avisos: string[] = []
    if (Number(ficha.activo) !== 1) avisos.push('El evaluador está inactivo en el banco.')
    if (!tieneCedula) avisos.push('No tiene cargado el documento de identidad (cédula).')
    if (ficha.tieneFoto !== true) avisos.push('No tiene foto cargada.')

    const p = resumen.pruebaVigente
    if (!p) {
      avisos.push('No registra prueba de conocimiento.')
    } else if (!p.aprobada) {
      avisos.push(
        `La última prueba (${p.anio}) no fue aprobada` +
        `${p.puntaje != null ? ` — puntaje ${p.puntaje}` : ''}.`,
      )
    } else if (!p.vigente) {
      avisos.push(`La prueba aprobada más reciente es de ${p.anio}: está vencida para la vigencia actual.`)
    }

    const { doc } = l
    const lineas = avisos.length ? avisos : ['Sin alertas: la ficha tiene lo mínimo para operar.']
    const acento = avisos.length ? AMBAR : VERDE
    const fondo = avisos.length ? AMBAR_FONDO : VERDE_FONDO
    const anchoTexto = l.ancho - 26

    doc.font('Helvetica').fontSize(8.2)
    const altoLineas = lineas.reduce(
      (s: number, t: string) => s + Number(doc.heightOfString(t, { width: anchoTexto })) + 2, 0,
    )
    const alto = altoLineas + 26

    this.asegurar(l, alto + 12)
    doc.rect(l.x, l.y, l.ancho, alto).fill(fondo)
    doc.rect(l.x, l.y, 3, alto).fill(acento)

    doc.font('Helvetica-Bold').fontSize(7).fillColor(acento)
    doc.text(avisos.length ? `ALERTAS (${avisos.length})` : 'ALERTAS', l.x + 12, l.y + 8, {
      width: anchoTexto, characterSpacing: 0.4,
    })

    let y = l.y + 20
    doc.font('Helvetica').fontSize(8.2).fillColor(NEGRO)
    for (const t of lineas) {
      doc.text(t, l.x + 12, y, { width: anchoTexto })
      y = Number(doc.y) + 2
    }

    l.y += alto + 16
  }

  private titulo(l: Lienzo, texto: string) {
    this.asegurar(l, 40)
    const { doc } = l
    doc.rect(l.x, l.y + 1, 3, 11).fill(VERDE)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
    doc.text(texto.toUpperCase(), l.x + 9, l.y, {
      width: l.ancho - 9, characterSpacing: 0.4, lineBreak: false,
    })
    l.y += 15
    doc.moveTo(l.x, l.y).lineTo(l.x + l.ancho, l.y).lineWidth(0.7).stroke(GRIS_LINEA)
    l.y += 9
  }

  /** Pares etiqueta/valor en rejilla. `sangria` deja libre la columna del retrato. */
  private grilla(
    l: Lienzo,
    pares: Array<{ k: string; v: string }>,
    columnas = 3,
    sangria = 0,
  ) {
    const { doc } = l
    const gap = 10
    const anchoCol = (l.ancho - sangria - gap * (columnas - 1)) / columnas

    for (let i = 0; i < pares.length; i += columnas) {
      const grupo = pares.slice(i, i + columnas)
      doc.font('Helvetica').fontSize(8)
      const alto = grupo.reduce(
        (max: number, p) => Math.max(max, Number(doc.heightOfString(p.v, { width: anchoCol }))), 0,
      ) + 13

      this.asegurar(l, alto)
      grupo.forEach((p, j) => {
        const x = l.x + sangria + j * (anchoCol + gap)
        doc.font('Helvetica-Bold').fontSize(6.2).fillColor(GRIS_SUAVE)
        doc.text(p.k.toUpperCase(), x, l.y, { width: anchoCol, characterSpacing: 0.3, lineBreak: false })
        doc.font('Helvetica').fontSize(8).fillColor(NEGRO)
        doc.text(p.v, x, l.y + 8, { width: anchoCol })
      })
      l.y += alto
    }
  }

  /**
   * Tabla con encabezado que se repite al cambiar de página. Sin la repetición,
   * una lista larga de estudios deja columnas sin título en la hoja siguiente.
   */
  private tabla(
    l: Lienzo,
    columnas: Array<{ titulo: string; ancho: number; alineacion?: 'left' | 'right' | 'center' }>,
    filas: string[][],
    vacio: string,
  ) {
    if (!filas.length) {
      this.nota(l, vacio)
      return
    }

    const { doc } = l
    const anchos = columnas.map(c => c.ancho * l.ancho)
    const dibujarEncabezado = () => {
      this.asegurar(l, 30)
      doc.rect(l.x, l.y, l.ancho, 15).fill(GRIS_FONDO)
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(PRIMARY)
      let x = l.x
      columnas.forEach((c, i) => {
        doc.text(c.titulo.toUpperCase(), x + 5, l.y + 5, {
          width: anchos[i] - 10, align: c.alineacion ?? 'left',
          characterSpacing: 0.3, lineBreak: false,
        })
        x += anchos[i]
      })
      l.y += 15
    }

    dibujarEncabezado()

    for (const fila of filas) {
      doc.font('Helvetica').fontSize(7.8)
      const alto = fila.reduce(
        (max: number, celda, i) =>
          Math.max(max, Number(doc.heightOfString(celda || '—', { width: anchos[i] - 10 }))), 0,
      ) + 8

      if (l.y + alto > doc.page.height - RESERVA_PIE) {
        this.abrirPagina(l)
        dibujarEncabezado()
      }

      let x = l.x
      doc.font('Helvetica').fontSize(7.8).fillColor(NEGRO)
      fila.forEach((celda, i) => {
        doc.text(celda || '—', x + 5, l.y + 4, {
          width: anchos[i] - 10, align: columnas[i].alineacion ?? 'left',
        })
        x += anchos[i]
      })
      l.y += alto
      doc.moveTo(l.x, l.y).lineTo(l.x + l.ancho, l.y).lineWidth(0.4).stroke(GRIS_LINEA)
    }

    l.y += 12
  }

  private nota(l: Lienzo, texto: string) {
    this.asegurar(l, 24)
    const { doc } = l
    doc.font('Helvetica').fontSize(8).fillColor(GRIS_SUAVE)
    doc.text(texto, l.x, l.y, { width: l.ancho })
    l.y = Number(doc.y) + 14
  }

  /**
   * Etiqueta redondeada. Devuelve su ancho para poder acomodar lo de al lado;
   * el tope evita que un nombre de estado largo se coma el título del ciclo.
   */
  private sello(
    l: Lienzo, texto: string, fondo: string, color: string,
    x: number, y: number, anclaje: 'izquierda' | 'derecha' = 'izquierda',
    maxAncho = 150,
  ): number {
    const { doc } = l
    doc.font('Helvetica-Bold').fontSize(6.5)
    const etiqueta = this.recortar(doc, texto, maxAncho - 14)
    const ancho = Number(doc.widthOfString(etiqueta)) + 14
    const izquierda = anclaje === 'derecha' ? x - ancho : x
    doc.roundedRect(izquierda, y, ancho, 13, 6.5).fill(fondo)
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(color)
    doc.text(etiqueta, izquierda, y + 4, {
      width: ancho, align: 'center', characterSpacing: 0.3, lineBreak: false,
    })
    return ancho
  }

  /**
   * Recorta con puntos suspensivos hasta que quepa en `ancho`. Se usa donde el
   * texto se dibuja sin salto de línea, que en pdfkit ignora el ancho de la
   * caja y se sale del margen en lugar de cortarse.
   */
  private recortar(doc: any, texto: string, ancho: number): string {
    if (ancho <= 0) return ''
    if (Number(doc.widthOfString(texto)) <= ancho) return texto
    let corte = texto
    while (corte.length > 1 && Number(doc.widthOfString(`${corte}…`)) > ancho) {
      corte = corte.slice(0, -1)
    }
    return `${corte.trimEnd()}…`
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Trayectoria                                                           ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  private trayectoriaPdf(
    l: Lienzo,
    anios: Array<Record<string, unknown>>,
    proyectos: Map<number, ProyectoCiclo[]>,
  ) {
    if (!anios.length) {
      this.nota(l, 'Todavía no tiene participaciones registradas en ningún año.')
      return
    }

    for (const fila of anios) {
      // El rail intercala marcadores de hueco entre años no consecutivos; aquí
      // se imprimen como una línea tenue en vez de descartarlos, porque un año
      // sin participar también es información de trayectoria.
      if (fila.gap === true) {
        l.anioActual = undefined
        this.hueco(l, Number(fila.desde), Number(fila.hasta))
        continue
      }

      const anio = fila as unknown as AnioTrayectoria
      const partes = anio.participaciones ?? []
      const totalProyectos = partes.reduce(
        (s, p) => s + Number((p.contadores as Record<string, unknown> | undefined)?.proyectos ?? 0), 0,
      )

      const resumen = anio.soloPrueba
        ? `${anio.pruebasSueltas} prueba(s) sin ciclo asociado`
        : [
            `${partes.length} ciclo${partes.length === 1 ? '' : 's'}`,
            totalProyectos > 0 ? `${totalProyectos} proyecto${totalProyectos === 1 ? '' : 's'}` : null,
          ].filter(Boolean).join('   ·   ')

      // El encabezado se dibuja con el año aún sin marcar: si el salto ocurre
      // justo aquí, la banda del año se pinta entera en la página nueva y
      // repetirla arriba sería decir dos veces lo mismo.
      //
      // Se reserva también el primer ciclo (ALTO_CICLO): un "2025" solo al pie
      // de la página, con su contenido en la siguiente, obliga a repetir la
      // banda y deja media hoja en blanco. Encabezado y primer ciclo viajan
      // juntos, que es lo que se lee como un bloque.
      l.anioActual = undefined
      this.encabezadoAnio(l, anio.anio, resumen, partes.length ? ALTO_CICLO : 0)
      l.anioActual = anio.anio

      if (anio.soloPrueba) {
        this.nota(l,
          'Año con registro histórico de prueba de conocimiento, sin participación asociada' +
          `${anio.mejorPuntajeSuelto != null ? ` (mejor puntaje: ${anio.mejorPuntajeSuelto})` : ''}.`)
        continue
      }

      if (!partes.length) {
        this.nota(l, 'Sin ciclos registrados en este año.')
        continue
      }

      for (const p of partes) this.ciclo(l, p, proyectos.get(Number(p.participacionId)) ?? [])
    }
    l.anioActual = undefined
  }

  private encabezadoAnio(l: Lienzo, anio: number, resumen: string, reservaExtra = 0) {
    this.asegurar(l, 46 + reservaExtra)
    const { doc } = l
    doc.rect(l.x, l.y, l.ancho, 18).fill(PRIMARY)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLANCO)
    doc.text(String(anio), l.x + 9, l.y + 5, { width: 70, lineBreak: false })
    doc.font('Helvetica').fontSize(7.4).fillColor('#BFD0DA')
    doc.text(resumen, l.x + 80, l.y + 6, { width: l.ancho - 90, align: 'right', lineBreak: false })
    l.y += 25
  }

  private hueco(l: Lienzo, desde: number, hasta: number) {
    this.asegurar(l, 20)
    const { doc } = l
    const etiqueta = desde === hasta
      ? `${desde} · sin participación`
      : `${desde} – ${hasta} · sin participación`
    doc.font('Helvetica').fontSize(7.2).fillColor('#9AA5AD')
    doc.text(etiqueta, l.x, l.y, { width: l.ancho, align: 'center', lineBreak: false })
    l.y += 16
  }

  private ciclo(l: Lienzo, p: Record<string, unknown>, proyectos: ProyectoCiclo[]) {
    const { doc } = l
    const progreso = p.progreso as ProgresoCiclo | undefined
    const hito = (codigo: string) => progreso?.hitos.find(h => h.codigo === codigo)
    const contadores = (p.contadores ?? {}) as Record<string, unknown>

    // Se reserva el bloque ENTERO, no solo el encabezado. Con 72pt el ciclo se
    // partía casi siempre: el año quedaba en una página y "aprobación del jefe
    // / curso / prueba / certificado" en la siguiente. Si aun así no cabe
    // —muchos proyectos—, el corte se sigue permitiendo y `abrirPagina` repite
    // el año arriba.
    this.asegurar(l, ALTO_CICLO)

    const estado = this.txt(p.estadoNombre, 'Sin estado')
    const anchoSello = this.sello(
      l, estado.toUpperCase(), this.colorEstado(p.estadoColor), BLANCO,
      l.x + l.ancho, l.y, 'derecha',
    )

    const titulo = [
      this.txt(p.rolNombre, 'Rol sin definir'),
      this.txt(p.procesoNombre, 'Proceso sin definir'),
    ].join('   ·   ') + (p.esTransversal === true ? '   ·   Transversal' : '')

    doc.font('Helvetica-Bold').fontSize(9).fillColor(PRIMARY)
    doc.text(titulo, l.x, l.y + 1, { width: l.ancho - anchoSello - 12 })

    let y = Math.max(Number(doc.y), l.y + 13)
    if (progreso) {
      doc.font('Helvetica').fontSize(6.8).fillColor(GRIS_SUAVE)
      doc.text(`Ciclo completado: ${progreso.cumplidos} de ${progreso.total} hitos`, l.x, y, {
        width: l.ancho, lineBreak: false,
      })
      y += 10
    }
    l.y = y + 4

    const curso = hito('CURSO')
    const prueba = hito('PRUEBA')
    const retroRecibidas = Number(contadores.retroRecibidas ?? 0)
    const promedio = p.promedioRetro != null ? Number(p.promedioRetro) : null

    this.grilla(l, [
      { k: 'Área', v: this.txt(p.areaNombre) },
      { k: 'Modalidad', v: this.txt(p.modalidadNombre) },
      { k: 'Periodo', v: this.txt(p.periodo) },
      { k: 'Mesa', v: this.txt(p.mesa) },
      { k: 'Equipo evaluador', v: this.txt(p.equipoEvaluador) },
      { k: 'Dinamizador', v: this.txt(p.dinamizadorNombre) },
      { k: 'Vigencia', v: this.rango(p.fechaInicio, p.fechaFin) },
      { k: 'Aprobación del jefe', v: hito('AUTORIZACION')?.cumplido ? 'Registrada' : 'Pendiente' },
      { k: 'Confidencialidad', v: hito('CONFIDENCIALIDAD')?.cumplido ? 'Firmada' : 'Pendiente' },
      { k: 'Curso de formación', v: this.resultado(curso?.cumplido, curso?.detalle) },
      { k: 'Prueba de conocimiento', v: this.resultado(prueba?.cumplido, prueba?.detalle) },
      { k: 'Proyectos evaluados', v: String(Number(contadores.proyectos ?? 0)) },
      {
        k: 'Retroalimentación recibida',
        v: promedio != null
          ? `${promedio.toFixed(2)} (${retroRecibidas} respuesta${retroRecibidas === 1 ? '' : 's'})`
          : 'Sin respuestas',
      },
      { k: 'Certificado', v: hito('CERTIFICADO')?.cumplido ? 'Emitido' : 'No emitido' },
    ], 3, 0)

    const motivo = this.txt(p.motivoNoParticipa, '')
    if (motivo) {
      this.asegurar(l, 22)
      doc.font('Helvetica').fontSize(7.6).fillColor(AMBAR)
      doc.text(`Motivo de no participación: ${motivo}`, l.x, l.y + 2, { width: l.ancho })
      l.y = Number(doc.y) + 4
    }

    if (proyectos.length) {
      this.asegurar(l, 24)
      doc.font('Helvetica-Bold').fontSize(6.2).fillColor(GRIS_SUAVE)
      doc.text('PROYECTOS EVALUADOS', l.x, l.y + 3, { width: l.ancho, characterSpacing: 0.3, lineBreak: false })
      l.y += 13

      for (const pr of proyectos) {
        const nombre = [pr.razonSocial, pr.nombreProyecto].filter(Boolean).join(' — ')
          || pr.nit || 'Proyecto sin identificar'
        const linea = `·  ${nombre}` +
          (pr.nit && pr.razonSocial ? `  (NIT ${pr.nit})` : '') +
          (pr.puntajeOtorgado != null ? `  ·  ${pr.puntajeOtorgado} pts` : '')

        doc.font('Helvetica').fontSize(7.4)
        const alto = Number(doc.heightOfString(linea, { width: l.ancho - 12 })) + 2
        this.asegurar(l, alto)
        doc.font('Helvetica').fontSize(7.4).fillColor(GRIS_TEXTO)
        doc.text(linea, l.x + 10, l.y, { width: l.ancho - 12 })
        l.y += alto
      }
      l.y += 4
    }

    this.asegurar(l, 12)
    doc.moveTo(l.x, l.y + 4).lineTo(l.x + l.ancho, l.y + 4).lineWidth(0.4).stroke(GRIS_LINEA)
    l.y += 14
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Pie                                                                   ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Se escribe al final sobre las páginas ya bufferizadas: el "de N" no existe
   * hasta que se sabe cuántas páginas ocupó la trayectoria.
   */
  private pie(doc: any) {
    const rango = doc.bufferedPageRange()
    const ancho = doc.page.width - M * 2

    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i)
      const alto = doc.page.height

      doc.rect(0, alto - 8, doc.page.width, 8).fill(VERDE)
      doc.font('Helvetica').fontSize(6.8).fillColor(GRIS_SUAVE)
      // La nota va en una sola línea sin corte, así que se mantiene corta a
      // propósito: si creciera, invadiría el número de página de la derecha.
      doc.text(
        `Generada el ${this.fechaLarga(new Date())} · Documento informativo: ` +
        'refleja lo registrado a la fecha y no constituye certificación.',
        M, alto - 26, { width: ancho * 0.78, lineBreak: false },
      )
      doc.text(`Página ${i + 1} de ${rango.count}`, M, alto - 26, {
        width: ancho, align: 'right', lineBreak: false,
      })
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Utilidades                                                            ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  private nombreCompleto(ficha: Record<string, unknown>): string {
    const partes = [ficha.nombres, ficha.primerApellido, ficha.segundoApellido]
      .map(v => this.txt(v, ''))
      .filter(Boolean)
    return partes.join(' ') || 'Evaluador sin nombre registrado'
  }

  private municipio(ficha: Record<string, unknown>): string {
    const ciudad = this.txt(ficha.municipioNombre, '')
    const depto = this.txt(ficha.municipioDeptoNombre, '')
    if (!ciudad && !depto) return '—'
    return [ciudad, depto].filter(Boolean).join(', ')
  }

  private jefe(ficha: Record<string, unknown>): string {
    const nombre = this.txt(ficha.jefeNombre, '')
    if (!nombre) return '—'
    const detalle = [this.txt(ficha.jefeCargo, ''), this.txt(ficha.jefeEmail, '')].filter(Boolean)
    return detalle.length ? `${nombre} (${detalle.join(' · ')})` : nombre
  }

  /** Texto del hito: distingue "no aprobado" de "sin registro". */
  private resultado(cumplido: boolean | undefined, detalle?: string | null): string {
    const dato = (detalle ?? '').trim()
    if (cumplido) return dato ? `Aprobado · ${dato}` : 'Aprobado'
    return dato ? `No aprobado · ${dato}` : 'Sin registro'
  }

  private rango(inicio: unknown, fin: unknown): string {
    const a = this.fechaCorta(inicio)
    const b = this.fechaCorta(fin)
    if (a === '—' && b === '—') return '—'
    return `${a} – ${b}`
  }

  /**
   * El color del estado viene del catálogo y pdfkit revienta con un valor que
   * no sepa interpretar, así que solo se acepta hexadecimal o un token conocido.
   *
   * `ESTADOPARTICIPACION.COLOR` no guarda hexadecimal sino el token de la paleta
   * (`green`, `red`, `amber`…) que el panel traduce a clases de Tailwind. Sin
   * esta tabla el sello salía siempre azul institucional y un ciclo REVOCADO se
   * veía igual que uno CERTIFICADO. Se usa el tono 600 y no el 500 del panel
   * porque aquí el texto va en blanco sobre el relleno y en papel el 500 no
   * alcanza a leerse.
   */
  private colorEstado(valor: unknown): string {
    const s = typeof valor === 'string' ? valor.trim() : ''
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s
    return COLOR_ESTADO[s.toLowerCase()] ?? PRIMARY
  }

  /**
   * Texto imprimible de un valor de la base. Lo que no sea fecha, número o
   * cadena se trata como vacío: en una ficha impresa, un "[object Object]"
   * (un LOB sin leer, por ejemplo) es peor que un guion.
   */
  private txt(valor: unknown, vacio = '—'): string {
    if (valor == null) return vacio
    if (valor instanceof Date) return this.fechaCorta(valor)
    if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
    if (typeof valor !== 'string') return vacio
    return valor.trim() || vacio
  }

  private fechaCorta(valor: unknown): string {
    if (valor == null || valor === '') return '—'
    if (!(valor instanceof Date) && typeof valor !== 'string' && typeof valor !== 'number') return '—'
    const d = valor instanceof Date ? valor : new Date(valor)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota',
    })
  }

  private fechaLarga(d: Date): string {
    return d.toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
    })
  }

  /** El nombre del archivo viaja en una cabecera HTTP: nada de rutas ni comillas. */
  private limpiarNombre(valor: string): string {
    return valor.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      || 'evaluador'
  }
}
