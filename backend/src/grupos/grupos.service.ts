import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as XLSX from 'xlsx'

// grupos por acción de formación: cupos, beneficiarios y validación de interventoría
@Injectable()
export class GruposService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // gate suave: la lectura no exige convenio EN EJECUCIÓN
  private async assertProyectoConConvenio(proyectoId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT 1 AS "x" FROM CONVENIOS WHERE PROYECTOID = :1 FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!row) throw new BadRequestException('Este proyecto no tiene convenio.')
  }

  async listarAcciones(proyectoId: number) {
    await this.assertProyectoConConvenio(proyectoId)
    return this.ds.query(
      `SELECT ACCIONFORMACIONID                       AS "afId",
              ACCIONFORMACIONNUMERO                   AS "numero",
              TRIM(ACCIONFORMACIONNOMBRE)             AS "nombre",
              NVL(ACCIONFORMACIONTRANSFERENCIA, 0)    AS "transferencia"
         FROM ACCIONFORMACION
        WHERE PROYECTOID = :1
        ORDER BY ACCIONFORMACIONNUMERO`,
      [proyectoId],
    )
  }

  async listarGruposDeAF(proyectoId: number, afId: number) {
    await this.assertProyectoConConvenio(proyectoId)
    const [af] = await this.ds.query(
      `SELECT ACCIONFORMACIONID AS "afId" FROM ACCIONFORMACION
        WHERE ACCIONFORMACIONID = :1 AND PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [afId, proyectoId],
    )
    if (!af) throw new BadRequestException('La AF no pertenece al proyecto.')

    const rows: Array<{
      afGrupoId: number
      grupoNumero: number | null
      cupos: number
      registrados: number
      certificados: number
      validacionInterventor: string | null
    }> = await this.ds.query(
      `SELECT g.AFGRUPOID                                     AS "afGrupoId",
              g.AFGRUPONUMERO                                  AS "grupoNumero",
              NVL((SELECT SUM(c.AFGRUPOCOBERTURABENEF)
                     FROM AFGRUPOCOBERTURA c
                    WHERE c.AFGRUPOID = g.AFGRUPOID), 0)        AS "cupos",
              NVL((SELECT COUNT(agb.AFGRUPOBENEFICIARIOID)
                     FROM AFGRUPOBENEFICIARIO agb
                    WHERE agb.AFGRUPOID = g.AFGRUPOID
                      AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'), 0) AS "registrados",
              NVL((SELECT COUNT(agb.AFGRUPOBENEFICIARIOID)
                     FROM AFGRUPOBENEFICIARIO agb
                    WHERE agb.AFGRUPOID = g.AFGRUPOID
                      AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'
                      AND TRIM(agb.CERTIFICA) = 'SI'), 0)        AS "certificados",
              TRIM(g.AFGRUPOVALIDACIONINTERVENTOR)              AS "validacionInterventor"
         FROM AFGRUPO g
        WHERE g.ACCIONFORMACIONID = :1
        ORDER BY g.AFGRUPONUMERO`,
      [afId],
    )
    return rows.map(r => ({
      ...r,
      cupos: Number(r.cupos),
      registrados: Number(r.registrados),
      certificados: Number(r.certificados),
    }))
  }

  async listarBeneficiariosGrupo(proyectoId: number, afGrupoId: number) {
    await this.assertProyectoConConvenio(proyectoId)
    const [g] = await this.ds.query(
      `SELECT g.AFGRUPOID AS "id"
         FROM AFGRUPO g
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE g.AFGRUPOID = :1 AND af.PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [afGrupoId, proyectoId],
    )
    if (!g) throw new BadRequestException('El grupo no pertenece al proyecto.')

    const rows: Array<{
      afGrupoBeneficiarioId: number
      personaId: number
      tipoDocumentoId: number | null
      tipoDocumento: string | null
      identificacion: string | null
      nombres: string | null
      primerApellido: string | null
      segundoApellido: string | null
      estado: string | null
      certifica: string | null
      validacionInterventor: string | null
    }> = await this.ds.query(
      `SELECT agb.AFGRUPOBENEFICIARIOID            AS "afGrupoBeneficiarioId",
              p.PERSONAID                           AS "personaId",
              p.TIPODOCUMENTOIDENTIDADID            AS "tipoDocumentoId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE)  AS "tipoDocumento",
              TRIM(p.PERSONAIDENTIFICACION)         AS "identificacion",
              TRIM(p.PERSONANOMBRES)                AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)         AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO)        AS "segundoApellido",
              TRIM(agb.AFGRUPOBENEESTADO)           AS "estado",
              TRIM(agb.CERTIFICA)                   AS "certifica",
              TRIM(agb.VALIDACIONINTERVENTOR)       AS "validacionInterventor"
         FROM AFGRUPOBENEFICIARIO agb
         JOIN PERSONA p                       ON p.PERSONAID = agb.PERSONAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td  ON td.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
        WHERE agb.AFGRUPOID = :1
        ORDER BY p.PERSONAID`,
      [afGrupoId],
    )
    return rows.map(r => ({
      ...r,
      nombreCompleto: [r.nombres, r.primerApellido, r.segundoApellido]
        .map(x => (x ?? '').trim()).filter(Boolean).join(' '),
    }))
  }

  async getCoberturaGrupo(proyectoId: number, afGrupoId: number) {
    await this.assertProyectoConConvenio(proyectoId)
    const [g] = await this.ds.query(
      `SELECT g.AFGRUPOID  AS "id",
              g.AFGRUPONUMERO AS "numero",
              af.ACCIONFORMACIONNUMERO AS "afNumero",
              TRIM(af.ACCIONFORMACIONNOMBRE) AS "afNombre"
         FROM AFGRUPO g
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE g.AFGRUPOID = :1 AND af.PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [afGrupoId, proyectoId],
    )
    if (!g) throw new BadRequestException('El grupo no pertenece al proyecto.')

    const coberturas = await this.ds.query(
      `SELECT c.AFGRUPOCOBERTURAID                AS "id",
              c.DEPARTAMENTOGRUPOID               AS "departamentoId",
              TRIM(d.DEPARTAMENTONOMBRE)          AS "departamento",
              c.CIUDADGRUPOID                     AS "ciudadId",
              TRIM(ci.CIUDADNOMBRE)               AS "ciudad",
              c.AFGRUPOCOBERTURABENEF             AS "cupos",
              c.AFGRUPOCOBERTURAJUSTIFICACION     AS "justificacion",
              NVL(c.AFGRUPOCOBERTURARURAL, 0)     AS "rural"
         FROM AFGRUPOCOBERTURA c
         LEFT JOIN DEPARTAMENTO d ON d.DEPARTAMENTOID = c.DEPARTAMENTOGRUPOID
         LEFT JOIN CIUDAD ci      ON ci.CIUDADID      = c.CIUDADGRUPOID
        WHERE c.AFGRUPOID = :1
        ORDER BY d.DEPARTAMENTONOMBRE, ci.CIUDADNOMBRE`,
      [afGrupoId],
    )

    const totalCupos = coberturas.reduce((a: number, c: { cupos: number }) => a + Number(c.cupos ?? 0), 0)

    return {
      grupo: { afGrupoId, numero: Number(g.numero), afNumero: Number(g.afNumero), afNombre: g.afNombre as string },
      coberturas: coberturas.map((c: any) => ({ ...c, cupos: Number(c.cupos) })),
      totalCupos,
    }
  }

  // borra físicamente duplicados (persona, grupo) que dejó el legacy; conserva el ACTIVO más reciente
  async limpiarDuplicados(proyectoId: number): Promise<{ eliminadas: number }> {
    await this.assertProyectoConConvenio(proyectoId)

    const grupos: Array<{ afGrupoId: number }> = await this.ds.query(
      `SELECT g.AFGRUPOID AS "afGrupoId"
         FROM AFGRUPO g
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE af.PROYECTOID = :1`,
      [proyectoId],
    )
    if (grupos.length === 0) return { eliminadas: 0 }

    const idsGrupos = grupos.map(g => Number(g.afGrupoId))
    const placeholders = idsGrupos.map((_, i) => `:${i + 1}`).join(',')

    const dups: Array<{ personaId: number; afGrupoId: number; cnt: number }> = await this.ds.query(
      `SELECT PERSONAID AS "personaId",
              AFGRUPOID AS "afGrupoId",
              COUNT(*)  AS "cnt"
         FROM AFGRUPOBENEFICIARIO
        WHERE AFGRUPOID IN (${placeholders})
        GROUP BY PERSONAID, AFGRUPOID
       HAVING COUNT(*) > 1`,
      idsGrupos,
    )

    let eliminadas = 0
    for (const d of dups) {
      const filas: Array<{ id: number; estado: string | null }> = await this.ds.query(
        `SELECT AFGRUPOBENEFICIARIOID AS "id",
                TRIM(AFGRUPOBENEESTADO) AS "estado"
           FROM AFGRUPOBENEFICIARIO
          WHERE PERSONAID = :1 AND AFGRUPOID = :2
          ORDER BY CASE WHEN TRIM(AFGRUPOBENEESTADO) = 'ACTIVO' THEN 0 ELSE 1 END,
                   AFGRUPOBENEFICIARIOID DESC`,
        [Number(d.personaId), Number(d.afGrupoId)],
      )
      const aEliminar = filas.slice(1).map(f => Number(f.id))
      for (const id of aEliminar) {
        await this.ds.query(
          `DELETE FROM AFGRUPOBENEFICIARIO WHERE AFGRUPOBENEFICIARIOID = :1`,
          [id],
        )
        eliminadas++
      }
    }
    return { eliminadas }
  }

  // activar exige convenio en ejecución, un solo grupo por AF y no pasar el 5% de repetidos
  async cambiarEstadoBeneficiario(
    proyectoId: number,
    afGrupoBeneficiarioId: number,
    nuevoEstado: 'ACTIVO' | 'RETIRADO',
  ): Promise<{ mensaje: string; estado: 'ACTIVO' | 'RETIRADO' }> {
    if (!['ACTIVO', 'RETIRADO'].includes(nuevoEstado)) {
      throw new BadRequestException('Estado inválido. Debe ser ACTIVO o RETIRADO.')
    }
    const [row] = await this.ds.query(
      `SELECT agb.AFGRUPOBENEFICIARIOID            AS "id",
              agb.PERSONAID                        AS "personaId",
              agb.AFGRUPOID                        AS "afGrupoId",
              g.ACCIONFORMACIONID                  AS "afId",
              af.PROYECTOID                        AS "proyectoId",
              af.ACCIONFORMACIONNUMERO             AS "afNumero",
              g.AFGRUPONUMERO                      AS "grupoNumero",
              TRIM(agb.AFGRUPOBENEESTADO)          AS "estadoActual"
         FROM AFGRUPOBENEFICIARIO agb
         JOIN AFGRUPO g          ON g.AFGRUPOID = agb.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE agb.AFGRUPOBENEFICIARIOID = :1
          AND af.PROYECTOID = :2
        FETCH FIRST 1 ROW ONLY`,
      [afGrupoBeneficiarioId, proyectoId],
    )
    if (!row) throw new NotFoundException('Asociación no encontrada en este proyecto.')

    const [conv] = await this.ds.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
        WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (Number(conv?.estado) !== 1) {
      throw new ForbiddenException(
        'No se puede cambiar el estado: el convenio no está en ejecución.',
      )
    }

    if ((row.estadoActual ?? '').toUpperCase() === nuevoEstado) {
      return { mensaje: `La asociación ya estaba ${nuevoEstado}.`, estado: nuevoEstado }
    }

    if (nuevoEstado === 'ACTIVO') {
      const [otro] = await this.ds.query(
        `SELECT agb.AFGRUPOBENEFICIARIOID AS "id",
                g2.AFGRUPONUMERO          AS "grupoNumero"
           FROM AFGRUPOBENEFICIARIO agb
           JOIN AFGRUPO g2 ON g2.AFGRUPOID = agb.AFGRUPOID
          WHERE g2.ACCIONFORMACIONID = :1
            AND agb.PERSONAID = :2
            AND agb.AFGRUPOBENEFICIARIOID <> :3
            AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'
          FETCH FIRST 1 ROW ONLY`,
        [Number(row.afId), Number(row.personaId), afGrupoBeneficiarioId],
      )
      if (otro) {
        throw new BadRequestException(
          `No se puede activar: la persona ya está activa en el Grupo ${otro.grupoNumero ?? '?'} `
          + `de la AF ${row.afNumero ?? '?'}. Una persona solo puede estar en un grupo por acción de formación.`,
        )
      }

      const conteos: Array<{ personaId: number; afsDistintas: number }> = await this.ds.query(
        `SELECT agb.PERSONAID                       AS "personaId",
                COUNT(DISTINCT af.ACCIONFORMACIONID) AS "afsDistintas"
           FROM AFGRUPOBENEFICIARIO agb
           JOIN AFGRUPO g  ON g.AFGRUPOID = agb.AFGRUPOID
           JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
          WHERE af.PROYECTOID = :1
            AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'
          GROUP BY agb.PERSONAID`,
        [proyectoId],
      )
      const yaEra = Number(conteos.find(c => Number(c.personaId) === Number(row.personaId))?.afsDistintas) || 0
      if (yaEra >= 1) {
        const total = conteos.length
        const repetidosActuales = conteos.filter(c => Number(c.afsDistintas) >= 2).length
        const repetidosDespues = yaEra === 1 ? repetidosActuales + 1 : repetidosActuales
        if (total > 0 && repetidosDespues / total > 0.05) {
          const maxPerm = Math.floor(total * 0.05)
          throw new BadRequestException(
            `No se puede activar: el proyecto superaría el 5% de beneficiarios repetidos `
            + `(quedarían ${repetidosDespues} de ${total} = ${Math.round((repetidosDespues / total) * 1000) / 10}%). `
            + `Máximo permitido: ${maxPerm} repetido${maxPerm === 1 ? '' : 's'}.`,
          )
        }
      }
    }

    await this.ds.query(
      `UPDATE AFGRUPOBENEFICIARIO SET AFGRUPOBENEESTADO = :1
        WHERE AFGRUPOBENEFICIARIOID = :2`,
      [nuevoEstado, afGrupoBeneficiarioId],
    )
    return {
      mensaje: nuevoEstado === 'ACTIVO' ? 'Beneficiario activado.' : 'Beneficiario retirado.',
      estado: nuevoEstado,
    }
  }

  async exportarGruposExcel(proyectoId: number): Promise<Buffer> {
    await this.assertProyectoConConvenio(proyectoId)

    const benefs: Array<Record<string, unknown>> = await this.ds.query(
      `SELECT
         UPPER(TRIM(e.EMPRESARAZONSOCIAL))                   AS "empresaRazonSocial",
         TRIM(cv.CONVENIOSNUMERO)                            AS "convenioNumero",
         UPPER(TRIM(m.MODALIDADNOMBRE))                      AS "modalidadParticipacion",
         UPPER(TRIM(af.ACCIONFORMACIONNOMBRE))               AS "accionFormacionNombre",
         UPPER(TRIM(mf.MODALIDADFORMACIONNOMBRE))            AS "modalidadFormacionNombre",
         UPPER(TRIM(te.TIPOEVENTONOMBRE))                    AS "tipoEventoNombre",
         g.AFGRUPONUMERO                                     AS "afGrupoNumero",
         UPPER(TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE))        AS "tipoDocumento",
         TRIM(p.PERSONAIDENTIFICACION)                       AS "personaIdentificacion",
         UPPER(TRIM(p.PERSONANOMBRES))                       AS "personaNombres",
         UPPER(TRIM(p.PERSONAPRIMERAPELLIDO))                AS "personaPrimerApellido",
         UPPER(TRIM(p.PERSONASEGUNDOAPELLIDO))               AS "personaSegundoApellido",
         UPPER(TRIM(ge.GENERONOMBRE))                        AS "generoNombre",
         p.PERSONAESTRATO                                    AS "personaEstrato",
         TO_CHAR(p.PERSONAFECHANACIMIENTO, 'DD/MM/YYYY')     AS "personaFechaNacimiento",
         CASE WHEN p.PERSONAFECHANACIMIENTO IS NULL THEN NULL
              ELSE FLOOR(MONTHS_BETWEEN(SYSDATE, p.PERSONAFECHANACIMIENTO) / 12) END AS "postulacionEdad",
         UPPER(TRIM(re.RANGOEDADNOMBRE))                     AS "rangoEdadNombre",
         TRIM(p.PERSONACELULAR)                              AS "personaCelular",
         TRIM(p.PERSONAEMAIL)                                AS "personaEmail",
         UPPER(TRIM(depDom.DEPARTAMENTONOMBRE))              AS "departamentoNombre",
         UPPER(TRIM(ciDom.CIUDADNOMBRE))                     AS "ciudadNombre",
         UPPER(TRIM(p.PERSONABARRIO))                        AS "personaBarrio",
         UPPER(TRIM(p.PERSONADIRECCION))                     AS "personaDireccion",
         UPPER(TRIM(car.CARACTERIZACIONNOMBRE))              AS "caracterizacionNombre",
         UPPER(TRIM(po.POSTULACIONTRASFERENCIA))             AS "postulacionTrasferencia",
         UPPER(TRIM(pt.PERFILTRASFERENCIANOMBRE))            AS "perfilTrasferenciaNombre",
         UPPER(TRIM(be.BENEFICIARIOEMPRESANOMBRE))           AS "beneficiarioEmpresaNombre",
         UPPER(TRIM(tam.TAMANOEMPRESANOMBRE))                AS "tamanoEmpresaNombre",
         UPPER(TRIM(nivo.NIVELOCUPACIONALNOMBRE))            AS "nivelOcupacionalNombre",
         CASE WHEN UPPER(TRIM(po.POSTULACIONANTIGUEDAD)) = 'S' THEN 'SI' ELSE 'NO' END
                                                             AS "postulacionAntiguedad",
         NVL(agb.PORCENTAJECUMPLIMIENTO, 0)                  AS "porcentajeCumplimiento",
         UPPER(TRIM(agb.CERTIFICA))                          AS "certifica",
         NVL(agb.HORASHIBRIDAS, 0)                           AS "horasHibridas",
         NVL(agb.HORASVIRTUALES, 0)                          AS "horasVirtuales",
         NVL(agb.HORASPAT, 0)                                AS "horasPAT",
         NVL(agb.HORASPRESENCIALES, 0)                       AS "horasPresenciales",
         UPPER(TRIM(agb.AFGRUPOBENEESTADO))                  AS "estadoBeneficiario",
         UPPER(TRIM(agb.VALIDACIONINTERVENTOR))              AS "validacionInterventor"
       FROM AFGRUPOBENEFICIARIO agb
       JOIN PERSONA p                       ON p.PERSONAID = agb.PERSONAID
       JOIN AFGRUPO g                       ON g.AFGRUPOID = agb.AFGRUPOID
       JOIN ACCIONFORMACION af              ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
       JOIN PROYECTO pr                     ON pr.PROYECTOID = af.PROYECTOID
       LEFT JOIN CONVENIOS cv               ON cv.PROYECTOID = pr.PROYECTOID
       LEFT JOIN EMPRESA e                  ON e.EMPRESAID = pr.EMPRESAID
       LEFT JOIN MODALIDAD m                ON m.MODALIDADID = pr.MODALIDADID
       LEFT JOIN MODALIDADFORMACION mf      ON mf.MODALIDADFORMACIONID = af.MODALIDADFORMACIONID
       LEFT JOIN TIPOEVENTO te              ON te.TIPOEVENTOID = af.TIPOEVENTOID
       LEFT JOIN TIPODOCUMENTOIDENTIDAD td  ON td.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
       LEFT JOIN GENERO ge                  ON ge.GENEROID = p.GENEROID
       LEFT JOIN CIUDAD ciDom               ON ciDom.CIUDADID = p.CIUDADID
       LEFT JOIN DEPARTAMENTO depDom        ON depDom.DEPARTAMENTOID = ciDom.DEPARTAMENTOID
       LEFT JOIN POSTULACION po             ON po.PERSONAID = agb.PERSONAID
                                            AND po.POSTULACIONANO = agb.POSTULACIONANO
       LEFT JOIN CARACTERIZACION car        ON car.CARACTERIZACIONID = po.CARACTERIZACIONID
       LEFT JOIN PERFILTRASFERENCIA pt      ON pt.PERFILTRASFERENCIAID = po.PERFILTRASFERENCIAID
       LEFT JOIN BENEFICIARIOEMPRESA be     ON be.BENEFICIARIOEMPRESAID = po.BENEFICIARIOEMPRESAID
       LEFT JOIN TAMANOEMPRESA tam          ON tam.TAMANOEMPRESAID = be.TAMANOEMPRESAID
       LEFT JOIN NIVELOCUPACIONAL nivo      ON nivo.NIVELOCUPACIONALID = po.NIVELOCUPACIONALID
       LEFT JOIN RANGOEDAD re               ON re.RANGOEDADID = po.RANGOEDADID
      WHERE pr.PROYECTOID = :1
      ORDER BY af.ACCIONFORMACIONNUMERO, g.AFGRUPONUMERO, p.PERSONAID`,
      [proyectoId],
    )

    // orden y textos exactos del reporte legacy PReporteCertificados
    const headers = [
      'NO.', 'NOMBRE EMPRESA', 'NUMERO DE CONVENIO', 'MODALIDAD DE PARTICIPACION',
      'ACCION DE FORMACION', 'MODALIDAD DE FORMACION', 'TIPO EVENTO', 'GRUPO',
      'TIPO IDENTIFICACIÓN BENEFICIARIO', 'NÚMERO IDENTIFICACIÓN', 'NOMBRES', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO',
      'GENERO', 'ESTRATO SOCIO-ECONOMICO', 'FECHA NACIMIENTO', 'EDAD', 'RANGO EDAD',
      'NÚMERO CELULAR', 'CORREO', 'DEPARTAMENTO DOMICILIO', 'MUNICIPIO DOMICILIO',
      'BARRIO/VEREDA', 'DIRECCIÓN DOMILICIO', 'CARACTERIZACIÓN',
      'TRANSFERENCIA', 'PERFIL TRANSFERENCIA', 'EMPRESA DONDE LABORA',
      'TAMAÑO EMPRESA DONDE LABORA', 'NIVEL OCUPACIONAL', 'SE HA BENEFICIADO ANTERIORMENTE',
      'PORCENTAJE', 'CERTIFICA',
      'HORAS HIBRIDAS', 'HORAS VIRTUALES', 'HORAS PAT', 'HORAS PRESENCIALES',
      'ESTADO', 'ESTADO INTERVENTORIA',
    ]
    function toFila(b: Record<string, unknown>, nro: number): Array<string | number> {
      const estadoRaw = (b.estadoBeneficiario as string | null) ?? ''
      const estado = estadoRaw.trim().toUpperCase() === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO'
      return [
        nro,
        (b.empresaRazonSocial as string) ?? '',
        (b.convenioNumero as string) ?? '',
        (b.modalidadParticipacion as string) ?? '',
        (b.accionFormacionNombre as string) ?? '',
        (b.modalidadFormacionNombre as string) ?? '',
        (b.tipoEventoNombre as string) ?? '',
        (b.afGrupoNumero as number) ?? '',
        (b.tipoDocumento as string) ?? '',
        (b.personaIdentificacion as string) ?? '',
        (b.personaNombres as string) ?? '',
        (b.personaPrimerApellido as string) ?? '',
        (b.personaSegundoApellido as string) ?? '',
        (b.generoNombre as string) ?? '',
        (b.personaEstrato as number) ?? '',
        (b.personaFechaNacimiento as string) ?? '',
        (b.postulacionEdad as number) ?? '',
        (b.rangoEdadNombre as string) ?? '',
        (b.personaCelular as string) ?? '',
        (b.personaEmail as string) ?? '',
        (b.departamentoNombre as string) ?? '',
        (b.ciudadNombre as string) ?? '',
        (b.personaBarrio as string) ?? '',
        (b.personaDireccion as string) ?? '',
        (b.caracterizacionNombre as string) ?? '',
        (b.postulacionTrasferencia as string) ?? '',
        (b.perfilTrasferenciaNombre as string) ?? '',
        (b.beneficiarioEmpresaNombre as string) ?? '',
        (b.tamanoEmpresaNombre as string) ?? '',
        (b.nivelOcupacionalNombre as string) ?? '',
        (b.postulacionAntiguedad as string) ?? '',
        Number(b.porcentajeCumplimiento) || 0,
        (b.certifica as string) ?? '',
        Number(b.horasHibridas) || 0,
        Number(b.horasVirtuales) || 0,
        Number(b.horasPAT) || 0,
        Number(b.horasPresenciales) || 0,
        estado,
        (b.validacionInterventor as string) ?? '',
      ]
    }

    const filasActivos: Array<Array<string | number>> = [headers]
    const filasInactivos: Array<Array<string | number>> = [headers]
    let nroA = 0, nroI = 0
    for (const b of benefs) {
      const esActivo = ((b.estadoBeneficiario as string | null) ?? '').trim().toUpperCase() === 'ACTIVO'
      if (esActivo) { nroA++; filasActivos.push(toFila(b, nroA)) }
      else          { nroI++; filasInactivos.push(toFila(b, nroI)) }
    }

    // mismo orden que headers
    const colWidths = [
      { wch: 5 },  { wch: 28 }, { wch: 22 }, { wch: 22 },
      { wch: 35 }, { wch: 22 }, { wch: 14 }, { wch: 6 },
      { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
      { wch: 14 }, { wch: 8 },  { wch: 12 }, { wch: 6 }, { wch: 22 },
      { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 18 },
      { wch: 20 }, { wch: 28 }, { wch: 22 },
      { wch: 14 }, { wch: 22 }, { wch: 30 },
      { wch: 50 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 18 },
    ]
    const wb = XLSX.utils.book_new()
    const wsA = XLSX.utils.aoa_to_sheet(filasActivos)
    const wsI = XLSX.utils.aoa_to_sheet(filasInactivos)
    ;(wsA as { [k: string]: unknown })['!cols'] = colWidths
    ;(wsI as { [k: string]: unknown })['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, wsA, 'Activos')
    XLSX.utils.book_append_sheet(wb, wsI, 'Inactivos')
    // compression: true baja el .xlsx ~50x
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer
  }
}
