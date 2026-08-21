import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ControlCambiosService } from '../evaluadores/control-cambios.service'

export interface CtxUsuario {
  usuarioEmail: string
  usuarioPerfilId: number
}

export interface RetroHistoricaDto {
  // participación de quien calificó
  evaluadorParticipacionId: number
  // participación de quien fue calificado
  evaluadoParticipacionId: number
  // { '1': 5, '2': 4, ... } solo las preguntas de escala
  escalas: Record<string, number>
  // { '6': 'SÍ', '7': 'Presencial' } las de texto, tal como vienen de la hoja
  textos?: Record<string, string>
}

const ANIO_EN_LINEA = 2026
// ORIGEN solo acepta AUTOMATICA o MANUAL, asi que el histórico se marca en el motivo
const MOTIVO_HISTORICO = 'HISTORICO - transcrita de las hojas del año'
// los tres que acepta CK_RETROPREG_TIPO
const TIPOS_PREGUNTA = ['ESCALA', 'TEXTO_POR_PERSONA', 'TEXTO_GENERAL']
// RETROPREGUNTA.TEXTO es NVARCHAR2(2000) bytes, o sea 1000 caracteres
const MAX_TEXTO_PREGUNTA = 1000

// carga a mano de las retroalimentaciones de años anteriores, desde las hojas del GGPC
@Injectable()
export class RetroHistoricoService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly controlCambios: ControlCambiosService,
  ) {}

  // el instrumento y la escala salen de la convocatoria de quien fue calificado
  private async contexto(participacionId: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT f.RETROFORMULARIOID AS "formularioId",
              f.ESCALAMIN         AS "escalaMin",
              f.ESCALAMAX         AS "escalaMax",
              f.DURACIONMINUTOS   AS "duracion",
              pa.ANIO             AS "anio",
              pa.CONVOCATORIAID   AS "convocatoriaId",
              pa.EVALUADORID      AS "evaluadorId"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN RETROFORMULARIO f
                ON f.CONVOCATORIAID = pa.CONVOCATORIAID AND f.ACTIVO = 1
        WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    const f = filas[0]
    if (!f) throw new NotFoundException('Esa participación no existe')
    if (f.formularioId == null) {
      throw new BadRequestException(
        'Ese ciclo no tiene instrumento de retroalimentación activo. Revísalo en la convocatoria antes de cargar.',
      )
    }
    return {
      formularioId: Number(f.formularioId),
      escalaMin: Number(f.escalaMin ?? 1),
      escalaMax: Number(f.escalaMax ?? 5),
      duracion: Number(f.duracion ?? 0),
      anio: Number(f.anio),
      convocatoriaId: Number(f.convocatoriaId),
      evaluadorId: Number(f.evaluadorId),
    }
  }

  private async preguntas(formularioId: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT RETROPREGUNTAID AS "preguntaId", NUMERO AS "numero", TEXTO AS "texto",
              TIPO AS "tipo", REQUERIDA AS "requerida"
         FROM RETROPREGUNTA
        WHERE RETROFORMULARIOID = :1 AND ACTIVO = 1
        ORDER BY NUMERO`,
      [formularioId],
    )
    return filas.map(p => ({
      preguntaId: Number(p.preguntaId),
      numero: Number(p.numero),
      texto: String(p.texto ?? '').trim(),
      tipo: String(p.tipo ?? '').trim(),
      requerida: Number(p.requerida ?? 0) === 1,
    }))
  }

  // lo que la pantalla de cargue necesita pintar para un año
  async instrumento(participacionId: number) {
    const ctx = await this.contexto(participacionId)
    if (ctx.anio >= ANIO_EN_LINEA) {
      throw new BadRequestException(
        `${ctx.anio} se diligencia en el sistema: esta pantalla es solo para los años anteriores.`,
      )
    }
    const preguntas = await this.preguntas(ctx.formularioId)
    return {
      anio: ctx.anio,
      convocatoriaId: ctx.convocatoriaId,
      convocatoria: await this.nombreConvocatoria(ctx.convocatoriaId),
      escalaMin: ctx.escalaMin,
      escalaMax: ctx.escalaMax,
      preguntas,
      // sin preguntas no se puede cargar nada: primero hay que registrar la hoja del año
      faltaRegistrarPreguntas: preguntas.length === 0,
      modelos: preguntas.length === 0 ? await this.modelos(ctx.convocatoriaId) : [],
    }
  }

  private async nombreConvocatoria(convocatoriaId: number) {
    const f: Array<{ nombre: string }> = await this.dataSource.query(
      `SELECT TRIM(NOMBRE) AS "nombre" FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = :1`,
      [convocatoriaId],
    )
    return f[0]?.nombre ?? null
  }

  // convocatorias anteriores que ya tienen su hoja registrada, para copiarlas
  async modelos(excluirConvocatoriaId?: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT f.RETROFORMULARIOID AS "formularioId",
              f.CONVOCATORIAID   AS "convocatoriaId",
              cv.ANIO            AS "anio",
              TRIM(cv.NOMBRE)    AS "convocatoria",
              (SELECT COUNT(*) FROM RETROPREGUNTA q
                WHERE q.RETROFORMULARIOID = f.RETROFORMULARIOID AND q.ACTIVO = 1) AS "preguntas"
         FROM RETROFORMULARIO f
         JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = f.CONVOCATORIAID
        WHERE f.ACTIVO = 1 AND cv.ANIO < :1
          AND EXISTS (SELECT 1 FROM RETROPREGUNTA q
                       WHERE q.RETROFORMULARIOID = f.RETROFORMULARIOID AND q.ACTIVO = 1)
        ORDER BY cv.ANIO DESC, cv.CONVOCATORIAID`,
      [ANIO_EN_LINEA],
    )
    return filas
      .filter(f => Number(f.convocatoriaId) !== excluirConvocatoriaId)
      .map(f => ({
        convocatoriaId: Number(f.convocatoriaId),
        anio: Number(f.anio),
        convocatoria: String(f.convocatoria ?? ''),
        preguntas: Number(f.preguntas),
      }))
  }

  // las preguntas se guardan en la convocatoria, no en el año: cada hoja fue distinta
  async guardarPreguntas(
    convocatoriaId: number,
    dto: { preguntas: Array<{ texto: string; tipo: string }> },
    ctx: CtxUsuario,
  ) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT f.RETROFORMULARIOID AS "formularioId", cv.ANIO AS "anio",
              (SELECT COUNT(*) FROM RETRORESPUESTA r
                WHERE r.RETROFORMULARIOID = f.RETROFORMULARIOID) AS "respuestas"
         FROM EVALUADORCONVOCATORIA cv
         LEFT JOIN RETROFORMULARIO f
                ON f.CONVOCATORIAID = cv.CONVOCATORIAID AND f.ACTIVO = 1
        WHERE cv.CONVOCATORIAID = :1`,
      [convocatoriaId],
    )
    const f = filas[0]
    if (!f) throw new NotFoundException('Esa convocatoria no existe')
    if (f.formularioId == null) {
      throw new BadRequestException('Esa convocatoria no tiene instrumento de retroalimentación')
    }
    if (Number(f.anio) >= ANIO_EN_LINEA) {
      throw new BadRequestException(
        `Las preguntas de ${f.anio} se administran desde la convocatoria, no desde el cargue del histórico.`,
      )
    }
    if (Number(f.respuestas) > 0) {
      throw new ConflictException(
        `Ya hay ${f.respuestas} retroalimentaciones cargadas con estas preguntas: ` +
        'cambiarlas dejaría las respuestas sin sentido.',
      )
    }

    const limpias = (dto?.preguntas ?? [])
      .map(p => ({ texto: (p?.texto ?? '').trim(), tipo: (p?.tipo ?? '').trim().toUpperCase() }))
      .filter(p => p.texto !== '')
    if (limpias.length === 0) {
      throw new BadRequestException('Escriba al menos una pregunta de la hoja de ese año')
    }
    for (const p of limpias) {
      if (!TIPOS_PREGUNTA.includes(p.tipo)) {
        throw new BadRequestException(
          `"${p.tipo}" no es un tipo de pregunta válido. Use ${TIPOS_PREGUNTA.join(', ')}.`,
        )
      }
      if (p.texto.length > MAX_TEXTO_PREGUNTA) {
        throw new BadRequestException(
          `Una de las preguntas pasa de ${MAX_TEXTO_PREGUNTA} caracteres. Recórtela.`,
        )
      }
    }
    if (!limpias.some(p => p.tipo === 'ESCALA')) {
      throw new BadRequestException(
        'La hoja debe tener al menos una pregunta con nota, si no no hay promedio que calcular.',
      )
    }

    const formularioId = Number(f.formularioId)
    await this.dataSource.transaction(async m => {
      // sin respuestas se pueden borrar: nada queda huérfano
      await m.query(`DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID = :1`, [formularioId])
      for (let i = 0; i < limpias.length; i++) {
        const numero = i + 1
        const seq: Array<{ NEXTVAL: number }> = await m.query(
          `SELECT RETROPREGUNTA_SEQ.NEXTVAL FROM dual`)
        await m.query(
          `INSERT INTO RETROPREGUNTA
             (RETROPREGUNTAID, RETROFORMULARIOID, NUMERO, TEXTO, CRITERIOS,
              TIPO, PESO, REQUERIDA, ORDEN, ACTIVO)
           VALUES (:1, :2, :3, :4, NULL, :5, 1, 1, :6, 1)`,
          [Number(seq[0].NEXTVAL), formularioId, numero, limpias[i].texto, limpias[i].tipo, numero * 10],
        )
      }
    })

    await this.controlCambios.registrar({
      tabla: 'RETROPREGUNTA', operacion: 'UPDATE', registroId: formularioId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `Registró las ${limpias.length} preguntas de la hoja de ${f.anio} (convocatoria ${convocatoriaId})`,
      valorDespues: limpias,
    })

    return {
      convocatoriaId,
      anio: Number(f.anio),
      preguntas: await this.preguntas(formularioId),
      message: `Quedaron registradas ${limpias.length} preguntas para ${f.anio}`,
    }
  }

  // copia la hoja de otra convocatoria como punto de partida
  async copiarPreguntas(destinoId: number, origenId: number, ctx: CtxUsuario) {
    if (destinoId === origenId) {
      throw new BadRequestException('El origen y el destino son la misma convocatoria')
    }
    const origen: Array<{ formularioId: number }> = await this.dataSource.query(
      `SELECT RETROFORMULARIOID AS "formularioId" FROM RETROFORMULARIO
        WHERE CONVOCATORIAID = :1 AND ACTIVO = 1`,
      [origenId],
    )
    if (!origen[0]) throw new NotFoundException('La convocatoria de la que quiere copiar no tiene instrumento')

    const preguntas = await this.preguntas(Number(origen[0].formularioId))
    if (preguntas.length === 0) {
      throw new BadRequestException('Esa convocatoria todavía no tiene preguntas registradas')
    }
    return this.guardarPreguntas(
      destinoId,
      { preguntas: preguntas.map(p => ({ texto: p.texto, tipo: p.tipo })) },
      ctx,
    )
  }

  // los demás del mismo ciclo, para escoger quién calificó a quién
  async companeros(participacionId: number) {
    const ctx = await this.contexto(participacionId)
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "participacionId",
              pa.EVALUADORID     AS "evaluadorId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre",
              TRIM(p.PERSONAIDENTIFICACION) AS "identificacion",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rol",
              TRIM(ar.NOMBRE)    AS "area"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID   = e.PERSONAID
         LEFT JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar ON ar.AREAID = pa.AREAID
        WHERE pa.CONVOCATORIAID = :1
        ORDER BY p.PERSONAPRIMERAPELLIDO, p.PERSONANOMBRES`,
      [ctx.convocatoriaId],
    )
    return filas.map(f => ({
      participacionId: Number(f.participacionId),
      evaluadorId: Number(f.evaluadorId),
      nombre: String(f.nombre ?? '').replace(/\s+/g, ' ').trim(),
      identificacion: f.identificacion ? String(f.identificacion) : null,
      rol: f.rol ? String(f.rol) : null,
      area: f.area ? String(f.area) : null,
    }))
  }

  // lo ya cargado para esa persona, para que el equipo no repita filas
  async registradas(participacionId: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT r.RETRORESPUESTAID AS "respuestaId",
              r.PARTEVALUADORID  AS "evaluadorParticipacionId",
              r.PROMEDIO         AS "promedio",
              r.FECHAENVIO       AS "fecha",
              a.MOTIVOREGLA      AS "motivo",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "califico"
         FROM RETRORESPUESTA r
         JOIN RETROASIGNACION a ON a.RETROASIGNACIONID = r.RETROASIGNACIONID
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = r.PARTEVALUADORID
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID   = e.PERSONAID
        WHERE r.PARTEVALUADOID = :1
        ORDER BY r.FECHAENVIO DESC`,
      [participacionId],
    )
    return filas.map(f => ({
      respuestaId: Number(f.respuestaId),
      evaluadorParticipacionId: Number(f.evaluadorParticipacionId),
      promedio: f.promedio == null ? null : Number(f.promedio),
      fecha: f.fecha ? new Date(f.fecha as string).toISOString() : null,
      califico: String(f.califico ?? '').replace(/\s+/g, ' ').trim(),
      historica: String(f.motivo ?? '').startsWith('HISTORICO'),
    }))
  }

  async registrar(dto: RetroHistoricaDto, ctx: CtxUsuario) {
    const calificador = Number(dto.evaluadorParticipacionId)
    const calificado = Number(dto.evaluadoParticipacionId)
    if (!calificador || !calificado) {
      throw new BadRequestException('Falta indicar quién calificó y a quién')
    }
    if (calificador === calificado) {
      throw new BadRequestException('Nadie puede calificarse a sí mismo')
    }

    const meta = await this.contexto(calificado)
    if (meta.anio >= ANIO_EN_LINEA) {
      throw new BadRequestException(
        `${meta.anio} se diligencia en el sistema, no se carga a mano.`,
      )
    }

    // quien califica tiene que ser del mismo ciclo: si no, la nota no significa nada
    const otro: Array<{ anio: number; convocatoriaId: number }> = await this.dataSource.query(
      `SELECT ANIO AS "anio", CONVOCATORIAID AS "convocatoriaId"
         FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`,
      [calificador],
    )
    if (!otro[0]) throw new NotFoundException('La participación de quien calificó no existe')
    if (Number(otro[0].convocatoriaId) !== meta.convocatoriaId) {
      throw new BadRequestException(
        `Quien calificó no es de la misma convocatoria (${otro[0].anio} contra ${meta.anio}): ` +
        'la retroalimentación se hace entre quienes estuvieron en el mismo ciclo.',
      )
    }

    const repetida: Array<{ n: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "n" FROM RETRORESPUESTA
        WHERE PARTEVALUADORID = :1 AND PARTEVALUADOID = :2`,
      [calificador, calificado],
    )
    if (Number(repetida[0].n) > 0) {
      throw new ConflictException('Esa calificación ya está registrada')
    }

    const preguntas = await this.preguntas(meta.formularioId)
    if (preguntas.length === 0) {
      throw new BadRequestException(
        `Todavía no están registradas las preguntas de la hoja de ${meta.anio}. Regístrelas primero.`,
      )
    }
    const escalas = preguntas.filter(p => p.tipo === 'ESCALA')
    if (escalas.length === 0) {
      throw new BadRequestException('El instrumento de ese año no tiene preguntas con nota')
    }

    for (const p of escalas) {
      const val = Number(dto.escalas?.[String(p.numero)])
      if (!Number.isInteger(val) || val < meta.escalaMin || val > meta.escalaMax) {
        throw new BadRequestException(
          `La pregunta ${p.numero} debe ser un número entero entre ${meta.escalaMin} y ${meta.escalaMax}.`,
        )
      }
    }

    const suma = escalas.reduce((s, p) => s + Number(dto.escalas[String(p.numero)]), 0)
    const maximo = escalas.length * meta.escalaMax
    const promedio = Math.round((suma / escalas.length) * 100) / 100

    const respuestaId = await this.dataSource.transaction(async m => {
      const siguiente = async (secuencia: string) => {
        const r: Array<{ NEXTVAL: number }> = await m.query(`SELECT ${secuencia}.NEXTVAL FROM dual`)
        return Number(r[0].NEXTVAL)
      }

      // sesión y asignación son obligatorias por clave foránea: se crean marcadas como histórico
      const sesionId = await siguiente('RETROSESION_SEQ')
      await m.query(
        `INSERT INTO RETROSESION
           (RETROSESIONID, RETROFORMULARIOID, PARTICIPACIONID, FECHAINICIO, FECHAENVIO,
            DURACIONMINUTOS, MINUTOSTRANSCURRIDOS, SEEXCEDIO, USUARIOEMAIL)
         VALUES (:1, :2, :3, SYSDATE, SYSDATE, :4, 0, 0, :5)`,
        [sesionId, meta.formularioId, calificador, meta.duracion, ctx.usuarioEmail],
      )

      const asignacionId = await siguiente('RETROASIGNACION_SEQ')
      await m.query(
        `INSERT INTO RETROASIGNACION
           (RETROASIGNACIONID, RETROFORMULARIOID, PARTEVALUADORID, PARTEVALUADOID,
            ESTADO, ORIGEN, MOTIVOREGLA, USUARIOCREACION)
         VALUES (:1, :2, :3, :4, N'ENVIADA', N'MANUAL', :5, :6)`,
        [asignacionId, meta.formularioId, calificador, calificado, MOTIVO_HISTORICO, ctx.usuarioEmail],
      )

      const id = await siguiente('RETRORESPUESTA_SEQ')
      await m.query(
        `INSERT INTO RETRORESPUESTA
           (RETRORESPUESTAID, RETROSESIONID, RETROASIGNACIONID, RETROFORMULARIOID,
            PARTEVALUADORID, PARTEVALUADOID, PUNTAJEESCALA, PUNTAJEMAXIMO, PROMEDIO, FECHAENVIO)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE)`,
        [id, sesionId, asignacionId, meta.formularioId, calificador, calificado, suma, maximo, promedio],
      )
      await m.query(
        `UPDATE RETROASIGNACION SET RETRORESPUESTAID = :1 WHERE RETROASIGNACIONID = :2`,
        [id, asignacionId],
      )

      for (const p of escalas) {
        const itemId = await siguiente('RETRORESPUESTAITEM_SEQ')
        await m.query(
          `INSERT INTO RETRORESPUESTAITEM
             (RETROITEMID, RETRORESPUESTAID, RETROPREGUNTAID, PREGUNTANUMERO, CALIFICACION)
           VALUES (:1, :2, :3, :4, :5)`,
          [itemId, id, p.preguntaId, p.numero, Number(dto.escalas[String(p.numero)])],
        )
      }

      // las de texto guardan la respuesta literal de la hoja: SÍ/NO, Presencial/PAT
      for (const p of preguntas.filter(x => x.tipo !== 'ESCALA')) {
        const texto = (dto.textos?.[String(p.numero)] ?? '').trim()
        if (!texto) continue
        const itemId = await siguiente('RETRORESPUESTAITEM_SEQ')
        await m.query(
          `INSERT INTO RETRORESPUESTAITEM
             (RETROITEMID, RETRORESPUESTAID, RETROPREGUNTAID, PREGUNTANUMERO, COMENTARIO)
           VALUES (:1, :2, :3, :4, :5)`,
          [itemId, id, p.preguntaId, p.numero, texto.slice(0, 2000)],
        )
      }

      return id
    })

    await this.controlCambios.registrar({
      tabla: 'RETRORESPUESTA', operacion: 'INSERT', registroId: respuestaId,
      participacionId: calificado, evaluadorId: meta.evaluadorId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `Cargó a mano la retroalimentación ${meta.anio} que hizo la participación ${calificador}`,
      valorDespues: { escalas: dto.escalas, textos: dto.textos ?? {}, promedio },
    })

    return { respuestaId, promedio, anio: meta.anio, message: 'Retroalimentación registrada' }
  }
}
