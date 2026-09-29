import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class ModificacionesService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarModificaciones(convocatoriaId?: number) {
    let query = `SELECT
    m.ModificacionesId AS "modificacionid",
    p.proyectoid AS "proyectoid",
    p.proyectonombre AS "proyecto",
    cv.convocatoriaid AS "convocatoriaid",
    TRIM(cv.convocatorianombre) AS "convocatoria",
    
    c.ConveniosNumero AS "numconvenio",

    tm.TipoModificacionNombre AS "tipomodificacion",
    
    m.modificacionesfechaenvio AS "fechaenvio",
    
    m.modificacionesobservaciones AS "observaciones",
    
    m.ModificacionesFechaRemi AS "fecharecepcioninterventoria",

    CASE m.modificacionesconcepto
        WHEN 1 THEN 'VIABLE'
        WHEN 2 THEN 'NO VIABLE'
        WHEN 3 THEN 'VIABLE PARCIALMENTE'
        WHEN 4 THEN 'PENDIENTE'
        ELSE 'SIN CONCEPTO'
    END AS "concepto",

    m.modificacionesnissena AS "nisradicadosena",
    m.modificacionesradisena AS "radicadosena",
    m.modificacionesradisenafecha AS "fecharadicadosena",

    m.modificacionesradiinter AS "radicadointerventoria",
    m.modificacionesradiinterfecha AS "fecharadicadointerventoria",

    m.ModificacionesObserInter AS "observacioninterventoria",

    CASE m.ModificacionesAprobacionSena
        WHEN 1 THEN 'SI'
        WHEN 2 THEN 'NO'
        WHEN 0 THEN 'NA'
    END AS "aprobacionsena",

    m.ModificacionesNisAproSENA AS "nissenaaprobacion",
    m.ModificacionesRadiSenaApro AS "radicadosenaaprobacion",
    m.ModificacionesRadiSenaAproFech AS "fecharadicadosenaaprobacion",

    CASE m.ModificacionesConceptoSENA
        WHEN 1 THEN 'VIABLE'
        WHEN 2 THEN 'NO VIABLE'
        WHEN 3 THEN 'VIABLE PARCIALMENTE'
        WHEN 4 THEN 'PENDIENTE'
        WHEN 5 THEN 'NO APLICA'
        ELSE 'SIN CONCEPTO SENA'
    END AS "conceptosenaaprobacion",

    CASE m.ModificacionesRespuestaSENA
        WHEN 1 THEN 'SIN RESPONDER'
        WHEN 2 THEN 'EN TRÁMITE'
        WHEN 3 THEN 'RESPONDIDO'
        ELSE 'SIN RESPUESTA SENA'
    END AS "estadorespuestasena",

    m.ModificacionesRadiInterApro AS "radicadointerventoriaaprobacion",
    m.ModificacionesRadiInterAproFec AS "fecharadicadointerventoriaaprobacion",

    CASE m.ModificacionesValSena
        WHEN 1 THEN 'CUMPLE'
        WHEN 2 THEN 'NO CUMPLE'
        WHEN 0 THEN 'SIN VERIFICAR'
    END AS "verificacionsena",

    m.ModificacionesObserSena AS "observacionsena",

    /* PROFESIONAL SENA */
    LTRIM(RTRIM(
        NVL(TRIM(per.PersonaNombres),'') || ' ' ||
        NVL(TRIM(per.PersonaPrimerApellido),'') || ' ' ||
        NVL(TRIM(per.PersonaSegundoApellido),'')
    )) AS "profesionalsena",

    /* USUARIO INTERVENTORIA */
    LTRIM(RTRIM(
        NVL(TRIM(peri.PersonaNombres),'') || ' ' ||
        NVL(TRIM(peri.PersonaPrimerApellido),'') || ' ' ||
        NVL(TRIM(peri.PersonaSegundoApellido),'')
    )) AS "usuariointerventoria",

    m.ModificacionesObserSena AS "estado"

FROM Modificaciones m

LEFT JOIN Proyecto p
    ON m.ProyectoId = p.ProyectoId

LEFT JOIN Convocatoria cv
    ON p.ConvocatoriaId = cv.ConvocatoriaId

LEFT JOIN Convenios c
    ON p.ProyectoId = c.ProyectoId

LEFT JOIN TipoModificacion tm
    ON m.TipoModificacionId = tm.TipoModificacionId

/* PROFESIONAL SENA */
LEFT JOIN Usuario u
    ON m.modificacionesUsuarioSENA = u.UsuarioId

LEFT JOIN Persona per
    ON u.UsuarioEmail = per.PersonaEmail

/* INTERVENTORIA */
LEFT JOIN Usuario ui
    ON m.modificacionesUsuarioInter = ui.UsuarioId

LEFT JOIN Persona peri
    ON ui.UsuarioEmail = peri.PersonaEmail

WHERE p.ConvocatoriaId IN (9, 10)

ORDER BY p.ProyectoId
`
const params = []

if (convocatoriaId) {
    query += ` AND co.convocatoriaid = :1`
    params.push(convocatoriaId)
  }

  return this.ds.query(query, params)

  }
}
