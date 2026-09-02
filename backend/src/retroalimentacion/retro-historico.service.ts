import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ControlCambiosService } from '../evaluadores/control-cambios.service'
import {
  ES_DINAMIZADOR_SQL, IDENTIFICACION_DINAMIZADOR, MOTIVO_DINAMIZADOR, NOMBRE_DINAMIZADOR,
} from './dinamizador'

export interface CtxUsuario {
  usuarioEmail: string
  usuarioPerfilId: number
}

export interface RetroHistoricaDto {
  // participación de quien hizo la retroalimentación
  evaluadorParticipacionId: number
  // participación de quien la recibió
  evaluadoParticipacionId: number
  // { '1': 5, '2': 4, ... } solo las preguntas de escala
  escalas: Record<string, number>
  // { '6': 'SÍ', '7': 'Presencial' } las de texto, tal como vienen de la hoja
  textos?: Record<string, string>
}

/** Una opción del desplegable "¿quién le hizo esta retroalimentación?". */
export interface CompaneroRetro {
  participacionId: number
  evaluadorId: number
  nombre: string
  identificacion: string | null
  rol: string | null
  area: string | null
  /** true solo en el dinamizador GGPC, que la pantalla muestra aparte del ciclo. */
  esDinamizador?: boolean
  /** Quién dinamizó esa mesa, si quedó registrado. Es una ayuda, no se guarda. */
  quienDinamizo?: string | null
}

const ANIO_EN_LINEA = 2026
// ORIGEN solo acepta AUTOMATICA o MANUAL, asi que el histórico se marca en el motivo
const MOTIVO_HISTORICO = 'HISTORICO - transcrita de las hojas del año'
// CK_RETROPREG_TIPO acepta tres, pero TEXTO_GENERAL es del ciclo y se guarda en
// RETROSUGERENCIA una sola vez: el cargue va persona por persona y no sabria donde ponerlo
const TIPOS_PREGUNTA = ['ESCALA', 'TEXTO_POR_PERSONA']
// RETROPREGUNTA.TEXTO es NVARCHAR2(2000) bytes, o sea 1000 caracteres
const MAX_TEXTO_PREGUNTA = 1000

// carga a mano de las retroalimentaciones de años anteriores, desde las hojas del GGPC
@Injectable()
export class RetroHistoricoService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly controlCambios: ControlCambiosService,
  ) {}

  // el instrumento y la escala salen de la convocatoria de esa participación
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

  /** Se resuelve una vez y se guarda; el "no existe" no se cachea a propósito. */
  private centinela: { participacionId: number; evaluadorId: number } | null = null

  // La participación centinela del dinamizador GGPC: una sola para todos los
  // años y sin convocatoria, así que queda fuera de la matriz, del tablero de
  // avance y de los conteos del ciclo, que filtran todos por convocatoria.
  // Devuelve null mientras no se haya corrido la v68, y entonces el dinamizador
  // simplemente no aparece: nada más cambia.
  private async dinamizador(): Promise<{ participacionId: number; evaluadorId: number } | null> {
    if (this.centinela) return this.centinela
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "participacionId", pa.EVALUADORID AS "evaluadorId"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID   = e.PERSONAID
        WHERE pa.CONVOCATORIAID IS NULL
          AND TRIM(p.PERSONAIDENTIFICACION) = :1`,
      [IDENTIFICACION_DINAMIZADOR],
    )
    if (!filas[0]) return null
    this.centinela = {
      participacionId: Number(filas[0].participacionId),
      evaluadorId: Number(filas[0].evaluadorId),
    }
    return this.centinela
  }

  // Quién dinamizó la mesa de esta persona. Es texto libre de la v51 y hay uno
  // por mesa, no uno por ciclo, así que se lee de la participación del evaluado.
  private async quienDinamizo(participacionId: number): Promise<string | null> {
    try {
      const filas: Array<{ nombre: string | null }> = await this.dataSource.query(
        `SELECT TRIM(DINAMIZADOR) AS "nombre" FROM EVALUADORPARTICIPACION
          WHERE PARTICIPACIONID = :1`,
        [participacionId],
      )
      const nombre = filas[0]?.nombre
      return nombre ? String(nombre).replace(/\s+/g, ' ').trim() || null : null
    } catch {
      // ORA-00904 = falta la columna DINAMIZADOR (v51 sin correr). No es grave:
      // es solo la ayuda del desplegable.
      return null
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
    // las de todo el ciclo, no solo las de esta persona: cambiar la hoja las invalidaría a todas
    const cargadas: Array<{ n: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "n" FROM RETRORESPUESTA WHERE RETROFORMULARIOID = :1`,
      [ctx.formularioId],
    )
    return {
      anio: ctx.anio,
      convocatoriaId: ctx.convocatoriaId,
      convocatoria: await this.nombreConvocatoria(ctx.convocatoriaId),
      escalaMin: ctx.escalaMin,
      escalaMax: ctx.escalaMax,
      preguntas,
      // sin preguntas no se puede cargar nada: primero hay que registrar la hoja del año
      faltaRegistrarPreguntas: preguntas.length === 0,
      cargadasEnElCiclo: Number(cargadas[0].n),
      puedeCambiarPreguntas: Number(cargadas[0].n) === 0,
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

  private async nombres(participaciones: number[]) {
    const lista = participaciones.filter(Boolean)
    if (lista.length === 0) return new Map<number, string>()
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "pid",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID   = e.PERSONAID
        WHERE pa.PARTICIPACIONID IN (${lista.map((_, i) => `:${i + 1}`).join(', ')})`,
      lista,
    )
    return new Map(filas.map(f =>
      [Number(f.pid), String(f.nombre ?? '').replace(/\s+/g, ' ').trim()]))
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
      if (p.tipo === 'TEXTO_GENERAL') {
        throw new BadRequestException(
          'Las preguntas sobre el proceso no se cargan aquí: esta pantalla registra lo de ' +
          'cada persona. Déjela por fuera de la hoja.',
        )
      }
      if (!TIPOS_PREGUNTA.includes(p.tipo)) {
        throw new BadRequestException(
          `"${p.tipo}" no es un tipo de pregunta válido. Use ${TIPOS_PREGUNTA.join(' o ')}.`,
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

  // deja la convocatoria sin preguntas, para volver a registrarlas desde cero
  async borrarPreguntas(convocatoriaId: number, ctx: CtxUsuario) {
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
      throw new BadRequestException(`Las preguntas de ${f.anio} no se tocan desde aquí.`)
    }
    if (Number(f.respuestas) > 0) {
      throw new ConflictException(
        `Ya hay ${f.respuestas} retroalimentaciones cargadas con estas preguntas: ` +
        'primero habría que quitarlas.',
      )
    }

    const formularioId = Number(f.formularioId)
    const antes = await this.preguntas(formularioId)
    await this.dataSource.query(
      `DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID = :1`, [formularioId])

    await this.controlCambios.registrar({
      tabla: 'RETROPREGUNTA', operacion: 'DELETE', registroId: formularioId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `Quitó las ${antes.length} preguntas de ${f.anio} (convocatoria ${convocatoriaId}) para rehacerlas`,
      valorAntes: antes.map(p => ({ texto: p.texto, tipo: p.tipo })),
    })

    return {
      convocatoriaId,
      anio: Number(f.anio),
      quitadas: antes.length,
      message: `Se quitaron las ${antes.length} preguntas de ${f.anio}`,
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
    const delCiclo: CompaneroRetro[] = filas.map(f => ({
      participacionId: Number(f.participacionId),
      evaluadorId: Number(f.evaluadorId),
      nombre: String(f.nombre ?? '').replace(/\s+/g, ' ').trim(),
      identificacion: f.identificacion ? String(f.identificacion) : null,
      rol: f.rol ? String(f.rol) : null,
      area: f.area ? String(f.area) : null,
    }))

    // El dinamizador no sale de la consulta de arriba y no puede salir: no está
    // en la convocatoria. Va al final, marcado, para que la pantalla lo separe
    // de los del ciclo en vez de revolverlo con ellos.
    const centinela = await this.dinamizador()
    if (!centinela || centinela.participacionId === participacionId) return delCiclo
    return [...delCiclo, {
      participacionId: centinela.participacionId,
      evaluadorId: centinela.evaluadorId,
      nombre: NOMBRE_DINAMIZADOR,
      identificacion: null,
      rol: null,
      area: null,
      esDinamizador: true,
      quienDinamizo: await this.quienDinamizo(participacionId),
    }]
  }

  // las que esta persona RECIBIO, con quien se la hizo y las respuestas, para poder corregirlas
  async recibidas(participacionId: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT r.RETRORESPUESTAID AS "respuestaId",
              r.PARTEVALUADORID  AS "autorParticipacionId",
              r.PROMEDIO         AS "promedio",
              r.FECHAENVIO       AS "fecha",
              a.MOTIVOREGLA      AS "motivo",
              ${ES_DINAMIZADOR_SQL('p.PERSONAIDENTIFICACION')} AS "esDinamizador",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "autor"
         FROM RETRORESPUESTA r
         JOIN RETROASIGNACION a ON a.RETROASIGNACIONID = r.RETROASIGNACIONID
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = r.PARTEVALUADORID
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID   = e.PERSONAID
        WHERE r.PARTEVALUADOID = :1
        ORDER BY r.FECHAENVIO DESC`,
      [participacionId],
    )
    if (filas.length === 0) return []

    // las respuestas de todas, de una vez: la pantalla las necesita para editar
    const ids = filas.map(f => Number(f.respuestaId))
    const items: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT RETRORESPUESTAID AS "respuestaId", PREGUNTANUMERO AS "numero",
              CALIFICACION AS "nota", COMENTARIO AS "texto"
         FROM RETRORESPUESTAITEM
        WHERE RETRORESPUESTAID IN (${ids.map((_, i) => `:${i + 1}`).join(', ')})`,
      ids,
    )

    return filas.map(f => {
      const id = Number(f.respuestaId)
      const mios = items.filter(i => Number(i.respuestaId) === id)
      const escalas: Record<string, number> = {}
      const textos: Record<string, string> = {}
      for (const i of mios) {
        const numero = String(i.numero)
        if (i.nota != null) escalas[numero] = Number(i.nota)
        else if (i.texto != null) textos[numero] = String(i.texto)
      }
      return {
        respuestaId: id,
        autorParticipacionId: Number(f.autorParticipacionId),
        promedio: f.promedio == null ? null : Number(f.promedio),
        fecha: f.fecha ? new Date(f.fecha as string).toISOString() : null,
        // por la etiqueta, no por el nombre de la fila: hoy coinciden porque la
        // v68 grabó ese mismo texto en PERSONA, pero eso es una casualidad y no
        // algo en lo que se pueda confiar
        autor: Number(f.esDinamizador) === 1
          ? NOMBRE_DINAMIZADOR
          : String(f.autor ?? '').replace(/\s+/g, ' ').trim(),
        esDinamizador: Number(f.esDinamizador) === 1,
        historica: String(f.motivo ?? '').startsWith('HISTORICO'),
        escalas,
        textos,
      }
    })
  }

  async registrar(dto: RetroHistoricaDto, ctx: CtxUsuario) {
    const autor = Number(dto.evaluadorParticipacionId)
    const destinatario = Number(dto.evaluadoParticipacionId)
    if (!autor || !destinatario) {
      throw new BadRequestException('Falta indicar quién hizo la retroalimentación y a quién')
    }
    if (autor === destinatario) {
      throw new BadRequestException('Nadie se retroalimenta a sí mismo')
    }

    const meta = await this.contexto(destinatario)
    if (meta.anio >= ANIO_EN_LINEA) {
      throw new BadRequestException(
        `${meta.anio} se diligencia en el sistema, no se carga a mano.`,
      )
    }

    // El dinamizador GGPC es la única excepción: está fuera de todo ciclo a
    // propósito, así que exigirle la convocatoria del evaluado no tiene sentido.
    const centinela = await this.dinamizador()
    const esDelDinamizador = centinela != null && autor === centinela.participacionId

    if (!esDelDinamizador) {
      // los demás sí: si no son del mismo ciclo, la retroalimentación no significa nada
      const otro: Array<{ anio: number; convocatoriaId: number }> = await this.dataSource.query(
        `SELECT ANIO AS "anio", CONVOCATORIAID AS "convocatoriaId"
           FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`,
        [autor],
      )
      if (!otro[0]) throw new NotFoundException('La participación de quien la hizo no existe')
      if (Number(otro[0].convocatoriaId) !== meta.convocatoriaId) {
        throw new BadRequestException(
          `No son de la misma convocatoria (${otro[0].anio} contra ${meta.anio}): ` +
          'la retroalimentación se hace entre quienes estuvieron en el mismo ciclo.',
        )
      }
    }

    const repetida: Array<{ n: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "n" FROM RETRORESPUESTA
        WHERE PARTEVALUADORID = :1 AND PARTEVALUADOID = :2`,
      [autor, destinatario],
    )
    if (Number(repetida[0].n) > 0) {
      throw new ConflictException('Esa retroalimentación ya está registrada')
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
        [sesionId, meta.formularioId, autor, meta.duracion, ctx.usuarioEmail],
      )

      const asignacionId = await siguiente('RETROASIGNACION_SEQ')
      await m.query(
        `INSERT INTO RETROASIGNACION
           (RETROASIGNACIONID, RETROFORMULARIOID, PARTEVALUADORID, PARTEVALUADOID,
            ESTADO, ORIGEN, MOTIVOREGLA, USUARIOCREACION)
         VALUES (:1, :2, :3, :4, N'ENVIADA', N'MANUAL', :5, :6)`,
        [asignacionId, meta.formularioId, autor, destinatario,
          esDelDinamizador ? MOTIVO_DINAMIZADOR : MOTIVO_HISTORICO, ctx.usuarioEmail],
      )

      const id = await siguiente('RETRORESPUESTA_SEQ')
      await m.query(
        `INSERT INTO RETRORESPUESTA
           (RETRORESPUESTAID, RETROSESIONID, RETROASIGNACIONID, RETROFORMULARIOID,
            PARTEVALUADORID, PARTEVALUADOID, PUNTAJEESCALA, PUNTAJEMAXIMO, PROMEDIO, FECHAENVIO)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE)`,
        [id, sesionId, asignacionId, meta.formularioId, autor, destinatario, suma, maximo, promedio],
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
      for (const p of preguntas.filter(x => x.tipo === 'TEXTO_POR_PERSONA')) {
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

    // queda en las dos fichas: en la de quien la hizo, que es desde donde se carga,
    // y en la de quien la recibió, que es a quien describe.
    // El centinela no tiene ficha que mirar, y además contexto() le exigiría una
    // convocatoria con instrumento activo que no tiene: aquí ya se hizo commit,
    // así que reventaría con la retroalimentación guardada.
    const fichas: Array<[number, number]> = [[destinatario, meta.evaluadorId]]
    if (!esDelDinamizador) {
      const quien = await this.contexto(autor)
      fichas.unshift([autor, quien.evaluadorId])
    }
    const nombres = await this.nombres([autor, destinatario])
    const detalle = `${nombres.get(autor) ?? autor} retroalimentó a ${nombres.get(destinatario) ?? destinatario}`
    for (const [participacion, evaluador] of fichas) {
      await this.controlCambios.registrar({
        tabla: 'RETRORESPUESTA', operacion: 'INSERT', registroId: respuestaId,
        participacionId: participacion, evaluadorId: evaluador,
        usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
        comentario: `Cargó a mano la retroalimentación de ${meta.anio}: ${detalle}`,
        valorDespues: { escalas: dto.escalas, textos: dto.textos ?? {}, promedio },
      })
    }

    return { respuestaId, promedio, anio: meta.anio, message: 'Retroalimentación registrada' }
  }

  // solo las cargadas a mano: las que la gente diligenció en el sistema no se tocan
  private async cargaHistorica(respuestaId: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT r.RETRORESPUESTAID  AS "respuestaId",
              r.RETROSESIONID     AS "sesionId",
              r.RETROASIGNACIONID AS "asignacionId",
              r.RETROFORMULARIOID AS "formularioId",
              r.PARTEVALUADORID   AS "autor",
              r.PARTEVALUADOID    AS "destinatario",
              r.PROMEDIO          AS "promedio",
              a.MOTIVOREGLA       AS "motivo",
              pa.ANIO             AS "anio",
              pa.EVALUADORID      AS "evaluadorId",
              f.ESCALAMIN         AS "escalaMin",
              f.ESCALAMAX         AS "escalaMax"
         FROM RETRORESPUESTA r
         JOIN RETROASIGNACION a ON a.RETROASIGNACIONID = r.RETROASIGNACIONID
         JOIN RETROFORMULARIO f ON f.RETROFORMULARIOID = r.RETROFORMULARIOID
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = r.PARTEVALUADOID
        WHERE r.RETRORESPUESTAID = :1`,
      [respuestaId],
    )
    const f = filas[0]
    if (!f) throw new NotFoundException('Esa retroalimentación no existe')
    if (!String(f.motivo ?? '').startsWith('HISTORICO')) {
      throw new BadRequestException(
        'Esa retroalimentación la diligenció la persona en el sistema, no se carga ni se corrige a mano.',
      )
    }
    return {
      respuestaId: Number(f.respuestaId),
      sesionId: Number(f.sesionId),
      asignacionId: Number(f.asignacionId),
      formularioId: Number(f.formularioId),
      autor: Number(f.autor),
      destinatario: Number(f.destinatario),
      promedio: f.promedio == null ? null : Number(f.promedio),
      anio: Number(f.anio),
      evaluadorId: Number(f.evaluadorId),
      escalaMin: Number(f.escalaMin ?? 1),
      escalaMax: Number(f.escalaMax ?? 5),
    }
  }

  // corregir lo que se transcribió mal de la hoja
  async editar(
    respuestaId: number,
    dto: { escalas: Record<string, number>; textos?: Record<string, string> },
    ctx: CtxUsuario,
  ) {
    const carga = await this.cargaHistorica(respuestaId)
    const preguntas = await this.preguntas(carga.formularioId)
    const escalas = preguntas.filter(p => p.tipo === 'ESCALA')

    for (const p of escalas) {
      const val = Number(dto.escalas?.[String(p.numero)])
      if (!Number.isInteger(val) || val < carga.escalaMin || val > carga.escalaMax) {
        throw new BadRequestException(
          `La pregunta ${p.numero} debe ser un número entero entre ${carga.escalaMin} y ${carga.escalaMax}.`,
        )
      }
    }

    const suma = escalas.reduce((t, p) => t + Number(dto.escalas[String(p.numero)]), 0)
    const maximo = escalas.length * carga.escalaMax
    const promedio = Math.round((suma / escalas.length) * 100) / 100

    await this.dataSource.transaction(async m => {
      await m.query(`DELETE FROM RETRORESPUESTAITEM WHERE RETRORESPUESTAID = :1`, [respuestaId])

      for (const p of escalas) {
        const seq: Array<{ NEXTVAL: number }> = await m.query(
          `SELECT RETRORESPUESTAITEM_SEQ.NEXTVAL FROM dual`)
        await m.query(
          `INSERT INTO RETRORESPUESTAITEM
             (RETROITEMID, RETRORESPUESTAID, RETROPREGUNTAID, PREGUNTANUMERO, CALIFICACION)
           VALUES (:1, :2, :3, :4, :5)`,
          [Number(seq[0].NEXTVAL), respuestaId, p.preguntaId, p.numero,
           Number(dto.escalas[String(p.numero)])],
        )
      }

      for (const p of preguntas.filter(x => x.tipo === 'TEXTO_POR_PERSONA')) {
        const texto = (dto.textos?.[String(p.numero)] ?? '').trim()
        if (!texto) continue
        const seq: Array<{ NEXTVAL: number }> = await m.query(
          `SELECT RETRORESPUESTAITEM_SEQ.NEXTVAL FROM dual`)
        await m.query(
          `INSERT INTO RETRORESPUESTAITEM
             (RETROITEMID, RETRORESPUESTAID, RETROPREGUNTAID, PREGUNTANUMERO, COMENTARIO)
           VALUES (:1, :2, :3, :4, :5)`,
          [Number(seq[0].NEXTVAL), respuestaId, p.preguntaId, p.numero, texto.slice(0, 2000)],
        )
      }

      await m.query(
        `UPDATE RETRORESPUESTA SET PUNTAJEESCALA = :1, PUNTAJEMAXIMO = :2, PROMEDIO = :3
          WHERE RETRORESPUESTAID = :4`,
        [suma, maximo, promedio, respuestaId],
      )
    })

    const nombres = await this.nombres([carga.autor, carga.destinatario])
    const detalle = `${nombres.get(carga.autor) ?? carga.autor} a ${nombres.get(carga.destinatario) ?? carga.destinatario}`
    await this.controlCambios.registrar({
      tabla: 'RETRORESPUESTA', operacion: 'UPDATE', registroId: respuestaId,
      participacionId: carga.destinatario, evaluadorId: carga.evaluadorId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `Corrigió la retroalimentación de ${carga.anio}: ${detalle}`,
      valorAntes: { promedio: carga.promedio },
      valorDespues: { escalas: dto.escalas, textos: dto.textos ?? {}, promedio },
    })

    return { respuestaId, promedio, message: 'Retroalimentación corregida' }
  }

  // quitar una que se cargó por equivocación, con su sesión y su asignación
  async eliminar(respuestaId: number, ctx: CtxUsuario) {
    const carga = await this.cargaHistorica(respuestaId)
    const nombres = await this.nombres([carga.autor, carga.destinatario])
    const detalle = `${nombres.get(carga.autor) ?? carga.autor} a ${nombres.get(carga.destinatario) ?? carga.destinatario}`

    await this.dataSource.transaction(async m => {
      await m.query(`DELETE FROM RETRORESPUESTAITEM WHERE RETRORESPUESTAID = :1`, [respuestaId])
      // primero se suelta la referencia: la asignación apunta a la respuesta
      await m.query(
        `UPDATE RETROASIGNACION SET RETRORESPUESTAID = NULL WHERE RETROASIGNACIONID = :1`,
        [carga.asignacionId],
      )
      await m.query(`DELETE FROM RETRORESPUESTA WHERE RETRORESPUESTAID = :1`, [respuestaId])
      await m.query(`DELETE FROM RETROASIGNACION WHERE RETROASIGNACIONID = :1`, [carga.asignacionId])
      await m.query(`DELETE FROM RETROSESION WHERE RETROSESIONID = :1`, [carga.sesionId])
    })

    await this.controlCambios.registrar({
      tabla: 'RETRORESPUESTA', operacion: 'DELETE', registroId: respuestaId,
      participacionId: carga.destinatario, evaluadorId: carga.evaluadorId,
      usuarioEmail: ctx.usuarioEmail, usuarioPerfilId: ctx.usuarioPerfilId,
      comentario: `Quitó la retroalimentación de ${carga.anio}: ${detalle}`,
      valorAntes: { promedio: carga.promedio },
    })

    return { respuestaId, message: 'Retroalimentación quitada' }
  }
}
