import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ControlCambiosService } from './control-cambios.service'
import type { MulterFile } from './evaluadores.service'
import { EXTENSIONES_CORREO, MIMES_CORREO } from './formatos-correo'

// lo que cuelga de un ciclo del evaluador; todo se ancla a PARTICIPACIONID

export interface AprobacionDto {
  aprobadorNombre: string
  aprobadorEmail: string
  aprobadorCargo?: string | null
  fechaAprobacion: string
  observaciones?: string | null
}

export interface CapacitacionDto {
  nombre: string
  origen?: 'EXTERNO' | 'SISTEMA'
  plataforma?: string | null
  horas?: number | null
  fechaInicio?: string | null
  fechaFin?: string | null
  calificacion?: number | null
  calificacionMinima?: number | null
  intentos?: number | null
  observaciones?: string | null
}

export interface PartProyectoDto {
  proyectoId?: number | null
  guardadoId?: number | null
  nit?: string | null
  razonSocial?: string | null
  nombreProyecto?: string | null
  puntajeOtorgado?: number | null
  fechaEvaluacion?: string | null
  observaciones?: string | null
}

export interface CtxUsuario {
  usuarioEmail: string
  usuarioPerfilId?: number
}

// 8 MB: un .msg con adjuntos pesa más que un PDF
const MAX_EVIDENCIA_BYTES = 8 * 1024 * 1024

// se valida por extensión con el mime de respaldo: el .msg llega unas veces como octet-stream y otras como vnd.ms-outlook
const EVIDENCIA_EXTENSIONES = ['pdf', ...EXTENSIONES_CORREO].map(x => `.${x}`)
const EVIDENCIA_MIMES = ['application/pdf', ...MIMES_CORREO]

@Injectable()
export class CicloService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly controlCambios: ControlCambiosService,
  ) {}

  // aprobación del jefe: 1:1 con el ciclo

  async crearAprobacion(participacionId: number, dto: AprobacionDto, ctx: CtxUsuario) {
    const evaluadorId = await this.evaluadorDe(participacionId)

    if (!dto.aprobadorNombre?.trim()) throw new BadRequestException('Nombre del aprobador requerido')
    if (!dto.aprobadorEmail?.trim()) throw new BadRequestException('Correo del aprobador requerido')
    if (!dto.fechaAprobacion) throw new BadRequestException('Fecha de aprobación requerida')

    const yaExiste = await this.dataSource.query(
      `SELECT APROBACIONID FROM EVALUADORAPROBACION WHERE PARTICIPACIONID = :1`, [participacionId],
    )
    if (yaExiste[0]) {
      throw new ConflictException(
        'Este ciclo ya tiene aprobación registrada. Edítela en vez de crear otra.',
      )
    }

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORAPROBACION_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)

    await this.dataSource.query(
      `INSERT INTO EVALUADORAPROBACION
         (APROBACIONID, PARTICIPACIONID, APROBADORNOMBRE, APROBADOREMAIL, APROBADORCARGO,
          FECHAAPROBACION, OBSERVACIONES, USUARIOCREACION)
       VALUES (:1, :2, :3, :4, :5, TO_DATE(:6, 'YYYY-MM-DD'), :7, :8)`,
      [
        id, participacionId,
        dto.aprobadorNombre.trim(),
        dto.aprobadorEmail.trim().toLowerCase(),
        dto.aprobadorCargo?.trim() || null,
        dto.fechaAprobacion.slice(0, 10),
        dto.observaciones?.trim() || null,
        ctx.usuarioEmail,
      ],
    )

    await this.controlCambios.registrar({
      tabla: 'EVALUADORAPROBACION', operacion: 'INSERT', registroId: id,
      evaluadorId, participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorDespues: { ...dto, aprobacionId: id },
    })

    return { aprobacionId: id, message: 'Aprobación registrada' }
  }

  async actualizarAprobacion(aprobacionId: number, dto: Partial<AprobacionDto>, ctx: CtxUsuario) {
    const antes = await this.getAprobacionCruda(aprobacionId)

    const sets: string[] = []
    const params: unknown[] = []
    const push = (col: string, valor: unknown) => {
      params.push(valor)
      sets.push(`${col} = :${params.length}`)
    }

    if (dto.aprobadorNombre !== undefined) push('APROBADORNOMBRE', dto.aprobadorNombre?.trim() || null)
    if (dto.aprobadorEmail !== undefined) push('APROBADOREMAIL', dto.aprobadorEmail?.trim().toLowerCase() || null)
    if (dto.aprobadorCargo !== undefined) push('APROBADORCARGO', dto.aprobadorCargo?.trim() || null)
    if (dto.observaciones !== undefined) push('OBSERVACIONES', dto.observaciones?.trim() || null)
    if (dto.fechaAprobacion !== undefined) {
      params.push(dto.fechaAprobacion.slice(0, 10))
      sets.push(`FECHAAPROBACION = TO_DATE(:${params.length}, 'YYYY-MM-DD')`)
    }
    if (sets.length === 0) return { message: 'Sin cambios' }

    push('USUARIOMODIFICACION', ctx.usuarioEmail)
    sets.push('FECHAMODIFICACION = SYSDATE')

    params.push(aprobacionId)
    await this.dataSource.query(
      `UPDATE EVALUADORAPROBACION SET ${sets.join(', ')} WHERE APROBACIONID = :${params.length}`,
      params,
    )

    await this.controlCambios.registrarCambio(
      'EVALUADORAPROBACION', aprobacionId, antes, dto,
      {
        usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
        evaluadorId: antes.evaluadorId, participacionId: antes.participacionId,
      },
    )

    return { message: 'Aprobación actualizada' }
  }

  async subirEvidenciaAprobacion(aprobacionId: number, file: MulterFile, ctx: CtxUsuario) {
    const antes = await this.getAprobacionCruda(aprobacionId)
    this.validarEvidencia(file)

    await this.dataSource.query(
      `UPDATE EVALUADORAPROBACION
          SET CORREOEVIDENCIA = :1, CORREOEVIDENCIAMIME = :2, CORREOEVIDENCIANOMBRE = :3,
              USUARIOMODIFICACION = :4, FECHAMODIFICACION = SYSDATE
        WHERE APROBACIONID = :5`,
      [file.buffer, file.mimetype || 'application/octet-stream', file.originalname, ctx.usuarioEmail, aprobacionId],
    )

    await this.controlCambios.registrar({
      tabla: 'EVALUADORAPROBACION', operacion: 'UPDATE', registroId: aprobacionId,
      evaluadorId: antes.evaluadorId, participacionId: antes.participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `Evidencia cargada: ${file.originalname}`,
    })

    return { message: 'Evidencia cargada' }
  }

  async getEvidenciaAprobacion(aprobacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT CORREOEVIDENCIA AS "blob", TRIM(CORREOEVIDENCIAMIME) AS "mime",
              TRIM(CORREOEVIDENCIANOMBRE) AS "nombre"
         FROM EVALUADORAPROBACION WHERE APROBACIONID = :1`,
      [aprobacionId],
    )
    if (!rows[0]) throw new NotFoundException('Aprobación no encontrada')
    if (!rows[0].blob) throw new NotFoundException('Esta aprobación no tiene evidencia cargada')
    return {
      buffer: await this.lobToBuffer(rows[0].blob as NodeJS.ReadableStream | Buffer),
      mime: (rows[0].mime as string) || 'application/octet-stream',
      nombre: (rows[0].nombre as string) || `evidencia_${aprobacionId}`,
    }
  }

  async eliminarAprobacion(aprobacionId: number, ctx: CtxUsuario) {
    const antes = await this.getAprobacionCruda(aprobacionId)
    await this.dataSource.query(
      `DELETE FROM EVALUADORAPROBACION WHERE APROBACIONID = :1`, [aprobacionId],
    )
    await this.controlCambios.registrar({
      tabla: 'EVALUADORAPROBACION', operacion: 'DELETE', registroId: aprobacionId,
      evaluadorId: antes.evaluadorId, participacionId: antes.participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorAntes: antes,
    })
    return { message: 'Aprobación eliminada' }
  }

  // capacitación del ciclo

  async crearCapacitacion(participacionId: number, dto: CapacitacionDto, ctx: CtxUsuario) {
    const evaluadorId = await this.evaluadorDe(participacionId)
    if (!dto.nombre?.trim()) throw new BadRequestException('Nombre del curso requerido')

    // la nota de corte se congela al crear: si el mínimo sube después, el histórico no cambia
    const minimo = dto.calificacionMinima ?? await this.minimoCursoDeConvocatoria(participacionId)
    const aprobado = this.calcularAprobado(dto.calificacion, minimo)

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORCAPACITACION_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)

    await this.dataSource.query(
      `INSERT INTO EVALUADORCAPACITACION
         (CAPACITACIONID, PARTICIPACIONID, NOMBRE, ORIGEN, PLATAFORMA, HORAS,
          FECHAINICIO, FECHAFIN, CALIFICACION, CALIFICACIONMINIMA, APROBADO,
          INTENTOS, OBSERVACIONES, USUARIOCREACION)
       VALUES (:1, :2, :3, :4, :5, :6,
               TO_DATE(:7,'YYYY-MM-DD'), TO_DATE(:8,'YYYY-MM-DD'), :9, :10, :11,
               :12, :13, :14)`,
      [
        id, participacionId,
        dto.nombre.trim(),
        dto.origen ?? 'EXTERNO',
        dto.plataforma?.trim() || null,
        dto.horas ?? null,
        dto.fechaInicio?.slice(0, 10) || null,
        dto.fechaFin?.slice(0, 10) || null,
        dto.calificacion ?? null,
        minimo ?? null,
        aprobado ? 1 : 0,
        dto.intentos ?? null,
        dto.observaciones?.trim() || null,
        ctx.usuarioEmail,
      ],
    )

    await this.controlCambios.registrar({
      tabla: 'EVALUADORCAPACITACION', operacion: 'INSERT', registroId: id,
      evaluadorId, participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorDespues: { ...dto, calificacionMinima: minimo, aprobado },
    })

    return { capacitacionId: id, aprobado, message: 'Capacitación registrada' }
  }

  async actualizarCapacitacion(capacitacionId: number, dto: Partial<CapacitacionDto>, ctx: CtxUsuario) {
    const antes = await this.getCapacitacionCruda(capacitacionId)

    const sets: string[] = []
    const params: unknown[] = []
    const push = (col: string, valor: unknown) => {
      params.push(valor)
      sets.push(`${col} = :${params.length}`)
    }
    const pushFecha = (col: string, valor?: string | null) => {
      params.push(valor?.slice(0, 10) || null)
      sets.push(`${col} = TO_DATE(:${params.length},'YYYY-MM-DD')`)
    }

    if (dto.nombre !== undefined) push('NOMBRE', dto.nombre?.trim() || null)
    if (dto.origen !== undefined) push('ORIGEN', dto.origen)
    if (dto.plataforma !== undefined) push('PLATAFORMA', dto.plataforma?.trim() || null)
    if (dto.horas !== undefined) push('HORAS', dto.horas ?? null)
    if (dto.intentos !== undefined) push('INTENTOS', dto.intentos ?? null)
    if (dto.observaciones !== undefined) push('OBSERVACIONES', dto.observaciones?.trim() || null)
    if (dto.fechaInicio !== undefined) pushFecha('FECHAINICIO', dto.fechaInicio)
    if (dto.fechaFin !== undefined) pushFecha('FECHAFIN', dto.fechaFin)

    // APROBADO nunca viene del cliente: se deriva de la nota contra el corte congelado
    if (dto.calificacion !== undefined || dto.calificacionMinima !== undefined) {
      const calificacion = dto.calificacion !== undefined ? dto.calificacion : antes.calificacion
      const minimo = dto.calificacionMinima !== undefined ? dto.calificacionMinima : antes.calificacionMinima
      if (dto.calificacion !== undefined) push('CALIFICACION', calificacion ?? null)
      if (dto.calificacionMinima !== undefined) push('CALIFICACIONMINIMA', minimo ?? null)
      push('APROBADO', this.calcularAprobado(calificacion, minimo) ? 1 : 0)
    }

    if (sets.length === 0) return { message: 'Sin cambios' }

    push('USUARIOMODIFICACION', ctx.usuarioEmail)
    sets.push('FECHAMODIFICACION = SYSDATE')

    params.push(capacitacionId)
    await this.dataSource.query(
      `UPDATE EVALUADORCAPACITACION SET ${sets.join(', ')} WHERE CAPACITACIONID = :${params.length}`,
      params,
    )

    await this.controlCambios.registrarCambio(
      'EVALUADORCAPACITACION', capacitacionId, antes, dto,
      {
        usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
        evaluadorId: antes.evaluadorId, participacionId: antes.participacionId,
      },
      'Cambio de calificación o datos del curso',
    )

    return { message: 'Capacitación actualizada' }
  }

  async subirCertificadoCapacitacion(capacitacionId: number, file: MulterFile, ctx: CtxUsuario) {
    const antes = await this.getCapacitacionCruda(capacitacionId)
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('El certificado del curso debe ser PDF')
    }
    await this.dataSource.query(
      `UPDATE EVALUADORCAPACITACION
          SET ARCHIVOPDF = :1, ARCHIVOMIME = :2, ARCHIVONOMBRE = :3,
              USUARIOMODIFICACION = :4, FECHAMODIFICACION = SYSDATE
        WHERE CAPACITACIONID = :5`,
      [file.buffer, file.mimetype, file.originalname, ctx.usuarioEmail, capacitacionId],
    )
    await this.controlCambios.registrar({
      tabla: 'EVALUADORCAPACITACION', operacion: 'UPDATE', registroId: capacitacionId,
      evaluadorId: antes.evaluadorId, participacionId: antes.participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `Certificado cargado: ${file.originalname}`,
    })
    return { message: 'Certificado cargado' }
  }

  async getCertificadoCapacitacion(capacitacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ARCHIVOPDF AS "blob", TRIM(ARCHIVOMIME) AS "mime", TRIM(ARCHIVONOMBRE) AS "nombre"
         FROM EVALUADORCAPACITACION WHERE CAPACITACIONID = :1`,
      [capacitacionId],
    )
    if (!rows[0]) throw new NotFoundException('Capacitación no encontrada')
    if (!rows[0].blob) throw new NotFoundException('Esta capacitación no tiene certificado cargado')
    return {
      buffer: await this.lobToBuffer(rows[0].blob as NodeJS.ReadableStream | Buffer),
      mime: (rows[0].mime as string) || 'application/pdf',
      nombre: (rows[0].nombre as string) || `certificado_${capacitacionId}.pdf`,
    }
  }

  async eliminarCapacitacion(capacitacionId: number, ctx: CtxUsuario) {
    const antes = await this.getCapacitacionCruda(capacitacionId)
    await this.dataSource.query(
      `DELETE FROM EVALUADORCAPACITACION WHERE CAPACITACIONID = :1`, [capacitacionId],
    )
    await this.controlCambios.registrar({
      tabla: 'EVALUADORCAPACITACION', operacion: 'DELETE', registroId: capacitacionId,
      evaluadorId: antes.evaluadorId, participacionId: antes.participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorAntes: antes,
    })
    return { message: 'Capacitación eliminada' }
  }

  // proyectos evaluados

  async agregarProyecto(participacionId: number, dto: PartProyectoDto, ctx: CtxUsuario) {
    const evaluadorId = await this.evaluadorDe(participacionId)

    const nombre = dto.nombreProyecto?.trim() || null
    const razon = dto.razonSocial?.trim() || null
    // el proponente basta: PROYECTONOMBRE viene vacío en la práctica
    if (!dto.proyectoId && !dto.guardadoId && !nombre && !razon) {
      throw new BadRequestException(
        'Indique el proyecto: seleccione uno del sistema, o escriba al menos el proponente.',
      )
    }

    if (dto.proyectoId || dto.guardadoId) {
      const dup = await this.dataSource.query(
        `SELECT PARTPROYECTOID FROM EVALUADORPARTPROYECTO
          WHERE PARTICIPACIONID = :1
            AND ((:2 IS NOT NULL AND PROYECTOID = :3)
              OR (:4 IS NOT NULL AND GUARDADOID = :5))`,
        [
          participacionId,
          dto.proyectoId ?? null, dto.proyectoId ?? null,
          dto.guardadoId ?? null, dto.guardadoId ?? null,
        ],
      )
      if (dup[0]) throw new ConflictException('Ese proyecto ya está registrado en este ciclo')
    }

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORPARTPROYECTO_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)

    try {
      await this.dataSource.query(
        `INSERT INTO EVALUADORPARTPROYECTO
           (PARTPROYECTOID, PARTICIPACIONID, PROYECTOID, GUARDADOID, NIT, RAZONSOCIAL,
            NOMBREPROYECTO, PUNTAJEOTORGADO, FECHAEVALUACION, OBSERVACIONES, USUARIOCREACION)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, TO_DATE(:9,'YYYY-MM-DD'), :10, :11)`,
        [
          id, participacionId,
          dto.proyectoId ?? null,
          dto.guardadoId ?? null,
          dto.nit?.trim() || null,
          razon,
          nombre,
          dto.puntajeOtorgado ?? null,
          dto.fechaEvaluacion?.slice(0, 10) || null,
          dto.observaciones?.trim() || null,
          ctx.usuarioEmail,
        ],
      )
    } catch (e) {
      // CK_PARTPROY_REF todavía exige proyecto, guardado o nombre; la v42 la relaja
      if (String((e as Error)?.message ?? '').includes('ORA-02290')) {
        throw new BadRequestException(
          'Escriba también el nombre o código del proyecto (por ejemplo BPRO-FCE-2026). ' +
          'Con solo el proponente no se puede guardar todavía.',
        )
      }
      throw e
    }

    await this.controlCambios.registrar({
      tabla: 'EVALUADORPARTPROYECTO', operacion: 'INSERT', registroId: id,
      evaluadorId, participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorDespues: dto,
    })

    return { partProyectoId: id, message: 'Proyecto agregado' }
  }

  async eliminarProyecto(partProyectoId: number, ctx: CtxUsuario) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pp.PARTICIPACIONID AS "participacionId", pa.EVALUADORID AS "evaluadorId",
              TRIM(pp.NOMBREPROYECTO) AS "nombreProyecto", pp.PROYECTOID AS "proyectoId"
         FROM EVALUADORPARTPROYECTO pp
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = pp.PARTICIPACIONID
        WHERE pp.PARTPROYECTOID = :1`,
      [partProyectoId],
    )
    if (!rows[0]) throw new NotFoundException('Proyecto no encontrado en el ciclo')

    await this.dataSource.query(
      `DELETE FROM EVALUADORPARTPROYECTO WHERE PARTPROYECTOID = :1`, [partProyectoId],
    )
    await this.controlCambios.registrar({
      tabla: 'EVALUADORPARTPROYECTO', operacion: 'DELETE', registroId: partProyectoId,
      evaluadorId: Number(rows[0].evaluadorId),
      participacionId: Number(rows[0].participacionId),
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorAntes: rows[0],
    })
    return { message: 'Proyecto retirado del ciclo' }
  }

  // proyectos asignables, acotados a la convocatoria del ciclo; PROYECTONOMBRE viene NULL, se busca por empresa y NIT
  async buscarProyectos(q: string, limite = 15, participacionId?: number) {
    const texto = (q ?? '').trim()
    const tope = Math.min(200, Math.max(1, limite))

    let convocatoriaSepId: number | null = null
    let convocatoriaNombre: string | null = null
    if (participacionId) {
      const filas: Array<Record<string, unknown>> = await this.dataSource.query(
        `SELECT ec.CONVOCATORIASEPID AS "sepId",
                TRIM(cs.CONVOCATORIANOMBRE) AS "nombre"
           FROM EVALUADORPARTICIPACION pa
           LEFT JOIN EVALUADORCONVOCATORIA ec ON ec.CONVOCATORIAID = pa.CONVOCATORIAID
           LEFT JOIN CONVOCATORIA cs ON cs.CONVOCATORIAID = ec.CONVOCATORIASEPID
          WHERE pa.PARTICIPACIONID = :1`,
        [participacionId],
      )
      if (!filas[0]) throw new NotFoundException('Participación no encontrada')
      convocatoriaSepId = filas[0].sepId != null ? Number(filas[0].sepId) : null
      convocatoriaNombre = (filas[0].nombre as string | null) ?? null

      if (convocatoriaSepId == null) {
        return {
          convocatoria: null,
          motivo: 'Este ciclo no está atado a una convocatoria del SEP. ' +
                  'Vincúlelo primero para poder asignarle proyectos.',
          items: [],
        }
      }
    }

    // sin convocatoria que acote, buscar en todo el histórico con dos letras no sirve
    if (!convocatoriaSepId && texto.length < 3) {
      return { convocatoria: null, motivo: 'Escriba al menos 3 caracteres.', items: [] }
    }

    const like = `%${texto.toUpperCase()}%`

    // cada rama arma sus binds: la convocatoria cambia el número de parámetros
    const armar = (cols: { conv: string; nombre: string; social: string; nit: string }) => {
      const params: unknown[] = []
      const bind = (v: unknown) => { params.push(v); return `:${params.length}` }
      const cond: string[] = []
      if (convocatoriaSepId != null) cond.push(`${cols.conv} = ${bind(convocatoriaSepId)}`)
      if (texto) {
        cond.push(`(UPPER(${cols.nombre}) LIKE ${bind(like)}
                OR UPPER(${cols.social}) LIKE ${bind(like)}
                OR TRIM(${cols.nit}) LIKE ${bind(like)})`)
      }
      return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params }
    }

    const eje = armar({
      conv: 'p.CONVOCATORIAID', nombre: 'p.PROYECTONOMBRE',
      social: 'e.EMPRESARAZONSOCIAL', nit: 'e.EMPRESAIDENTIFICACION',
    })
    const form = armar({
      conv: 'g.CONVOCATORIAID', nombre: 'g.NOMBREPROYECTO',
      social: 'g.RAZONSOCIAL', nit: 'g.NIT',
    })

    // sin .catch a propósito: mejor romper visible que devolver media lista
    const [ejecutados, formulados] = await Promise.all([
      this.dataSource.query(
        `SELECT p.PROYECTOID                  AS "proyectoId",
                NULL                          AS "guardadoId",
                TRIM(e.EMPRESAIDENTIFICACION) AS "nit",
                TRIM(e.EMPRESARAZONSOCIAL)    AS "razonSocial",
                TRIM(p.PROYECTONOMBRE)        AS "nombreProyecto",
                cv.CONVOCATORIAANIO           AS "anio",
                'PROYECTO'                    AS "origen"
           FROM PROYECTO p
           LEFT JOIN EMPRESA      e  ON e.EMPRESAID = p.EMPRESAID
           LEFT JOIN CONVOCATORIA cv ON cv.CONVOCATORIAID = p.CONVOCATORIAID
          ${eje.where}
          ORDER BY e.EMPRESARAZONSOCIAL, p.PROYECTOID DESC
          FETCH FIRST ${tope} ROWS ONLY`,
        eje.params,
      ),
      this.dataSource.query(
        `SELECT NULL                   AS "proyectoId",
                g.GUARDADOID           AS "guardadoId",
                TRIM(g.NIT)            AS "nit",
                TRIM(g.RAZONSOCIAL)    AS "razonSocial",
                TRIM(g.NOMBREPROYECTO) AS "nombreProyecto",
                cv.CONVOCATORIAANIO    AS "anio",
                'FORMULADO'            AS "origen"
           FROM CONVPROYGUARDADO g
           LEFT JOIN CONVOCATORIA cv ON cv.CONVOCATORIAID = g.CONVOCATORIAID
          ${form.where}
          ORDER BY g.RAZONSOCIAL, g.GUARDADOID DESC
          FETCH FIRST ${tope} ROWS ONLY`,
        form.params,
      ),
    ])

    const items = [...ejecutados, ...formulados]
      .map((r: Record<string, unknown>) => ({
        ...r,
        proyectoId: r.proyectoId != null ? Number(r.proyectoId) : null,
        guardadoId: r.guardadoId != null ? Number(r.guardadoId) : null,
        anio: r.anio != null ? Number(r.anio) : null,
      }))
      .slice(0, tope)

    return {
      convocatoria: convocatoriaSepId != null
        ? { id: convocatoriaSepId, nombre: convocatoriaNombre }
        : null,
      motivo: items.length === 0
        ? (convocatoriaSepId != null
            ? `La convocatoria "${convocatoriaNombre}" no tiene proyectos que coincidan.`
            : 'Ningún proyecto coincide con la búsqueda.')
        : null,
      items,
    }
  }

  // grupos / mesas del ciclo

  // set, no add: reemplaza el conjunto completo de grupos del ciclo
  async definirGrupos(participacionId: number, grupos: number[], ctx: CtxUsuario) {
    const evaluadorId = await this.evaluadorDe(participacionId)

    const limpios = [...new Set((grupos ?? []).map(Number))]
      .filter(g => Number.isInteger(g) && g >= 1 && g <= 99)
      .sort((a, b) => a - b)

    const antes: Array<{ grupo: number }> = await this.dataSource.query(
      `SELECT GRUPONUMERO AS "grupo" FROM EVALUADORPARTGRUPO
        WHERE PARTICIPACIONID = :1 ORDER BY GRUPONUMERO`,
      [participacionId],
    )

    await this.dataSource.transaction(async manager => {
      await manager.query(
        `DELETE FROM EVALUADORPARTGRUPO WHERE PARTICIPACIONID = :1`, [participacionId],
      )
      for (const [i, g] of limpios.entries()) {
        const seq: Array<{ NEXTVAL: number }> = await manager.query(
          `SELECT EVALUADORPARTGRUPO_SEQ.NEXTVAL FROM dual`,
        )
        await manager.query(
          `INSERT INTO EVALUADORPARTGRUPO (PARTGRUPOID, PARTICIPACIONID, GRUPONUMERO, ESPRINCIPAL)
           VALUES (:1, :2, :3, :4)`,
          [Number(seq[0].NEXTVAL), participacionId, g, i === 0 ? 1 : 0],
        )
      }
    })

    await this.controlCambios.registrar({
      tabla: 'EVALUADORPARTGRUPO', operacion: 'UPDATE', registroId: participacionId,
      evaluadorId, participacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorAntes: antes.map(a => Number(a.grupo)),
      valorDespues: limpios,
    })

    return { grupos: limpios, message: 'Grupos actualizados' }
  }

  // helpers

  private async evaluadorDe(participacionId: number): Promise<number> {
    const rows: Array<{ evaluadorId: number }> = await this.dataSource.query(
      `SELECT EVALUADORID AS "evaluadorId" FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`,
      [participacionId],
    )
    if (!rows[0]) throw new NotFoundException('Participación no encontrada')
    return Number(rows[0].evaluadorId)
  }

  private async getAprobacionCruda(aprobacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ap.APROBACIONID          AS "aprobacionId",
              ap.PARTICIPACIONID       AS "participacionId",
              pa.EVALUADORID           AS "evaluadorId",
              TRIM(ap.APROBADORNOMBRE) AS "aprobadorNombre",
              TRIM(ap.APROBADOREMAIL)  AS "aprobadorEmail",
              TRIM(ap.APROBADORCARGO)  AS "aprobadorCargo",
              TO_CHAR(ap.FECHAAPROBACION, 'YYYY-MM-DD') AS "fechaAprobacion",
              TRIM(ap.OBSERVACIONES)   AS "observaciones"
         FROM EVALUADORAPROBACION ap
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = ap.PARTICIPACIONID
        WHERE ap.APROBACIONID = :1`,
      [aprobacionId],
    )
    if (!rows[0]) throw new NotFoundException('Aprobación no encontrada')
    return {
      ...rows[0],
      aprobacionId: Number(rows[0].aprobacionId),
      participacionId: Number(rows[0].participacionId),
      evaluadorId: Number(rows[0].evaluadorId),
    }
  }

  private async getCapacitacionCruda(capacitacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ca.CAPACITACIONID     AS "capacitacionId",
              ca.PARTICIPACIONID    AS "participacionId",
              pa.EVALUADORID        AS "evaluadorId",
              TRIM(ca.NOMBRE)       AS "nombre",
              ca.CALIFICACION       AS "calificacion",
              ca.CALIFICACIONMINIMA AS "calificacionMinima",
              ca.APROBADO           AS "aprobado"
         FROM EVALUADORCAPACITACION ca
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = ca.PARTICIPACIONID
        WHERE ca.CAPACITACIONID = :1`,
      [capacitacionId],
    )
    if (!rows[0]) throw new NotFoundException('Capacitación no encontrada')
    return {
      ...rows[0],
      capacitacionId: Number(rows[0].capacitacionId),
      participacionId: Number(rows[0].participacionId),
      evaluadorId: Number(rows[0].evaluadorId),
      calificacion: rows[0].calificacion != null ? Number(rows[0].calificacion) : null,
      calificacionMinima: rows[0].calificacionMinima != null ? Number(rows[0].calificacionMinima) : null,
      aprobado: Number(rows[0].aprobado) === 1,
    }
  }

  private async minimoCursoDeConvocatoria(participacionId: number): Promise<number | null> {
    const rows: Array<{ minimo: number | null }> = await this.dataSource.query(
      `SELECT cv.CALIFICACIONMINIMACURSO AS "minimo"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
        WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    return rows[0]?.minimo != null ? Number(rows[0].minimo) : null
  }

  // sin nota de corte no se afirma que aprobó: false, no true
  private calcularAprobado(calificacion?: number | null, minimo?: number | null): boolean {
    if (calificacion == null || minimo == null) return false
    return Number(calificacion) >= Number(minimo)
  }

  private validarEvidencia(file: MulterFile) {
    if (!file) throw new BadRequestException('Archivo requerido')
    if (file.size > MAX_EVIDENCIA_BYTES) {
      throw new BadRequestException('La evidencia supera los 8 MB')
    }
    const nombre = (file.originalname ?? '').toLowerCase()
    const extOk = EVIDENCIA_EXTENSIONES.some(ext => nombre.endsWith(ext))
    const mimeOk = EVIDENCIA_MIMES.includes(file.mimetype)
    if (!extOk && !mimeOk) {
      throw new BadRequestException(
        'La evidencia debe ser un correo (.msg / .eml) o un PDF',
      )
    }
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
