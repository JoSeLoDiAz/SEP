import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class BeneficiariosService {

constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarBeneficiarios(convocatoriaId?: number) {
    // NOTA: consulta recortada a las columnas y joins que consume el tablero.
    // Se eliminaron empresa, modalidad, tipo de evento, modalidad de formación,
    // caracterización, nivel ocupacional, perfil de transferencia y empresa donde
    // labora (columnas no usadas). Esos joins eran INNER sobre FKs obligatorias de
    // postulación/proyecto, por lo que quitarlos no cambia el conjunto de filas,
    // pero aligera mucho el payload y evita el timeout.
    let query = `WITH UltimaPostulacion AS (
    SELECT
        pos.personaid,
        pos.rangoedadid,
        pos.postulacionantiguedad,
        ROW_NUMBER() OVER (
            PARTITION BY pos.personaid
            ORDER BY pos.postulacionano DESC
        ) AS rn
    FROM postulacion pos
)

SELECT
    pro.proyectoid AS "proyectoid",
    pro.proyectonombre AS "proyecto",
    co.convocatoriaid AS "convocatoriaid",
    trim(co.convocatorianombre) AS "convocatoria",
    AF.ACCIONFORMACIONNOMBRE AS "af",
    afg.afgruponumero AS "grupo",
    ti.tipodocumentoidentidadnombre AS "tipoidbeneficiario",
    per.personaidentificacion AS "numidentificacion",
    per.personanombres AS "nombres",
    per.personaprimerapellido AS "primerapellido",
    per.personasegundoapellido AS "segundoapellido",
    gen.generonombre AS "genero",
    re.rangoedadnombre AS "rangoedad",
    dep.departamentonombre AS "departamentodomicilio",
    CASE
        WHEN pos.postulacionantiguedad = 'S' THEN 'SI'
        ELSE 'NO'
    END AS "beneficiadoanteriormente",
    afgb.CERTIFICA AS "certifica",
    afgb.VALIDACIONINTERVENTOR AS "estadointerventoria",
    af.accionformaciontransferencia AS "estransferencia"

FROM PROYECTO pro

INNER JOIN Convocatoria co
    ON co.convocatoriaid = pro.convocatoriaid

INNER JOIN ACCIONFORMACION af
    ON pro.proyectoid = af.proyectoid

INNER JOIN afgrupo afg
    ON afg.accionformacionid = af.accionformacionid

INNER JOIN afgrupobeneficiario afgb
    ON afgb.afgrupoid = afg.afgrupoid

INNER JOIN persona per
    ON per.personaid = afgb.personaid

INNER JOIN genero gen
    ON gen.generoid = per.generoid

INNER JOIN tipodocumentoidentidad ti
    ON ti.TIPODOCUMENTOIDENTIDADID = per.TIPODOCUMENTOIDENTIDADID

INNER JOIN UltimaPostulacion pos
    ON pos.personaid = per.personaid
   AND pos.rn = 1

INNER JOIN rangoedad re
    ON re.rangoedadid = pos.rangoedadid

INNER JOIN ciudad ciu
    ON ciu.ciudadid = per.ciudadid

INNER JOIN departamento dep
    ON dep.departamentoid = ciu.departamentoid

WHERE pro.ConvocatoriaId IN (9, 10)
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
    console.log(`[beneficiarios] OK filas=${rows.length} en ${Date.now() - t0}ms`)
    return rows
  } catch (e) {
    console.error(`[beneficiarios] ERROR tras ${Date.now() - t0}ms:`, e)
    throw e
  }

  }
}
