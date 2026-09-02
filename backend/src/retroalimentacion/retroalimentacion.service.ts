import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ControlCambiosService } from '../evaluadores/control-cambios.service'
import { ES_DINAMIZADOR_SQL, NOMBRE_DINAMIZADOR } from './dinamizador'
import { bindRepetido } from '../common/db/binds'
import { RetroMatrizService } from './retro-matriz.service'

// todo se ancla a PARTICIPACIONID, no a la persona: separa por año

export interface CtxUsuario {
  usuarioEmail: string
  usuarioPerfilId?: number
}

export interface RespuestaEnviada {
  asignacionId: number
  /** { numeroPregunta: calificacion } */
  escalas: Record<string, number>
  /** pregunta TEXTO_POR_PERSONA */
  comentario?: string
}

const PERFIL_ADMIN = 1
const PERFIL_COORDINADOR = 2
const PERFIL_GESTOR_EVALUADORES = 15
const PERFILES_GESTION = [PERFIL_ADMIN, PERFIL_COORDINADOR, PERFIL_GESTOR_EVALUADORES]

@Injectable()
export class RetroalimentacionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly matriz: RetroMatrizService,
    private readonly controlCambios: ControlCambiosService,
  ) {}

  // formulario

  // clona la plantilla la primera vez; el clon congela las preguntas del año
  async getFormulario(convocatoriaId: number) {
    const existente = await this.buscarFormulario(convocatoriaId)
    if (existente) return existente

    const plantilla: Array<{ id: number }> = await this.dataSource.query(
      `SELECT RETROFORMULARIOID AS "id" FROM RETROFORMULARIO
        WHERE CONVOCATORIAID IS NULL AND ACTIVO = 1
        ORDER BY VERSION DESC FETCH FIRST 1 ROWS ONLY`,
    )
    if (!plantilla[0]) {
      throw new NotFoundException(
        'No existe la plantilla base del instrumento, que es de donde se copian ' +
        'las preguntas al abrir el ciclo. Hay que reponerla en la base de datos ' +
        'con docs/migraciones/v49_replantilla_retroalimentacion.sql.',
      )
    }

    const conv: Array<{ anio: number; nombre: string }> = await this.dataSource.query(
      `SELECT ANIO AS "anio", TRIM(NOMBRE) AS "nombre"
         FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = :1`, [convocatoriaId],
    )
    if (!conv[0]) throw new NotFoundException('Convocatoria no encontrada')

    try {
      await this.clonarPlantilla(convocatoriaId, plantilla[0].id, conv[0])
    } catch (e) {
      // dos peticiones en paralelo pueden clonar a la vez: sirve el que ganó
      const delOtro = await this.buscarFormulario(convocatoriaId)
      if (!delOtro) throw e
      return delOtro
    }

    const creado = await this.buscarFormulario(convocatoriaId)
    if (!creado) throw new NotFoundException('No se pudo crear el instrumento de la convocatoria')
    return creado
  }

  private async clonarPlantilla(
    convocatoriaId: number,
    plantillaId: number,
    conv: { anio: number; nombre: string },
  ) {
    await this.dataSource.transaction(async m => {
      const seq: Array<{ NEXTVAL: number }> = await m.query(
        `SELECT RETROFORMULARIO_SEQ.NEXTVAL FROM dual`)
      const nuevoId = Number(seq[0].NEXTVAL)

      await m.query(
        // copia ESCALAETIQUETAS para que el ciclo conserve las etiquetas de su año
        `INSERT INTO RETROFORMULARIO
           (RETROFORMULARIOID, CONVOCATORIAID, NOMBRE, VERSION, ANIO, ESCALAMIN, ESCALAMAX,
            DURACIONMINUTOS, RESULTADOANONIMO, ACTIVO, ABIERTO, REGLASMATRIZ,
            ESCALAETIQUETAS, USUARIOCREACION)
         SELECT :1, :2, N'Retroalimentación ' || :3, 1, :4,
                ESCALAMIN, ESCALAMAX, DURACIONMINUTOS, RESULTADOANONIMO, 1, 0,
                REGLASMATRIZ, ESCALAETIQUETAS, 'clon-plantilla'
           FROM RETROFORMULARIO WHERE RETROFORMULARIOID = :5`,
        [nuevoId, convocatoriaId, conv.nombre, conv.anio, plantillaId],
      )

      // sin ORDER BY: Oracle rechaza SEQ.NEXTVAL en SELECT ordenado (ORA-02287)
      await m.query(
        `INSERT INTO RETROPREGUNTA
           (RETROPREGUNTAID, RETROFORMULARIOID, NUMERO, TEXTO, CRITERIOS, TIPO, PESO, REQUERIDA, ORDEN)
         SELECT RETROPREGUNTA_SEQ.NEXTVAL, :1, NUMERO, TEXTO, CRITERIOS, TIPO, PESO, REQUERIDA, ORDEN
           FROM RETROPREGUNTA WHERE RETROFORMULARIOID = :2 AND ACTIVO = 1`,
        [nuevoId, plantillaId],
      )
    })
  }

  async cambiarApertura(convocatoriaId: number, abierto: boolean, ctx: CtxUsuario) {
    const form = await this.getFormulario(convocatoriaId)

    if (abierto) {
      const pendientes: Array<{ T: number }> = await this.dataSource.query(
        `SELECT COUNT(*) AS "T" FROM RETROASIGNACION WHERE RETROFORMULARIOID = :1`,
        [form.retroFormularioId],
      )
      if (Number(pendientes[0]?.T ?? 0) === 0) {
        throw new BadRequestException(
          'No se puede abrir el instrumento sin asignaciones. Genere primero la matriz.',
        )
      }
    }

    await this.dataSource.query(
      `UPDATE RETROFORMULARIO
          SET ABIERTO = :1, ${abierto ? 'FECHAAPERTURA' : 'FECHACIERRE'} = SYSDATE,
              USUARIOMODIFICACION = :2, FECHAMODIFICACION = SYSDATE
        WHERE RETROFORMULARIOID = :3`,
      [abierto ? 1 : 0, ctx.usuarioEmail, form.retroFormularioId],
    )

    await this.controlCambios.registrar({
      tabla: 'RETROFORMULARIO', operacion: 'UPDATE', registroId: form.retroFormularioId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: abierto ? 'Instrumento abierto' : 'Instrumento cerrado',
    })

    return { message: abierto ? 'Instrumento abierto' : 'Instrumento cerrado' }
  }

  private async buscarFormulario(convocatoriaId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT f.RETROFORMULARIOID AS "retroFormularioId",
              f.CONVOCATORIAID    AS "convocatoriaId",
              TRIM(f.NOMBRE)      AS "nombre",
              f.VERSION           AS "version",
              f.ANIO              AS "anio",
              f.ESCALAMIN         AS "escalaMin",
              f.ESCALAMAX         AS "escalaMax",
              f.DURACIONMINUTOS   AS "duracionMinutos",
              f.RESULTADOANONIMO  AS "resultadoAnonimo",
              f.ABIERTO           AS "abierto",
              f.REGLASMATRIZ      AS "reglasMatriz",
              f.ESCALAETIQUETAS   AS "escalaEtiquetas"
         FROM RETROFORMULARIO f
        WHERE f.CONVOCATORIAID = :1 AND f.ACTIVO = 1`,
      [convocatoriaId],
    )
    if (!rows[0]) return null
    const f = rows[0]
    const preguntas = await this.cargarPreguntas(Number(f.retroFormularioId))
    return {
      retroFormularioId: Number(f.retroFormularioId),
      convocatoriaId: Number(f.convocatoriaId),
      nombre: f.nombre as string,
      version: Number(f.version),
      anio: f.anio != null ? Number(f.anio) : null,
      escalaMin: Number(f.escalaMin),
      escalaMax: Number(f.escalaMax),
      duracionMinutos: Number(f.duracionMinutos),
      resultadoAnonimo: Number(f.resultadoAnonimo) === 1,
      abierto: Number(f.abierto) === 1,
      reglasMatriz: f.reglasMatriz as string | null,
      // si el JSON viene corrupto devuelve null y el formulario muestra solo números
      escalaEtiquetas: this.parsearEtiquetas(f.escalaEtiquetas as string | null),
      preguntas,
    }
  }

  private parsearEtiquetas(json: string | null): Record<string, string> | null {
    if (!json?.trim()) return null
    try {
      const v = JSON.parse(json) as Record<string, string>
      return v && typeof v === 'object' ? v : null
    } catch {
      return null
    }
  }

  private async cargarPreguntas(retroFormularioId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT RETROPREGUNTAID AS "preguntaId", NUMERO AS "numero", TEXTO AS "texto",
              TRIM(CRITERIOS) AS "criterios", TRIM(TIPO) AS "tipo",
              PESO AS "peso", REQUERIDA AS "requerida"
         FROM RETROPREGUNTA
        WHERE RETROFORMULARIOID = :1 AND ACTIVO = 1
        ORDER BY ORDEN, NUMERO`,
      [retroFormularioId],
    )
    return rows.map(r => ({
      preguntaId: Number(r.preguntaId),
      numero: Number(r.numero),
      texto: r.texto as string,
      criterios: r.criterios as string | null,
      tipo: r.tipo as 'ESCALA' | 'TEXTO_POR_PERSONA' | 'TEXTO_GENERAL',
      peso: Number(r.peso),
      requerida: Number(r.requerida) === 1,
    }))
  }

  // matriz de asignaciones

  // mismo calculo que generarMatriz, pero sin escribir
  async previewMatriz(convocatoriaId: number) {
    const form = await this.getFormulario(convocatoriaId)
    const resultado = await this.matriz.calcular(convocatoriaId, form.reglasMatriz)
    // Solo las de la matriz: las del dinamizador GGPC comparten formulario con el
    // ciclo pero su autor está fuera de la convocatoria, y avance() no las cuenta
    // (filtra los participantes por convocatoria). Sin este AND, la misma pantalla
    // decía "Ya hay 21 asignaciones guardadas" al lado del KPI "Asignaciones 12".
    const yaExisten: Array<{ T: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "T" FROM RETROASIGNACION a
        WHERE a.RETROFORMULARIOID = :1
          AND EXISTS (SELECT 1 FROM EVALUADORPARTICIPACION pav
                       WHERE pav.PARTICIPACIONID = a.PARTEVALUADORID
                         AND pav.CONVOCATORIAID = :2)`,
      [form.retroFormularioId, convocatoriaId],
    )

    // el alcance de los transversales puede venir forzado por las reglas del ciclo
    const nodos = await this.matriz.cargarNodos(convocatoriaId)
    const reglas = this.matriz.resolverReglas(form.reglasMatriz)
    const transversales = nodos
      .filter(n => n.esTransversal)
      .map(n => {
        const efectivo = this.matriz.alcanceDe(n, reglas)
        return {
          participacionId: n.participacionId,
          nombre: n.nombre,
          area: n.area,
          alcanceRegistrado: n.alcance,
          alcanceEfectivo: efectivo,
          forzado: JSON.stringify(efectivo) !== JSON.stringify(n.alcance),
        }
      })

    return {
      ...resultado.stats,
      pares: resultado.pares,
      transversales,
      asignacionesExistentes: Number(yaExisten[0]?.T ?? 0),
      formulario: { retroFormularioId: form.retroFormularioId, nombre: form.nombre, abierto: form.abierto },
    }
  }

  // regenerar es seguro: los duplicados se saltan y no se toca lo ya diligenciado
  async generarMatriz(convocatoriaId: number, ctx: CtxUsuario) {
    const form = await this.getFormulario(convocatoriaId)
    const { pares, stats } = await this.matriz.calcular(convocatoriaId, form.reglasMatriz)

    if (pares.length === 0) {
      throw new BadRequestException(
        'No se generó ningún par. Verifique que las participaciones del ciclo tengan rol, área y grupos.',
      )
    }

    const existentes: Array<{ clave: string }> = await this.dataSource.query(
      `SELECT PARTEVALUADORID || '::' || PARTEVALUADOID AS "clave"
         FROM RETROASIGNACION WHERE RETROFORMULARIOID = :1`,
      [form.retroFormularioId],
    )
    const yaHay = new Set(existentes.map(e => e.clave))
    const nuevos = pares.filter(
      p => !yaHay.has(`${p.evaluadorParticipacionId}::${p.evaluadoParticipacionId}`),
    )

    if (nuevos.length > 0) {
      await this.dataSource.transaction(async m => {
        for (const p of nuevos) {
          const seq: Array<{ NEXTVAL: number }> = await m.query(
            `SELECT RETROASIGNACION_SEQ.NEXTVAL FROM dual`)
          await m.query(
            `INSERT INTO RETROASIGNACION
               (RETROASIGNACIONID, RETROFORMULARIOID, PARTEVALUADORID, PARTEVALUADOID,
                ESTADO, ORIGEN, MOTIVOREGLA, USUARIOCREACION)
             VALUES (:1, :2, :3, :4, N'PENDIENTE', N'AUTOMATICA', :5, :6)`,
            [
              Number(seq[0].NEXTVAL), form.retroFormularioId,
              p.evaluadorParticipacionId, p.evaluadoParticipacionId,
              p.motivo.slice(0, 200), ctx.usuarioEmail,
            ],
          )
        }
      })
    }

    await this.controlCambios.registrar({
      tabla: 'RETROASIGNACION', operacion: 'GENERAR', registroId: form.retroFormularioId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `${nuevos.length} pares nuevos de ${pares.length} calculados`,
      valorDespues: { porRegla: stats.porRegla, sinEvaluar: stats.sinEvaluar.length },
    })

    return {
      creados: nuevos.length,
      omitidosPorExistir: pares.length - nuevos.length,
      ...stats,
    }
  }

  async agregarAsignacion(
    convocatoriaId: number,
    dto: { evaluadorParticipacionId: number; evaluadoParticipacionId: number },
    ctx: CtxUsuario,
  ) {
    const form = await this.getFormulario(convocatoriaId)
    if (dto.evaluadorParticipacionId === dto.evaluadoParticipacionId) {
      throw new BadRequestException('Nadie se retroalimenta a sí mismo')
    }

    const dup: Array<{ id: number }> = await this.dataSource.query(
      `SELECT RETROASIGNACIONID AS "id" FROM RETROASIGNACION
        WHERE RETROFORMULARIOID = :1 AND PARTEVALUADORID = :2 AND PARTEVALUADOID = :3`,
      [form.retroFormularioId, dto.evaluadorParticipacionId, dto.evaluadoParticipacionId],
    )
    if (dup[0]) throw new ConflictException('Ese par ya está asignado')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT RETROASIGNACION_SEQ.NEXTVAL FROM dual`)
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO RETROASIGNACION
         (RETROASIGNACIONID, RETROFORMULARIOID, PARTEVALUADORID, PARTEVALUADOID,
          ESTADO, ORIGEN, MOTIVOREGLA, USUARIOCREACION)
       VALUES (:1, :2, :3, :4, N'PENDIENTE', N'MANUAL', N'agregado a mano', :5)`,
      [id, form.retroFormularioId, dto.evaluadorParticipacionId, dto.evaluadoParticipacionId, ctx.usuarioEmail],
    )

    await this.controlCambios.registrar({
      tabla: 'RETROASIGNACION', operacion: 'INSERT', registroId: id,
      participacionId: dto.evaluadorParticipacionId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      valorDespues: dto,
    })
    return { retroAsignacionId: id, message: 'Asignación agregada' }
  }

  // no borra: si ya fue diligenciada, anularla dejaria la respuesta huerfana
  async anularAsignacion(asignacionId: number, motivo: string, ctx: CtxUsuario) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ESTADO AS "estado", PARTEVALUADORID AS "evaluador", PARTEVALUADOID AS "evaluado"
         FROM RETROASIGNACION WHERE RETROASIGNACIONID = :1`, [asignacionId],
    )
    if (!rows[0]) throw new NotFoundException('Asignación no encontrada')
    if ((rows[0].estado as string)?.trim() === 'ENVIADA') {
      throw new ConflictException(
        'Esa asignación ya fue diligenciada. Anularla dejaría la respuesta sin par asociado.',
      )
    }

    await this.dataSource.query(
      `UPDATE RETROASIGNACION SET ESTADO = N'ANULADA', MOTIVOREGLA = :1
        WHERE RETROASIGNACIONID = :2`,
      [(motivo ?? 'anulada').slice(0, 200), asignacionId],
    )
    await this.controlCambios.registrar({
      tabla: 'RETROASIGNACION', operacion: 'ANULAR', registroId: asignacionId,
      participacionId: Number(rows[0].evaluador),
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: motivo,
    })
    return { message: 'Asignación anulada' }
  }

  // lado del evaluador

  // no pasa por USUARIO a proposito: el correo de la cuenta puede no ser el de PERSONA
  async miCiclo(email: string) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID   AS "participacionId",
              pa.ANIO              AS "anio",
              pa.CONVOCATORIAID    AS "convocatoriaId",
              TRIM(cv.NOMBRE)      AS "convocatoriaNombre",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rolNombre",
              TRIM(ar.NOMBRE)      AS "areaNombre",
              f.RETROFORMULARIOID  AS "retroFormularioId",
              f.DURACIONMINUTOS    AS "duracionMinutos",
              TRIM(p.PERSONANOMBRES) AS "nombres"
         FROM PERSONA p
         JOIN EVALUADOR e ON e.PERSONAID = p.PERSONAID
         JOIN EVALUADORPARTICIPACION pa ON pa.EVALUADORID = e.EVALUADORID
         JOIN RETROFORMULARIO f ON f.CONVOCATORIAID = pa.CONVOCATORIAID
                               AND f.ACTIVO = 1 AND f.ABIERTO = 1
         LEFT JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
         LEFT JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar ON ar.AREAID = pa.AREAID
        WHERE LOWER(TRIM(p.PERSONAEMAIL)) = :1
           OR LOWER(TRIM(p.PERSONAEMAILINSTITUCIONAL)) = :2
        ORDER BY pa.ANIO DESC
        FETCH FIRST 1 ROWS ONLY`,
      [email.trim().toLowerCase(), email.trim().toLowerCase()],
    )
    if (!rows[0]) return null
    const r = rows[0]
    return {
      participacionId: Number(r.participacionId),
      anio: Number(r.anio),
      convocatoriaId: Number(r.convocatoriaId),
      convocatoriaNombre: r.convocatoriaNombre as string | null,
      rolNombre: r.rolNombre as string | null,
      areaNombre: r.areaNombre as string | null,
      retroFormularioId: Number(r.retroFormularioId),
      duracionMinutos: Number(r.duracionMinutos),
      nombres: (r.nombres as string ?? '').trim(),
    }
  }

  async misAsignaciones(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT a.RETROASIGNACIONID AS "asignacionId",
              a.ESTADO            AS "estado",
              a.PARTEVALUADOID    AS "evaluadoParticipacionId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rolNombre",
              TRIM(r.ROLEVALUADORCODIGO) AS "rolCodigo",
              NVL(r.ROLEVALUADORORDEN, 99) AS "rolOrden",
              TRIM(ar.NOMBRE)     AS "areaNombre"
         FROM RETROASIGNACION a
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = a.PARTEVALUADOID
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar ON ar.AREAID = pa.AREAID
        WHERE a.PARTEVALUADORID = :1
          AND a.ESTADO <> N'ANULADA'
        ORDER BY NVL(r.ROLEVALUADORORDEN, 99), p.PERSONAPRIMERAPELLIDO`,
      [participacionId],
    )

    const items = rows.map(r => ({
      asignacionId: Number(r.asignacionId),
      estado: (r.estado as string ?? '').trim(),
      evaluadoParticipacionId: Number(r.evaluadoParticipacionId),
      nombre: (r.nombre as string ?? '').trim(),
      rolNombre: r.rolNombre as string | null,
      rolCodigo: r.rolCodigo as string | null,
      areaNombre: r.areaNombre as string | null,
    }))

    // agrupado por rol: el formulario se llena por bloques
    const grupos = new Map<string, typeof items>()
    for (const it of items) {
      const clave = it.rolNombre ?? 'Sin rol'
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave)!.push(it)
    }

    return {
      total: items.length,
      pendientes: items.filter(i => i.estado === 'PENDIENTE').length,
      enviadas: items.filter(i => i.estado === 'ENVIADA').length,
      grupos: [...grupos.entries()].map(([rol, personas]) => ({ rol, personas })),
    }
  }

  // sesion de diligenciamiento

  async iniciarSesion(participacionId: number, ctx: CtxUsuario & { ip?: string }) {
    const pendientes: Array<{ T: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "T" FROM RETROASIGNACION
        WHERE PARTEVALUADORID = :1 AND ESTADO = N'PENDIENTE'`,
      [participacionId],
    )
    if (Number(pendientes[0]?.T ?? 0) === 0) {
      throw new BadRequestException('No tienes asignaciones pendientes por retroalimentar.')
    }

    const form: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT f.RETROFORMULARIOID AS "id", f.DURACIONMINUTOS AS "duracion", f.ABIERTO AS "abierto"
         FROM RETROFORMULARIO f
         JOIN EVALUADORPARTICIPACION pa ON pa.CONVOCATORIAID = f.CONVOCATORIAID
        WHERE pa.PARTICIPACIONID = :1 AND f.ACTIVO = 1`,
      [participacionId],
    )
    if (!form[0]) throw new NotFoundException('El ciclo no tiene instrumento activo')
    if (Number(form[0].abierto) !== 1) {
      throw new ForbiddenException('El instrumento de este ciclo está cerrado')
    }

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT RETROSESION_SEQ.NEXTVAL FROM dual`)
    const id = Number(seq[0].NEXTVAL)

    await this.dataSource.query(
      `INSERT INTO RETROSESION
         (RETROSESIONID, RETROFORMULARIOID, PARTICIPACIONID, FECHAINICIO,
          DURACIONMINUTOS, IPORIGEN, USUARIOEMAIL)
       VALUES (:1, :2, :3, SYSDATE, :4, :5, :6)`,
      [id, Number(form[0].id), participacionId, Number(form[0].duracion), ctx.ip ?? null, ctx.usuarioEmail],
    )

    return {
      retroSesionId: id,
      duracionMinutos: Number(form[0].duracion),
      fechaInicio: new Date().toISOString(),
    }
  }

  async getSesion(sesionId: number, participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT RETROSESIONID AS "retroSesionId", PARTICIPACIONID AS "participacionId",
              FECHAINICIO AS "fechaInicio", FECHAENVIO AS "fechaEnvio",
              DURACIONMINUTOS AS "duracionMinutos", MINUTOSTRANSCURRIDOS AS "minutosTranscurridos",
              SEEXCEDIO AS "seExcedio"
         FROM RETROSESION WHERE RETROSESIONID = :1`,
      [sesionId],
    )
    if (!rows[0]) throw new NotFoundException('Sesión no encontrada')
    if (Number(rows[0].participacionId) !== participacionId) {
      throw new ForbiddenException('Esa sesión no es tuya')
    }
    return {
      ...rows[0],
      retroSesionId: Number(rows[0].retroSesionId),
      participacionId: Number(rows[0].participacionId),
      duracionMinutos: Number(rows[0].duracionMinutos),
      seExcedio: Number(rows[0].seExcedio) === 1,
      enviada: rows[0].fechaEnvio != null,
    }
  }

  // sin ctx: el envio no se audita, quien diligencio ya queda en RETROSESION.USUARIOEMAIL
  async enviarSesion(
    sesionId: number,
    participacionId: number,
    body: { respuestas: RespuestaEnviada[]; sugerenciaGeneral?: string },
  ) {
    const sesion = await this.getSesion(sesionId, participacionId)
    if (sesion.enviada) throw new ConflictException('Esta sesión ya fue enviada')

    const respuestas = Array.isArray(body?.respuestas) ? body.respuestas : []
    if (respuestas.length === 0) throw new BadRequestException('No enviaste ninguna respuesta')

    const form = await this.formularioDeSesion(sesionId)
    const escalas = form.preguntas.filter(p => p.tipo === 'ESCALA')
    const porPersona = form.preguntas.find(p => p.tipo === 'TEXTO_POR_PERSONA')
    const general = form.preguntas.find(p => p.tipo === 'TEXTO_GENERAL')

    const ids = respuestas.map(r => Number(r.asignacionId))
    const q = bindRepetido(
      `SELECT a.RETROASIGNACIONID AS "id", a.PARTEVALUADOID AS "evaluado",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre"
         FROM RETROASIGNACION a
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = a.PARTEVALUADOID
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
        WHERE a.PARTEVALUADORID = :pid AND a.ESTADO = N'PENDIENTE'`,
      'pid', participacionId,
    )
    const validas: Array<Record<string, unknown>> = await this.dataSource.query(q.sql, q.params)
    const porId = new Map(validas.map(v => [Number(v.id), v]))

    const faltantes = ids.filter(id => !porId.has(id))
    if (faltantes.length > 0) {
      throw new BadRequestException(
        `${faltantes.length} de ${ids.length} asignaciones no son tuyas o ya fueron enviadas.`,
      )
    }

    for (const r of respuestas) {
      const nombre = (porId.get(Number(r.asignacionId))?.nombre as string ?? '').trim()
      for (const preg of escalas) {
        if (!preg.requerida) continue
        const val = Number(r.escalas?.[String(preg.numero)])
        if (!Number.isInteger(val) || val < form.escalaMin || val > form.escalaMax) {
          throw new BadRequestException(
            `Falta la pregunta ${preg.numero} para ${nombre || 'uno de los evaluados'} ` +
            `(debe ser un número entre ${form.escalaMin} y ${form.escalaMax}).`,
          )
        }
      }
    }

    const minutos = await this.minutosDesdeInicio(sesionId)
    const seExcedio = minutos > sesion.duracionMinutos

    await this.dataSource.transaction(async m => {
      for (const r of respuestas) {
        const asignacionId = Number(r.asignacionId)
        const evaluadoId = Number(porId.get(asignacionId)!.evaluado)

        let suma = 0
        let contadas = 0
        let maximo = 0
        for (const preg of escalas) {
          const val = Number(r.escalas?.[String(preg.numero)])
          maximo += form.escalaMax
          if (Number.isFinite(val)) { suma += val; contadas++ }
        }
        const promedio = contadas > 0 ? Math.round((suma / contadas) * 100) / 100 : null

        const seqR: Array<{ NEXTVAL: number }> = await m.query(
          `SELECT RETRORESPUESTA_SEQ.NEXTVAL FROM dual`)
        const respuestaId = Number(seqR[0].NEXTVAL)

        await m.query(
          `INSERT INTO RETRORESPUESTA
             (RETRORESPUESTAID, RETROSESIONID, RETROASIGNACIONID, RETROFORMULARIOID,
              PARTEVALUADORID, PARTEVALUADOID, PUNTAJEESCALA, PUNTAJEMAXIMO, PROMEDIO, FECHAENVIO)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE)`,
          [respuestaId, sesionId, asignacionId, form.retroFormularioId,
           participacionId, evaluadoId, suma, maximo, promedio],
        )

        for (const preg of escalas) {
          const val = Number(r.escalas?.[String(preg.numero)])
          if (!Number.isFinite(val)) continue
          const seqI: Array<{ NEXTVAL: number }> = await m.query(
            `SELECT RETRORESPUESTAITEM_SEQ.NEXTVAL FROM dual`)
          await m.query(
            `INSERT INTO RETRORESPUESTAITEM
               (RETROITEMID, RETRORESPUESTAID, RETROPREGUNTAID, PREGUNTANUMERO, CALIFICACION)
             VALUES (:1, :2, :3, :4, :5)`,
            [Number(seqI[0].NEXTVAL), respuestaId, preg.preguntaId, preg.numero, val],
          )
        }

        const comentario = (r.comentario ?? '').trim()
        if (comentario && porPersona) {
          const seqI: Array<{ NEXTVAL: number }> = await m.query(
            `SELECT RETRORESPUESTAITEM_SEQ.NEXTVAL FROM dual`)
          await m.query(
            `INSERT INTO RETRORESPUESTAITEM
               (RETROITEMID, RETRORESPUESTAID, RETROPREGUNTAID, PREGUNTANUMERO, COMENTARIO)
             VALUES (:1, :2, :3, :4, :5)`,
            [Number(seqI[0].NEXTVAL), respuestaId, porPersona.preguntaId, porPersona.numero, comentario],
          )
        }

        await m.query(
          `UPDATE RETROASIGNACION SET ESTADO = N'ENVIADA', RETRORESPUESTAID = :1
            WHERE RETROASIGNACIONID = :2`,
          [respuestaId, asignacionId],
        )
      }

      const sugerencia = (body.sugerenciaGeneral ?? '').trim()
      if (sugerencia && general) {
        const seqS: Array<{ NEXTVAL: number }> = await m.query(
          `SELECT RETROSUGERENCIA_SEQ.NEXTVAL FROM dual`)
        await m.query(
          `INSERT INTO RETROSUGERENCIA
             (RETROSUGERENCIAID, RETROSESIONID, RETROPREGUNTAID, PARTICIPACIONID, TEXTO)
           VALUES (:1, :2, :3, :4, :5)`,
          [Number(seqS[0].NEXTVAL), sesionId, general.preguntaId, participacionId, sugerencia],
        )
      }

      await m.query(
        `UPDATE RETROSESION
            SET FECHAENVIO = SYSDATE, MINUTOSTRANSCURRIDOS = :1, SEEXCEDIO = :2
          WHERE RETROSESIONID = :3`,
        [minutos, seExcedio ? 1 : 0, sesionId],
      )
    })

    return {
      enviadas: respuestas.length,
      minutosTranscurridos: minutos,
      seExcedio,
      message: `Se enviaron ${respuestas.length} retroalimentaciones. Gracias.`,
    }
  }

  private async minutosDesdeInicio(sesionId: number): Promise<number> {
    // se calcula en BD para no depender del reloj ni la zona horaria de Node
    const rows: Array<{ minutos: number }> = await this.dataSource.query(
      `SELECT ROUND((SYSDATE - FECHAINICIO) * 24 * 60) AS "minutos"
         FROM RETROSESION WHERE RETROSESIONID = :1`, [sesionId],
    )
    return Math.max(0, Number(rows[0]?.minutos ?? 0))
  }

  private async formularioDeSesion(sesionId: number) {
    const rows: Array<{ convocatoriaId: number }> = await this.dataSource.query(
      `SELECT f.CONVOCATORIAID AS "convocatoriaId"
         FROM RETROSESION s JOIN RETROFORMULARIO f ON f.RETROFORMULARIOID = s.RETROFORMULARIOID
        WHERE s.RETROSESIONID = :1`, [sesionId],
    )
    if (!rows[0]) throw new NotFoundException('Sesión sin instrumento asociado')
    return this.getFormulario(Number(rows[0].convocatoriaId))
  }

  // resultados

  // el anonimato es solo de presentacion: la fila siempre guarda quien califico
  async resultados(participacionId: number, perfilId: number, usuarioEmail: string) {
    const meta: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT f.RETROFORMULARIOID AS "formularioId", f.RESULTADOANONIMO AS "anonimo",
              f.ESCALAMAX AS "escalaMax", pa.ANIO AS "anio", pa.EVALUADORID AS "evaluadorId"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN RETROFORMULARIO f ON f.CONVOCATORIAID = pa.CONVOCATORIAID AND f.ACTIVO = 1
        WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    if (!meta[0]) throw new NotFoundException('Participación no encontrada')

    const anonimo = Number(meta[0].anonimo ?? 1) === 1
    const puedeVerNombres = PERFILES_GESTION.includes(perfilId)
    const revelar = !anonimo || puedeVerNombres

    const porCriterio: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT i.PREGUNTANUMERO AS "numero",
              MAX(q.TEXTO)     AS "texto",
              MAX(TRIM(q.CRITERIOS)) AS "criterios",
              ROUND(AVG(i.CALIFICACION), 2) AS "promedio",
              COUNT(*)         AS "respuestas"
         FROM RETRORESPUESTAITEM i
         JOIN RETRORESPUESTA r ON r.RETRORESPUESTAID = i.RETRORESPUESTAID
         JOIN RETROPREGUNTA  q ON q.RETROPREGUNTAID  = i.RETROPREGUNTAID
        WHERE r.PARTEVALUADOID = :1 AND i.CALIFICACION IS NOT NULL
        GROUP BY i.PREGUNTANUMERO
        ORDER BY i.PREGUNTANUMERO`,
      [participacionId],
    )

    const calificadores: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT r.RETRORESPUESTAID AS "respuestaId",
              r.PROMEDIO         AS "promedio",
              r.FECHAENVIO       AS "fecha",
              TRIM(rol.ROLEVALUADORNOMBRE) AS "rolCalificador",
              TRIM(ar.NOMBRE)    AS "areaCalificador",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombreCalificador",
              ${ES_DINAMIZADOR_SQL('p.PERSONAIDENTIFICACION')} AS "esDinamizador",
              (SELECT i2.COMENTARIO FROM RETRORESPUESTAITEM i2
                WHERE i2.RETRORESPUESTAID = r.RETRORESPUESTAID
                  AND i2.COMENTARIO IS NOT NULL AND ROWNUM = 1) AS "comentario"
         FROM RETRORESPUESTA r
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = r.PARTEVALUADORID
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN ROLEVALUADOR   rol ON rol.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar  ON ar.AREAID = pa.AREAID
        WHERE r.PARTEVALUADOID = :1
        ORDER BY r.FECHAENVIO`,
      [participacionId],
    )

    if (revelar && anonimo && calificadores.length > 0) {
      await this.controlCambios.registrar({
        tabla: 'RETRORESPUESTA', operacion: 'UPDATE', registroId: participacionId,
        participacionId, evaluadorId: Number(meta[0].evaluadorId),
        usuarioEmail, usuarioPerfilId: perfilId,
        comentario: 'Consultó la identidad de los calificadores de una retroalimentación anónima',
      })
    }

    const items = calificadores.map(c => ({
      respuestaId: Number(c.respuestaId),
      promedio: c.promedio != null ? Number(c.promedio) : null,
      fecha: c.fecha,
      // el dinamizador GGPC no es un par ni tiene rol ni área: sin esta rama
      // aparecería como "Par evaluador", que es justo lo que no es
      origen: Number(c.esDinamizador) === 1
        ? NOMBRE_DINAMIZADOR
        : [c.rolCalificador, c.areaCalificador].filter(Boolean).join(' · ') || 'Par evaluador',
      // se nombra por el cargo, nunca por la persona: eso no rompe el anonimato
      nombre: Number(c.esDinamizador) === 1
        ? NOMBRE_DINAMIZADOR
        : revelar ? (c.nombreCalificador as string ?? '').trim() : null,
      comentario: c.comentario as string | null,
    }))

    const conPromedio = items.filter(i => i.promedio != null)
    const global = conPromedio.length
      ? Math.round((conPromedio.reduce((s, i) => s + (i.promedio ?? 0), 0) / conPromedio.length) * 100) / 100
      : null

    return {
      participacionId,
      anio: Number(meta[0].anio),
      escalaMax: meta[0].escalaMax != null ? Number(meta[0].escalaMax) : 5,
      anonimo,
      nombresVisibles: revelar,
      promedioGlobal: global,
      totalRecibidas: items.length,
      porCriterio: porCriterio.map(c => ({
        numero: Number(c.numero),
        texto: c.texto as string,
        criterios: c.criterios as string | null,
        promedio: c.promedio != null ? Number(c.promedio) : null,
        respuestas: Number(c.respuestas),
      })),
      calificadores: items,
    }
  }

  async avance(convocatoriaId: number) {
    const form = await this.getFormulario(convocatoriaId)
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "participacionId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre",
              TRIM(p.PERSONAEMAIL) AS "email",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rolNombre",
              TRIM(ar.NOMBRE)     AS "areaNombre",
              (SELECT COUNT(*) FROM RETROASIGNACION a
                WHERE a.PARTEVALUADORID = pa.PARTICIPACIONID AND a.ESTADO <> N'ANULADA') AS "asignadas",
              (SELECT COUNT(*) FROM RETROASIGNACION a
                WHERE a.PARTEVALUADORID = pa.PARTICIPACIONID AND a.ESTADO = N'ENVIADA') AS "enviadas",
              -- Solo lo del ciclo: este tablero sigue la matriz, y "Enviadas"
              -- (que cuenta por autor dentro de la convocatoria) tiene que poder
              -- compararse con "Recibidas" en la misma fila. Con el dinamizador
              -- dentro, una columna decía 12 y la de al lado 21. Su nota sí entra
              -- al promedio de la persona, pero eso se ve en su ficha, no aquí.
              (SELECT COUNT(*) FROM RETRORESPUESTA rr
                 JOIN EVALUADORPARTICIPACION pav ON pav.PARTICIPACIONID = rr.PARTEVALUADORID
                WHERE rr.PARTEVALUADOID = pa.PARTICIPACIONID
                  AND pav.CONVOCATORIAID = pa.CONVOCATORIAID) AS "recibidas",
              (SELECT ROUND(AVG(rr.PROMEDIO), 2) FROM RETRORESPUESTA rr
                 JOIN EVALUADORPARTICIPACION pav ON pav.PARTICIPACIONID = rr.PARTEVALUADORID
                WHERE rr.PARTEVALUADOID = pa.PARTICIPACIONID
                  AND pav.CONVOCATORIAID = pa.CONVOCATORIAID) AS "promedioRecibido",
              (SELECT MAX(s.MINUTOSTRANSCURRIDOS) FROM RETROSESION s
                WHERE s.PARTICIPACIONID = pa.PARTICIPACIONID) AS "minutos",
              (SELECT MAX(CASE WHEN s.SEEXCEDIO = 1 THEN 1 ELSE 0 END) FROM RETROSESION s
                WHERE s.PARTICIPACIONID = pa.PARTICIPACIONID) AS "seExcedio"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar ON ar.AREAID = pa.AREAID
        WHERE pa.CONVOCATORIAID = :1
        ORDER BY NVL(r.ROLEVALUADORORDEN, 99), p.PERSONAPRIMERAPELLIDO`,
      [convocatoriaId],
    )

    const items = rows.map(r => ({
      participacionId: Number(r.participacionId),
      nombre: (r.nombre as string ?? '').trim(),
      email: r.email as string | null,
      rolNombre: r.rolNombre as string | null,
      areaNombre: r.areaNombre as string | null,
      asignadas: Number(r.asignadas),
      enviadas: Number(r.enviadas),
      recibidas: Number(r.recibidas),
      promedioRecibido: r.promedioRecibido != null ? Number(r.promedioRecibido) : null,
      minutos: r.minutos != null ? Number(r.minutos) : null,
      seExcedio: Number(r.seExcedio ?? 0) === 1,
      completo: Number(r.asignadas) > 0 && Number(r.enviadas) === Number(r.asignadas),
    }))

    return {
      convocatoriaId,
      formulario: {
        retroFormularioId: form.retroFormularioId,
        nombre: form.nombre,
        abierto: form.abierto,
        anonimo: form.resultadoAnonimo,
      },
      totales: {
        participantes: items.length,
        completos: items.filter(i => i.completo).length,
        sinAsignaciones: items.filter(i => i.asignadas === 0).length,
        asignaciones: items.reduce((s, i) => s + i.asignadas, 0),
        enviadas: items.reduce((s, i) => s + i.enviadas, 0),
      },
      items,
    }
  }

  async sugerencias(convocatoriaId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT s.RETROSUGERENCIAID AS "sugerenciaId",
              s.TEXTO             AS "texto",
              s.FECHAENVIO        AS "fecha",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rolNombre",
              TRIM(ar.NOMBRE)     AS "areaNombre"
         FROM RETROSUGERENCIA s
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = s.PARTICIPACIONID
         LEFT JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar ON ar.AREAID = pa.AREAID
        WHERE pa.CONVOCATORIAID = :1
        ORDER BY s.FECHAENVIO DESC`,
      [convocatoriaId],
    )
    // sin nombre a proposito: la sugerencia es sobre el proceso, no sobre una persona
    return rows.map(r => ({
      sugerenciaId: Number(r.sugerenciaId),
      texto: r.texto as string,
      fecha: r.fecha,
      origen: [r.rolNombre, r.areaNombre].filter(Boolean).join(' · ') || 'Participante',
    }))
  }
}
