import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class DirectoresService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarDirectores(convocatoriaId?: number) {
    let query = `SELECT
    p.proyectoid AS "proyectoid",
    cv.ConvocatoriaId AS "convocatoriaid",
    Trim(cv.convocatorianombre) AS "convocatoria",
    P.proyectonombre AS "proyectonombre",
    e.empresaidentificacion AS "empresaidentificacion",
    e.empresadigitoverificacion AS "empresadigitoverificacion",
    d.DirectoresFechaRemision AS "fecharemisionconviniente",
    d.DirectoresRadiInter AS "numradresouestainterventoria",
    d.DirectoresRadiInterFecha AS "fecharesinterventoria",
    d.DirectoresNisSena AS "nisradicadosena",
    d.DirectoresRadiSena AS "numradicadosena",
    d.DirectoresRadiSenaFecha AS "fecharadicadosena",

    d.DireInterEstado AS "estado",

    CASE d.DirectoresRelaContra
        WHEN 1 THEN 'SI'
        WHEN 2 THEN 'NO'
    END AS "relacioncontractual",

    tdi.TipoDocumentoIdentidadNombre AS "tipodocumento",

    per.PersonaIdentificacion AS "numdocumento",

    LTRIM(RTRIM(
        NVL(trim(per.PersonaNombres),'') || ' ' ||
        NVL(trim(per.PersonaPrimerApellido),'') || ' ' ||
        NVL(trim(per.PersonaSegundoApellido),'')
    )) AS "director",

    per.PersonaCelular AS "telefono",
    per.Personaemail AS "correo",

    d.DireObservacion AS "observacion",
    d.DireFechaRegistro AS "fecharegistro",
    d.DireInterFechaActualizacion AS "fechaaprobacion",

    /* INTERVENTOR */
    LTRIM(RTRIM(
        NVL(trim(pi.PersonaNombres),'') || ' ' ||
        NVL(trim(pi.PersonaPrimerApellido),'') || ' ' ||
        NVL(trim(pi.PersonaSegundoApellido),'')
    )) AS "interventor",

    d.DirectoresObserRadi AS "observacionsena",

    CASE d.DirectoresValidacion
        WHEN 1 THEN 'CUMPLE'
        WHEN 2 THEN 'NO CUMPLE'
        WHEN 0 THEN 'SIN VERIFICAR'
    END AS "validacionsena",

    /* PROFESIONAL SENA */
    LTRIM(RTRIM(
        NVL(trim(ps.PersonaNombres),'') || ' ' ||
        NVL(trim(ps.PersonaPrimerApellido),'') || ' ' ||
        NVL(trim(ps.PersonaSegundoApellido),'')
    )) AS "prefesionalsena",

    d.DirectoresNisSenaRC AS "nissenaRC",
    d.DirectoresRadSenaRC AS "radicadosenaRC",
    d.DirectoresFechaRC AS "fecharadicadosenaRC",

    CASE hv.HVPersonaEstado
        WHEN 0 THEN 'SIN EVALUAR'
        WHEN 1 THEN 'APROBADO'
        WHEN 2 THEN 'CUMPLE PARCIALMENTE'
        WHEN 3 THEN 'RECHAZADO'
    END AS "aprobacionhv",

    hv.HVPersonaObservacion AS "observacionhv"

FROM directores d

INNER JOIN proyecto p
    ON p.proyectoid = d.proyectoid
    
INNER JOIN convocatoria cv
    ON cv.convocatoriaid = p.convocatoriaid    

INNER JOIN empresa e
    ON e.empresaid = p.empresaid

LEFT JOIN persona per
    ON per.personaid = d.PersonaId

LEFT JOIN tipodocumentoidentidad tdi
    ON tdi.TipoDocumentoIdentidadId = per.TipoDocumentoIdentidadId

LEFT JOIN persona pi
    ON pi.personaid = d.DirInterPersonaId

LEFT JOIN usuario u
    ON u.usuarioid = d.DirectoresUsuSENA

LEFT JOIN persona ps
    ON ps.PersonaEmail = u.UsuarioEmail

LEFT JOIN HVPersona hv
    ON hv.personaid = per.personaid

WHERE p.ConvocatoriaId IN (9, 10)

ORDER BY p.proyectoid
`
const params = []

if (convocatoriaId) {
    query += ` AND co.convocatoriaid = :1`
    params.push(convocatoriaId)
  }

  return this.ds.query(query, params)

  }
}
