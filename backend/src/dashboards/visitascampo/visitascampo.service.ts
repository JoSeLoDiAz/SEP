import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class VisitascampoService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarVisitascampo(convocatoriaId?: number) {
    let query = `SELECT
    vc.VisitasCampoId AS "visitaid",
    p.proyectoid AS "proyectoid",
    cv.convocatoriaid AS "convocatoriaid",
    trim(cv.convocatorianombre) AS "convocatoria",
    P.PROYECTONOMBRE AS "proyecto",

    vc.VisitasCampoNuConve AS "numconvenio",
    vc.VisitasCampoConvenio AS "conviniente",
    vc.VisitasCampoNumRadiSena AS "numradicadosena",
    vc.VisitasCampoFechaRadiSena AS "fecharadicadosena",
    vc.VisitasCampoNumRadiInter AS "numradicadointerventoria",
    vc.VisitasCampoFechaRadiInter AS "fecharadicadointerventoria",
    af.AccionFormacionid AS "accionformacionid",
    trim(af.AccionFormacionNombre) AS "accionformacion",

    ag.AFGrupoNumero AS "numgrupo",

    af.AccionFormacionNumBenef AS "beneficiariosesperados",

    vc.VisitasCampoBenefEncon AS "beneficiariosencontrados",

    vc.VisitasCampoNumUT AS "numunidadtematica",

    ut.UnidadTematicaNombre AS "unidadtematica",

    mf.ModalidadFormacionNombre AS "modalidad",

    ma.MetodologiaAprendizajeNombre AS "metodologia",

    vc.VisitasCampoFecha AS "fechavisita",

    vc.VisitasCampoHora AS "horavisita",

    d.departamentonombre AS "departamento",

    c.ciudadnombre AS "municipio",

    vc.VisitasCampoObserSena AS "observacionsena",

    CASE vc.VisitasCampoEstado
        WHEN 1 THEN 'CUMPLE'
        WHEN 2 THEN 'NO CUMPLE'
    END AS "verificacionsena",

    /* DOCENTE A CARGO */
    LTRIM(RTRIM(
        NVL(trim(per.PersonaNombres),'') || ' ' ||
        NVL(trim(per.PersonaPrimerApellido),'') || ' ' ||
        NVL(trim(per.PersonaSegundoApellido),'')
    )) AS "docenteacargo",

    tdi.TipoDocumentoIdentidadNombre AS "tipodocumento",

    per.PersonaIdentificacion AS "numdocumento"

FROM VisitasCampo vc

LEFT JOIN UnidadTematica ut
    ON ut.UnidadTematicaId = vc.UnidadTematicaId

LEFT JOIN AccionFormacion af
    ON af.AccionFormacionId = ut.AccionFormacionId

INNER JOIN proyecto p
    ON p.proyectoid = af.proyectoid

INNER JOIN convocatoria cv
    ON cv.convocatoriaid = p.convocatoriaid

INNER JOIN empresa e
    ON e.empresaid = p.empresaid

LEFT JOIN AFGrupo ag
    ON ag.AFGrupoId = vc.AFGrupoId

LEFT JOIN ModalidadFormacion mf
    ON mf.ModalidadFormacionId = af.ModalidadFormacionId

LEFT JOIN MetodologiaAprendizaje ma
    ON ma.MetodologiaAprendizajeId = af.MetodologiaAprendizajeId

LEFT JOIN ciudad c
    ON c.ciudadid = vc.ciudadid

LEFT JOIN departamento d
    ON d.departamentoid = c.departamentoid

LEFT JOIN Capacitadores cap
    ON cap.capacitadorid = vc.VisitasCampoPersonaId

LEFT JOIN persona per
    ON per.personaid = cap.CapacitadorPersonaId

LEFT JOIN TipoDocumentoIdentidad tdi
    ON tdi.TipoDocumentoIdentidadId = per.TipoDocumentoIdentidadId

WHERE p.ConvocatoriaId IN (9, 10)

ORDER BY p.proyectoid
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
    console.log(`[visitascampo] OK filas=${rows.length} en ${Date.now() - t0}ms`)
    return rows
  } catch (e) {
    console.error(`[visitascampo] ERROR tras ${Date.now() - t0}ms:`, e)
    throw e
  }

  }
}
