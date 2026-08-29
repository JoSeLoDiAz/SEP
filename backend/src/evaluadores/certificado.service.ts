import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as crypto from 'crypto'
import { ControlCambiosService } from './control-cambios.service'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument: new (opts?: Record<string, unknown>) => any = require('pdfkit')

// certificados del banco de evaluadores

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

  // congelado al emitir: el catálogo cambia de un año a otro
  firmaNombre?: string | null
  firmaCargo?: string | null
  textoCertificado?: string | null
}

const PRIMARY = '#00304D'
const VERDE = '#39A900'

@Injectable()
export class CertificadoService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly controlCambios: ControlCambiosService,
  ) {}

  async emitir(participacionId: number, ctx: CtxUsuario, horasManuales?: number | null) {
    const datos = await this.reunirDatos(participacionId)

    // El filtro de estado estaba solo en la lista de pendientes: un ciclo
    // revocado no se proponía, pero sí se podía certificar entrando a él. Hay 18
    // ciclos negativos, y varios conservan proyectos, prueba y certificados.
    const estado: Array<{ negativo: number; nombre: string }> = await this.dataSource.query(
      `SELECT NVL(es.ESNEGATIVO, 0) AS "negativo", TRIM(es.NOMBRE) AS "nombre"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
        WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    if (Number(estado[0]?.negativo ?? 0) === 1) {
      throw new BadRequestException(
        `Este ciclo está en "${estado[0].nombre}": no se le puede emitir un certificado. ` +
        'Cambie el estado del ciclo si la participación sí se realizó.',
      )
    }

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
      firmaNombre: datos.firma?.nombre || null,
      firmaCargo: datos.firma?.cargo || null,
      textoCertificado: datos.texto ?? null,
    }

    let certificadoId = 0
    let consecutivo = 0
    let codigo = ''

    await this.dataSource.transaction(async m => {
      // FOR UPDATE del año: sin él dos emisiones leen el mismo MAX
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

    // el PDF va después del número: si falla se regenera sin quemar consecutivo
    const pdf = await this.construirPdf(snapshot, {
      consecutivo, codigo, texto: datos.texto, firma: datos.firma,
    })
    await this.dataSource.query(
      `UPDATE EVALUADORCERTIFICADO SET ARCHIVOPDF = :1 WHERE CERTIFICADOID = :2`,
      [pdf, certificadoId],
    )

    await this.controlCambios.registrar({
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

  // excluye cierres negativos (declinó, no aprobó, revocado)
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

  // emisión masiva: no aborta, reporta los omitidos
  async emitirLote(convocatoriaId: number, ctx: CtxUsuario) {
    const candidatos = await this.pendientesDeCertificado(convocatoriaId)

    const emitidos: Array<{ participacionId: number; nombre: string; consecutivo: number }> = []
    const omitidos: Array<{ participacionId: number; nombre: string; motivo: string }> = []

    // en serie: el consecutivo va bajo bloqueo, en paralelo solo hay contención
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

    await this.controlCambios.registrar({
      tabla: 'EVALUADORCERTIFICADO', operacion: 'ANULAR', registroId: certificadoId,
      evaluadorId: Number(filas[0].evaluadorId),
      participacionId: Number(filas[0].participacionId),
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: texto,
      valorAntes: { consecutivo: filas[0].consecutivo, anio: filas[0].anio },
    })

    return { message: 'Certificado anulado. El consecutivo no se reutiliza.' }
  }

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

    // sin BLOB se regenera desde el snapshot
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

  // consulta pública sin sesión: solo lo mínimo para cotejar
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
        identificacion: this.enmascarar(s.identificacion),
        rol: s.rol,
        proceso: s.proceso,
        anio: s.anio,
        horas: s.horas,
        fechaEmision: f.fechaEmision,
      },
    }
  }

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

  // manda el snapshot; el catálogo solo para certificados viejos y la rúbrica
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

    // por participación, no por año: un año tiene varias convocatorias
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

  // sin plantilla usa el texto por defecto en vez de fallar
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
        } catch { /* firma ilegible no bloquea la emisión */ }
      }
      doc.moveTo(W / 2 - 110, firmaY).lineTo(W / 2 + 110, firmaY).lineWidth(0.8).stroke('#999')
      if (extra.firma) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
        doc.text(extra.firma.nombre, M, firmaY + 7, { width: contenido, align: 'center' })
        doc.font('Helvetica').fontSize(8.5).fillColor('#666')
        doc.text(extra.firma.cargo, M, doc.y + 1, { width: contenido, align: 'center' })
      }

      // Pie
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

  // los 6 aleatorios evitan que se enumeren códigos ajenos
  private generarCodigo(anio: number, consecutivo: number): string {
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const bytes = crypto.randomBytes(6)
    let azar = ''
    for (let i = 0; i < 6; i++) azar += alfabeto[bytes[i] % alfabeto.length]
    return `${anio}-${String(consecutivo).padStart(4, '0')}-${azar}`
  }

  // APP_URL (la de MailService); absoluta porque el PDF circula fuera
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
