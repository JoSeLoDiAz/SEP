import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class VisitassedeService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarVisitassede(convocatoriaId?: number) {
    let query = `
       SELECT vs.VisitasSedeId AS "visitaid",
       p.proyectoid AS "proyectoid",
       TRIM(p.PROYECTONOMBRE) AS "proyecto",
       c.CONVOCATORIAID AS "convocatoriaid",
       TRIM(c.CONVOCATORIANOMBRE) AS "convocatoria",
       TRIM(con.CONVENIOSNUMERO) AS "numconvenio",
       TRIM(e.EMPRESARAZONSOCIAL) AS "empresa",
       TRIM(e.EMPRESASIGLA) AS "sigla",
       vs.VisitasSedeFecha AS "fechavisita",

       TO_CHAR(vs.VisitasSedeHora - INTERVAL '5' HOUR, 'HH24:MI') AS "horavisita",

       TRIM(dep.departamentonombre) AS "departamento",
       TRIM(ciu.ciudadnombre) AS "ciudad",
       vs.VISITASSEDEFECHAINF AS "fechainformevisita",
       TRIM(vs.VISITASSEDENUMRADI) AS "numradicadosena",
       vs.VISITASSEDEFECHARADI AS "fecharadicadosena",
       vs.VISITASSEDEPORCENTAJEEJETEC AS "porcentajeejecuciontecnica",
       vs.VISITASSEDEPORCENTAJEEJEFIN AS "porcentajeejecucionfinanciera",
       vs.VISITASSEDEPORCENTAJEEJECOFI AS "porcentajeejecucioncofinanciacion",
       vs.VISITASSEDEPORCENTAJEEJEESP AS "porcentajeejecucionespecie",
       vs.VISITASSEDEPORCENTAJEEJEDINER AS "porcentajeejecuciondinero",
       vs.VISITASSEDEFECHAREMISION AS "fecharemisionconviniente",
       vs.visitassedefechainter AS "fecharespuestainterventoria",
       TRIM(vs.VISITASSEDENISSENA) AS "nisradicadosena",

       CASE
           WHEN vs.VISITASSEDEMODALIDAD = 1 THEN 'Presencial'
           WHEN vs.VISITASSEDEMODALIDAD = 2 THEN 'Virtual'
           WHEN vs.VISITASSEDEMODALIDAD = 3 THEN 'PAT'
           ELSE 'SIN MODALIDAD'
       END AS "modalidadvisita",

       TRIM(vt.visitatiponombre) AS "tipovisita",
       vs.VISITASSEDENUMVISITA AS "numvisita",
       TRIM(vs.visitassederadicadointer) AS "radicadointerventoria",
       TRIM(vs.visitassedeinforme) AS "informevisita",
       TRIM(vs.visitassedeobsersena) AS "observaciones",

       CASE
           WHEN vs.VisitasSedeEstado = 1 THEN 'CUMPLE'
           WHEN vs.VisitasSedeEstado = 2 THEN 'NO CUMPLE'
           ELSE NULL
       END AS "verificacionsena",

       TRIM(
           TRIM(per.PersonaNombres)         || ' ' ||
           TRIM(per.PersonaPrimerApellido)  || ' ' ||
           TRIM(per.PersonaSegundoApellido)
       ) AS "nombreusuario"

FROM visitassede vs
INNER JOIN visitatipo vt    ON vt.visitatipoid    = vs.visitatipoid
INNER JOIN proyecto p       ON p.proyectoid       = vs.proyectoid
INNER JOIN empresa e        ON e.empresaid        = p.empresaid
INNER JOIN convenios con    ON con.proyectoid     = p.proyectoid
INNER JOIN convocatoria c   ON c.convocatoriaid   = p.convocatoriaid
INNER JOIN ciudad ciu       ON ciu.ciudadid       = vs.ciudadid
INNER JOIN usuario u        ON u.usuarioid        = vs.visitassedeusuarioid
INNER JOIN persona per      ON per.personaemail   = u.usuarioemail
INNER JOIN departamento dep ON dep.departamentoid = ciu.departamentoid

WHERE p.ConvocatoriaId IN (9, 10)
`
const params = []

if (convocatoriaId) {
    query += ` AND co.convocatoriaid = :1`
    params.push(convocatoriaId)
  }

  // Diagnóstico temporal: medir tiempo real de ejecución y número de filas.
  const t0 = Date.now()
  try {
    const rows = await this.ds.query(query, params)
    console.log(`[visitassede] OK filas=${rows.length} en ${Date.now() - t0}ms`)
    return rows
  } catch (e) {
    console.error(`[visitassede] ERROR tras ${Date.now() - t0}ms:`, e)
    throw e
  }

  }
}
