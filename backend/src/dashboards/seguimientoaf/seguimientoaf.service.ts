import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class SeguimientoAFService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarSeguimientoAF(convocatoriaId?: number) {
    let query = `
WITH CRONOGRAMA_ACTUAL AS (
    SELECT
        cr.cronoproyecto,
        cr.cronogramafechainicio,
        cr.cronogramafechafin,
        TRIM(cr.cronoestado) AS cronoestado,
        
        ROW_NUMBER() OVER (
            PARTITION BY cr.cronoproyecto
            ORDER BY 
                cr.cronogramafechainicio DESC,
                cr.cronogramafechafin DESC
        ) AS RN
        
    FROM cronograma cr
    
    INNER JOIN proyecto p
        ON p.proyectoid = cr.cronoproyecto
        
    WHERE p.convocatoriaid IN (9, 10)
)

SELECT 

    -- CONVOCATORIA
    c.convocatoriaid AS "CONVOCATORIAID",
    c.convocatorianombre AS "CONVOCATORIA",
    
    -- PROYECTO
    p.proyectoid AS "PROYECTOID",
    p.proyectonombre AS "PROYECTO",
    
    -- ACCIÓN DE FORMACIÓN
    af.accionformacionid AS "ID-AF",
    af.accionformacionnombre AS "ACCION FORMACION",
    af.accionformacionnumbenef AS "BENEFICIARIOS REGISTRADOS",
    af.accionformacionbenefgrupo AS "BENEFICIARIOS POR GRUPO",
    af.accionformaciontransferencia AS "ESTRANSFERENCIA",
    
    -- INFORMACIÓN DE LA ACCIÓN
    mod.modalidadformacionnombre AS "MODALIDAD FORMACION",
    ev.tipoeventonombre AS "EVENTO FORMACION",
    
    -- GRUPO
    ag.afgrupoid AS "GRUPOID",
    ag.afgruponumero AS "NUM GRUPO",
    
    -- BENEFICIARIO
    agb.certifica AS "CERTIFICADOS",
    agb.personaid AS "PERSONAID",
    
    -- UBICACIÓN DEL BENEFICIARIO
    ciu.ciudadid AS "CIUDADID",
    ciu.ciudadnombre AS "CIUDAD",
    dep.departamentoid AS "DEPARTAMENTOID",
    dep.departamentonombre AS "DEPARTAMENTO",
    
    -- CRONOGRAMA
    cr.cronogramafechainicio AS "FECHA INICIO CRONOGRAMA",
    cr.cronogramafechafin AS "FECHA FIN CRONOGRAMA",
    cr.cronoestado AS "ESTADO CRONOGRAMA",
    am.ambientenombre AS "AMBIENTE",
    ut.unidadtematica AS "UTS",
    eaf.afenfoquenombre AS "ENFOQUE",
    af.accionformacionnumgrupos AS "GRUPOS SEGUN AF"

FROM accionformacion af

INNER JOIN proyecto p
    ON p.proyectoid = af.proyectoid

INNER JOIN convocatoria c
    ON c.convocatoriaid = p.convocatoriaid

INNER JOIN modalidadformacion mod
    ON mod.modalidadformacionid = af.modalidadformacionid

INNER JOIN tipoevento ev
    ON ev.tipoeventoid = af.tipoeventoid

LEFT JOIN afgrupo ag
    ON ag.accionformacionid = af.accionformacionid

LEFT JOIN afgrupobeneficiario agb
    ON agb.afgrupoid = ag.afgrupoid

-- PERSONA
LEFT JOIN persona per
    ON per.personaid = agb.personaid

-- CIUDAD
LEFT JOIN ciudad ciu
    ON ciu.ciudadid = per.ciudadid

-- DEPARTAMENTO
LEFT JOIN departamento dep
    ON dep.departamentoid = ciu.departamentoid

LEFT JOIN ambiente am
    ON am.ambienteid = af.ambienteid

LEFT JOIN (
    SELECT 
        accionformacionid, 
        COUNT(*) AS unidadtematica
    FROM unidadtematica
    GROUP BY accionformacionid
) ut 
    ON ut.accionformacionid = af.accionformacionid

LEFT JOIN afenfoque afe
    ON afe.afenfoqueid = af.afenfoqueid

LEFT JOIN CRONOGRAMA_ACTUAL cr
    ON cr.cronoproyecto = p.proyectoid
    AND cr.RN = 1

WHERE p.convocatoriaid IN (9, 10)
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
    console.log(`[segimientoaf] OK filas=${rows.length} en ${Date.now() - t0}ms`)
    return rows
  } catch (e) {
    console.error(`[segimientoaf] ERROR tras ${Date.now() - t0}ms:`, e)
    throw e
  }

  }
}