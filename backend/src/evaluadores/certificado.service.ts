import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as crypto from 'crypto'
import { AuditoriaService } from './auditoria.service'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument: new (opts?: Record<string, unknown>) => any = require('pdfkit')

/**
 * Certificados de participación del banco de evaluadores.
 *
 * Es un documento oficial, así que no basta con generar un PDF bonito:
 *
 *   - CONSECUTIVO por año, tomado bajo bloqueo para que dos emisiones
 *     simultáneas no se lleven el mismo número.
 *   - CODIGOVERIFICACION aleatorio, consultable sin sesión. Un PDF sin forma
 *     de validarlo es trivialmente falsificable.
 *   - DATOSSNAPSHOT congela lo que se certificó. Si mañana se corrige la
 *     ficha, la reimpresión sigue diciendo lo mismo que el original.
 *   - No se borra: se anula, y el consecutivo no se reutiliza.
 */

export interface CtxUsuario {
  usuarioEmail: string
  usuarioPerfilId?: number
}

interface Snapshot {
  nombre: string
  identificacion: string
  rol: string
  proceso: string
  modalidad: string
  anio: number
  periodo: string | null
  mesa: string | null
  equipo: string | null
  horas: number | null
  fechaInicio: string | null
  fechaFin: string | null
  convocatoria: string | null
  proyectosEvaluados: number

  // ── Congelado al emitir ──────────────────────────────────────────────
  // Quién firma y con qué texto salió el documento. Se guardan aquí y no se
  // vuelven a leer del catálogo, porque la coordinación del GGPC cambia de un
  // año a otro: si el PDF se regenerara leyendo FIRMACERTIFICADOS, un
  // certificado de 2024 pasaría a mostrar a quien coordina hoy — es decir,
  // el documento diría que lo firmó alguien que no lo firmó.
  firmaNombre?: string | null
  firmaCargo?: string | null
  /** Cuerpo con el que se emitió. La plantilla del ciclo puede reescribirse. */
  textoCertificado?: string | null
}

const PRIMARY = '#00304D'
const VERDE = '#39A900'

@Injectable()
export class CertificadoService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Emisión                                                               ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async emitir(participacionId: number, ctx: CtxUsuario, horasManuales?: number | null) {
    const datos = await this.reunirDatos(participacionId)

    const vigente = await this.dataSource.query(
      `SELECT CERTIFICADOID AS "id" FROM EVALUADORCERTIFICADO
        WHERE PARTICIPACIONID = :1 AND ANULADO = 0`,
      [participacionId],
    )
    if (vigente[0]) {
      throw new ConflictException(
        'Este ciclo ya tiene un certificado vigente. Anúlelo antes de emitir otro.',
      )
    }
    if (!datos.habilitado) {
      throw new BadRequestException(
        'La convocatoria todavía no habilitó la emisión de certificados. ' +
        'Actívela en la ficha del ciclo cuando el proceso haya cerrado.',
      )
    }

    const snapshot: Snapshot = {
      ...datos.snapshot,
      horas: horasManuales ?? datos.snapshot.horas,
      // Se congelan aquí, no al imprimir: quien firma y el cuerpo del documento
      // son parte de lo que se certificó, no de cómo se ve hoy el catálogo.
      firmaNombre: datos.firma?.nombre || null,
      firmaCargo: datos.firma?.cargo || null,
      textoCertificado: datos.texto ?? null,
    }

    let certificadoId = 0
    let consecutivo = 0
    let codigo = ''

    await this.dataSource.transaction(async m => {
      // El consecutivo se toma bajo bloqueo de las filas del año: sin esto,
      // dos emisiones a la vez leerían el mismo MAX y chocarían contra el
      // UNIQUE (ANIO, CONSECUTIVO) — o peor, quedarían con el mismo número.
      await m.query(
        `SELECT CERTIFICADOID FROM EVALUADORCERTIFICADO
          WHERE ANIO = :1 FOR UPDATE`, [snapshot.anio],
      )
      const max: Array<{ n: number }> = await m.query(
        `SELECT NVL(MAX(CONSECUTIVO), 0) AS "n" FROM EVALUADORCERTIFICADO WHERE ANIO = :1`,
        [snapshot.anio],
      )
      consecutivo = Number(max[0]?.n ?? 0) + 1
      codigo = this.generarCodigo(snapshot.anio, consecutivo)

      const seq: Array<{ NEXTVAL: number }> = await m.query(
        `SELECT EVALUADORCERTIFICADO_SEQ.NEXTVAL FROM dual`)
      certificadoId = Number(seq[0].NEXTVAL)

      await m.query(
        `INSERT INTO EVALUADORCERTIFICADO
           (CERTIFICADOID, PARTICIPACIONID, ANIO, CONSECUTIVO, CODIGOVERIFICACION,
            FECHAEMISION, EMITIDOPOR, FIRMACERTIFICADOSID, HORASCERTIFICADAS,
            DATOSSNAPSHOT, ARCHIVOMIME, ARCHIVONOMBRE)
         VALUES (:1, :2, :3, :4, :5, SYSDATE, :6, :7, :8, :9, 'application/pdf', :10)`,
        [
          certificadoId, participacionId, snapshot.anio, consecutivo, codigo,
          ctx.usuarioEmail, datos.firmaId, snapshot.horas ?? null,
          JSON.stringify(snapshot),
          `certificado-${snapshot.anio}-${String(consecutivo).padStart(4, '0')}.pdf`,
        ],
      )
    })

    // El PDF se genera después de tener el número: si fallara, el registro ya
    // existe y se puede regenerar desde el snapshot sin quemar otro consecutivo.
    const pdf = await this.construirPdf(snapshot, {
      consecutivo, codigo, texto: datos.texto, firma: datos.firma,
    })
    await this.dataSource.query(
      `UPDATE EVALUADORCERTIFICADO SET ARCHIVOPDF = :1 WHERE CERTIFICADOID = :2`,
      [pdf, certificadoId],
    )

    await this.auditoria.registrar({
      tabla: 'EVALUADORCERTIFICADO', operacion: 'EMITIR', registroId: certificadoId,
      evaluadorId: datos.evaluadorId, participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorDespues: { consecutivo, codigo, snapshot },
    })

    return {
      certificadoId, consecutivo, codigoVerificacion: codigo,
      anio: snapshot.anio,
      message: `Certificado ${snapshot.anio}-${String(consecutivo).padStart(4, '0')} emitido`,
    }
  }

  /**
   * A quiénes les falta certificado en el ciclo. Se excluyen los cierres
   * negativos (declinó, no aprobó, revocado): certificar participación a quien
   * no participó sería emitir un documento falso.
   */
  async pendientesDeCertificado(
    convocatoriaId: number,
  ): Promise<Array<{ participacionId: number; nombre: string; rol: string | null }>> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "participacionId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rol"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN ROLEVALUADOR r ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
        WHERE pa.CONVOCATORIAID = :1
          AND NVL(es.ESNEGATIVO, 0) = 0
          AND NOT EXISTS (SELECT 1 FROM EVALUADORCERTIFICADO c
                           WHERE c.PARTICIPACIONID = pa.PARTICIPACIONID AND c.ANULADO = 0)
        ORDER BY p.PERSONAPRIMERAPELLIDO`,
      [convocatoriaId],
    )
    return filas.map(f => ({
      participacionId: Number(f.participacionId),
      nombre: (f.nombre as string ?? '').trim(),
      rol: (f.rol as string | null) ?? null,
    }))
  }

  /** Emisión masiva del ciclo. Devuelve el detalle uno a uno, sin abortar. */
  async emitirLote(convocatoriaId: number, ctx: CtxUsuario) {
    const candidatos = await this.pendientesDeCertificado(convocatoriaId)

    const emitidos: Array<{ participacionId: number; nombre: string; consecutivo: number }> = []
    const omitidos: Array<{ participacionId: number; nombre: string; motivo: string }> = []

    // En serie a propósito: el consecutivo se toma bajo bloqueo y lanzarlos en
    // paralelo solo generaría contención sobre la misma fila.
    for (const c of candidatos) {
      try {
        const r = await this.emitir(c.participacionId, ctx)
        emitidos.push({ participacionId: c.participacionId, nombre: c.nombre, consecutivo: r.consecutivo })
      } catch (e) {
        omitidos.push({
          participacionId: c.participacionId, nombre: c.nombre,
          motivo: (e as Error).message,
        })
      }
    }

    return { total: candidatos.length, emitidos, omitidos }
  }

  async anular(certificadoId: number, motivo: string, ctx: CtxUsuario) {
    const texto = (motivo ?? '').trim()
    if (!texto) throw new BadRequestException('Indique el motivo de la anulación')

    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT c.PARTICIPACIONID AS "participacionId", c.ANULADO AS "anulado",
              c.CONSECUTIVO AS "consecutivo", c.ANIO AS "anio", pa.EVALUADORID AS "evaluadorId"
         FROM EVALUADORCERTIFICADO c
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = c.PARTICIPACIONID
        WHERE c.CERTIFICADOID = :1`,
      [certificadoId],
    )
    if (!filas[0]) throw new NotFoundException('Certificado no encontrado')
    if (Number(filas[0].anulado) === 1) throw new ConflictException('Ese certificado ya está anulado')

    await this.dataSource.query(
      `UPDATE EVALUADORCERTIFICADO
          SET ANULADO = 1, MOTIVOANULACION = :1, FECHAANULACION = SYSDATE, ANULADOPOR = :2
        WHERE CERTIFICADOID = :3`,
      [texto.slice(0, 500), ctx.usuarioEmail, certificadoId],
    )

    await this.auditoria.registrar({
      tabla: 'EVALUADORCERTIFICADO', operacion: 'ANULAR', registroId: certificadoId,
      evaluadorId: Number(filas[0].evaluadorId),
      participacionId: Number(filas[0].participacionId),
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: texto,
      valorAntes: { consecutivo: filas[0].consecutivo, anio: filas[0].anio },
    })

    // El consecutivo NO se reutiliza: un hueco en la numeración es una señal
    // legítima de que algo se anuló, y reciclarlo haría que dos documentos
    // distintos hayan circulado con el mismo número.
    return { message: 'Certificado anulado. El consecutivo no se reutiliza.' }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Descarga y verificación                                               ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async getPdf(certificadoId: number): Promise<{ buffer: Buffer; nombre: string }> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ARCHIVOPDF AS "pdf", TRIM(ARCHIVONOMBRE) AS "nombre",
              DATOSSNAPSHOT AS "snapshot", CONSECUTIVO AS "consecutivo",
              TRIM(CODIGOVERIFICACION) AS "codigo", ANULADO AS "anulado",
              FIRMACERTIFICADOSID AS "firmaId", PARTICIPACIONID AS "participacionId"
         FROM EVALUADORCERTIFICADO WHERE CERTIFICADOID = :1`,
      [certificadoId],
    )
    if (!filas[0]) throw new NotFoundException('Certificado no encontrado')
    const f = filas[0]

    if (f.pdf) {
      return {
        buffer: await this.lobToBuffer(f.pdf as NodeJS.ReadableStream | Buffer),
        nombre: (f.nombre as string) || `certificado-${certificadoId}.pdf`,
      }
    }

    // Sin BLOB se regenera desde el snapshot. Por eso el snapshot es NOT NULL:
    // es la fuente de verdad del documento, el PDF es solo su presentación.
    const snapshot = JSON.parse(f.snapshot as string) as Snapshot
    const extras = await this.textoYFirma(
      snapshot,
      f.firmaId as number | null,
      f.participacionId != null ? Number(f.participacionId) : null,
    )
    const pdf = await this.construirPdf(snapshot, {
      consecutivo: Number(f.consecutivo),
      codigo: f.codigo as string,
      ...extras,
    })
    await this.dataSource.query(
      `UPDATE EVALUADORCERTIFICADO SET ARCHIVOPDF = :1 WHERE CERTIFICADOID = :2`,
      [pdf, certificadoId],
    )
    return { buffer: pdf, nombre: (f.nombre as string) || `certificado-${certificadoId}.pdf` }
  }

  /**
   * Validación pública, sin sesión. Devuelve lo mínimo para confirmar que el
   * documento es auténtico: nombre, rol, año y estado. Nada de correos,
   * cédula completa ni identificadores internos — quien consulta puede ser
   * cualquiera con el código en la mano.
   */
  async verificar(codigo: string) {
    const limpio = (codigo ?? '').trim().toUpperCase()
    if (!limpio) throw new BadRequestException('Código requerido')

    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT DATOSSNAPSHOT AS "snapshot", CONSECUTIVO AS "consecutivo", ANIO AS "anio",
              FECHAEMISION AS "fechaEmision", ANULADO AS "anulado",
              TRIM(MOTIVOANULACION) AS "motivoAnulacion"
         FROM EVALUADORCERTIFICADO WHERE UPPER(CODIGOVERIFICACION) = :1`,
      [limpio],
    )
    if (!filas[0]) return { valido: false, motivo: 'No existe un certificado con ese código.' }

    const f = filas[0]
    const s = JSON.parse(f.snapshot as string) as Snapshot
    const anulado = Number(f.anulado) === 1

    return {
      valido: !anulado,
      motivo: anulado ? `Certificado anulado: ${f.motivoAnulacion ?? 'sin motivo registrado'}` : null,
      certificado: {
        numero: `${f.anio}-${String(Number(f.consecutivo)).padStart(4, '0')}`,
        nombre: s.nombre,
        // Cédula parcial: suficiente para cotejar, insuficiente para suplantar.
        identificacion: this.enmascarar(s.identificacion),
        rol: s.rol,
        proceso: s.proceso,
        anio: s.anio,
        horas: s.horas,
        fechaEmision: f.fechaEmision,
      },
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Datos y PDF                                                           ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  private async reunirDatos(participacionId: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.EVALUADORID AS "evaluadorId",
              pa.ANIO        AS "anio",
              TRIM(pa.PERIODO) AS "periodo",
              TRIM(pa.MESA)  AS "mesa",
              TRIM(pa.EQUIPOEVALUADOR) AS "equipo",
              pa.FECHAINICIO AS "fechaInicio",
              pa.FECHAFIN    AS "fechaFin",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) ||
                NVL2(TRIM(p.PERSONASEGUNDOAPELLIDO), ' ' || TRIM(p.PERSONASEGUNDOAPELLIDO), '') AS "nombre",
              TRIM(p.PERSONAIDENTIFICACION) AS "identificacion",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rol",
              TRIM(pe.PROCESONOMBRE)     AS "proceso",
              TRIM(mo.NOMBRE)            AS "modalidad",
              TRIM(cv.NOMBRE)            AS "convocatoria",
              cv.CERTIFICADOTEXTO        AS "texto",
              cv.CERTIFICADOFIRMAID      AS "firmaId",
              NVL(cv.CERTIFICADOHABILITADO, 0) AS "habilitado",
              (SELECT COUNT(*) FROM EVALUADORPARTPROYECTO pp
                WHERE pp.PARTICIPACIONID = pa.PARTICIPACIONID) AS "proyectos",
              (SELECT SUM(ca.HORAS) FROM EVALUADORCAPACITACION ca
                WHERE ca.PARTICIPACIONID = pa.PARTICIPACIONID) AS "horas"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN ROLEVALUADOR    r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN PROCESOEVAL     pe ON pe.PROCESOID     = pa.PROCESOID
         LEFT JOIN MODALIDADPART   mo ON mo.MODALIDADPARTID = pa.MODALIDADPARTID
         LEFT JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
        WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    if (!filas[0]) throw new NotFoundException('Participación no encontrada')
    const f = filas[0]

    const snapshot: Snapshot = {
      nombre: (f.nombre as string ?? '').trim(),
      identificacion: (f.identificacion as string ?? '').trim(),
      rol: (f.rol as string ?? 'Evaluador').trim(),
      proceso: (f.proceso as string ?? '').trim(),
      modalidad: (f.modalidad as string ?? '').trim(),
      anio: Number(f.anio),
      periodo: (f.periodo as string | null) ?? null,
      mesa: (f.mesa as string | null) ?? null,
      equipo: (f.equipo as string | null) ?? null,
      horas: f.horas != null ? Number(f.horas) : null,
      fechaInicio: f.fechaInicio ? new Date(f.fechaInicio as string).toISOString() : null,
      fechaFin: f.fechaFin ? new Date(f.fechaFin as string).toISOString() : null,
      convocatoria: (f.convocatoria as string | null) ?? null,
      proyectosEvaluados: Number(f.proyectos ?? 0),
    }

    const firma = await this.cargarFirma(f.firmaId as number | null)
    return {
      evaluadorId: Number(f.evaluadorId),
      habilitado: Number(f.habilitado) === 1,
      texto: (f.texto as string | null) ?? null,
      firmaId: f.firmaId != null ? Number(f.firmaId) : null,
      firma,
      snapshot,
    }
  }

  /**
   * Reconstruye texto y firma para reimprimir un certificado ya emitido.
   *
   * La regla es: **manda el snapshot**. Un certificado emitido en 2024 debe
   * salir hoy exactamente igual que el día que se firmó, aunque desde entonces
   * haya cambiado la coordinación del GGPC o se haya reescrito la plantilla
   * del ciclo. Del catálogo solo se toma la imagen de la rúbrica, y solo para
   * la firma que quedó registrada en la fila del certificado.
   *
   * El respaldo al catálogo existe únicamente para los certificados anteriores
   * a este congelamiento, cuyo snapshot no trae estos campos.
   */
  private async textoYFirma(
    snapshot: Snapshot,
    firmaId: number | null,
    participacionId: number | null,
  ) {
    const catalogo = await this.cargarFirma(firmaId)
    const congelada = snapshot.firmaNombre || snapshot.firmaCargo
    const firma = congelada
      ? {
          nombre: snapshot.firmaNombre ?? '',
          cargo: snapshot.firmaCargo ?? '',
          imagen: catalogo?.imagen ?? null,
        }
      : catalogo

    if (snapshot.textoCertificado != null) {
      return { texto: snapshot.textoCertificado, firma }
    }

    // Certificado viejo: se busca la plantilla por la participación, no por el
    // año. Un mismo año puede tener varias convocatorias y `ROWNUM = 1` traía
    // cualquiera de ellas, así que el cuerpo podía no ser el que correspondía.
    if (participacionId == null) return { texto: null, firma }
    const filas: Array<{ texto: string | null }> = await this.dataSource.query(
      `SELECT cv.CERTIFICADOTEXTO AS "texto"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
        WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    return { texto: filas[0]?.texto ?? null, firma }
  }

  private async cargarFirma(firmaId: number | null) {
    if (!firmaId) return null
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT FIRMACERTIFICADOSNOMBRE AS "nombre", FIRMACERTIFICADOSCARGO AS "cargo",
              FIRMACERTIFICADOSFIRMA AS "imagen"
         FROM FIRMACERTIFICADOS WHERE FIRMACERTIFICADOSID = :1`,
      [firmaId],
    ).catch(() => [])
    if (!filas[0]) return null
    return {
      nombre: String(filas[0].nombre ?? '').trim(),
      cargo: String(filas[0].cargo ?? '').trim(),
      imagen: filas[0].imagen
        ? await this.lobToBuffer(filas[0].imagen as NodeJS.ReadableStream | Buffer).catch(() => null)
        : null,
    }
  }

  /**
   * Rellena la plantilla de la convocatoria. Si no hay plantilla usa un texto
   * por defecto, porque un certificado sin cuerpo no sirve de nada y fallar
   * aquí dejaría al evaluador sin su constancia por una configuración que él
   * no controla.
   */
  private redactar(snapshot: Snapshot, plantilla: string | null): string {
    const base = plantilla?.trim() ||
      'El Grupo de Gestión para la Productividad y la Competitividad del SENA hace constar que ' +
      '{{nombre}}, identificado(a) con documento No. {{identificacion}}, participó como {{rol}} ' +
      'en el proceso de evaluación de proyectos de {{proceso}} durante la vigencia {{anio}}' +
      '{{horasFrase}}.'

    const valores: Record<string, string> = {
      nombre: snapshot.nombre.toUpperCase(),
      identificacion: snapshot.identificacion,
      rol: snapshot.rol,
      proceso: snapshot.proceso || 'Formación Continua Especializada',
      anio: String(snapshot.anio),
      horas: snapshot.horas != null ? String(snapshot.horas) : '',
      horasFrase: snapshot.horas != null ? `, con una dedicación de ${snapshot.horas} horas` : '',
      modalidad: snapshot.modalidad,
      mesa: snapshot.mesa ?? '',
      fechaInicio: this.fechaLarga(snapshot.fechaInicio),
      fechaFin: this.fechaLarga(snapshot.fechaFin),
    }
    return base.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => valores[k] ?? '')
  }

  private async construirPdf(
    snapshot: Snapshot,
    extra: {
      consecutivo: number
      codigo: string
      texto: string | null
      firma: { nombre: string; cargo: string; imagen: Buffer | null } | null
    },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 0 })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const W = doc.page.width
      const H = doc.page.height
      const M = 56
      const contenido = W - M * 2

      doc.rect(0, 0, W, 14).fill(PRIMARY)
      doc.rect(0, H - 10, W, 10).fill(VERDE)

      doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(11)
      doc.text('SERVICIO NACIONAL DE APRENDIZAJE — SENA', M, 52, { width: contenido, align: 'center' })
      doc.font('Helvetica').fontSize(9).fillColor('#555')
      doc.text('Grupo de Gestión para la Productividad y la Competitividad',
        M, doc.y + 3, { width: contenido, align: 'center' })

      doc.font('Helvetica-Bold').fontSize(26).fillColor(PRIMARY)
      doc.text('CERTIFICADO DE PARTICIPACIÓN', M, 108, { width: contenido, align: 'center' })

      doc.moveTo(W / 2 - 70, 146).lineTo(W / 2 + 70, 146).lineWidth(2).stroke(VERDE)

      doc.font('Helvetica').fontSize(12.5).fillColor('#1a1a1a')
      doc.text(this.redactar(snapshot, extra.texto), M + 30, 176, {
        width: contenido - 60, align: 'justify', lineGap: 5,
      })

      const detalles = [
        snapshot.convocatoria && `Convocatoria: ${snapshot.convocatoria}`,
        snapshot.modalidad && `Modalidad: ${snapshot.modalidad}`,
        snapshot.mesa && `Mesa: ${snapshot.mesa}`,
        snapshot.proyectosEvaluados > 0 && `Proyectos evaluados: ${snapshot.proyectosEvaluados}`,
      ].filter(Boolean) as string[]

      if (detalles.length) {
        doc.font('Helvetica').fontSize(9.5).fillColor('#666')
        doc.text(detalles.join('   ·   '), M + 30, doc.y + 16, {
          width: contenido - 60, align: 'center',
        })
      }

      // Firma
      const firmaY = H - 168
      if (extra.firma?.imagen) {
        try {
          doc.image(extra.firma.imagen, W / 2 - 70, firmaY - 46, { fit: [140, 44] })
        } catch { /* una firma ilegible no debe impedir emitir el certificado */ }
      }
      doc.moveTo(W / 2 - 110, firmaY).lineTo(W / 2 + 110, firmaY).lineWidth(0.8).stroke('#999')
      if (extra.firma) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
        doc.text(extra.firma.nombre, M, firmaY + 7, { width: contenido, align: 'center' })
        doc.font('Helvetica').fontSize(8.5).fillColor('#666')
        doc.text(extra.firma.cargo, M, doc.y + 1, { width: contenido, align: 'center' })
      }

      // Pie: número, código y cómo validarlo. Sin esto el PDF no se puede
      // contrastar contra nada y deja de servir como constancia.
      const numero = `${snapshot.anio}-${String(extra.consecutivo).padStart(4, '0')}`
      doc.font('Helvetica').fontSize(8).fillColor('#777')
      doc.text(
        `Certificado No. ${numero}   ·   Código de verificación: ${extra.codigo}`,
        M, H - 64, { width: contenido, align: 'center' },
      )
      doc.fontSize(7.5).fillColor('#999')
      doc.text(
        `Valide la autenticidad de este documento en  ${this.urlVerificacion(extra.codigo)}`,
        M, doc.y + 2, { width: contenido, align: 'center' },
      )

      doc.end()
    })
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Utilidades                                                            ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Código legible pero no adivinable: año, consecutivo y 6 caracteres
   * aleatorios. Derivarlo solo del consecutivo permitiría enumerar
   * certificados ajenos probando números.
   */
  private generarCodigo(anio: number, consecutivo: number): string {
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const bytes = crypto.randomBytes(6)
    let azar = ''
    for (let i = 0; i < 6; i++) azar += alfabeto[bytes[i] % alfabeto.length]
    return `${anio}-${String(consecutivo).padStart(4, '0')}-${azar}`
  }

  /**
   * URL de validación que se imprime en el certificado.
   *
   * Sale de `APP_URL` —la misma que ya usa `MailService` para los enlaces de
   * restablecimiento— y no de una variable propia: el documento se imprime y
   * circula fuera del sistema, así que apuntar a un dominio distinto del de
   * los correos sería una segunda dirección que mantener y que se desactualiza
   * sola. Con dos variables, la que nadie configura es la que rompe.
   *
   * El respaldo es el dominio institucional, no una ruta relativa: un
   * certificado que dice "/verificar-certificado/XXXX" es inservible justo
   * para quien más lo necesita, alguien externo intentando comprobarlo.
   */
  private urlVerificacion(codigo: string): string {
    const base = (process.env.APP_URL || 'https://sep.sena.edu.co')
      .trim().replace(/\/+$/, '')
    return `${base}/verificar-certificado/${codigo}`
  }

  private enmascarar(identificacion: string): string {
    const s = (identificacion ?? '').trim()
    if (s.length <= 4) return '••••'
    return '•'.repeat(Math.max(0, s.length - 4)) + s.slice(-4)
  }

  private fechaLarga(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
    })
  }

  private async lobToBuffer(lob: NodeJS.ReadableStream | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(lob)) return lob
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      lob.on('data', (c: Buffer) => chunks.push(c))
      lob.on('end', () => resolve(Buffer.concat(chunks)))
      lob.on('error', reject)
    })
  }
}
