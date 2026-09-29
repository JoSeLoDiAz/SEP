import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class CapacitadoresService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarCapacitadores(convocatoriaId?: number) {
    let query = `SELECT 
    p.proyectoid AS "proyectoid",
    p.proyectonombre AS "proyecto",
    cv.convocatoriaid AS "convocatoriaid",
    cv.convocatorianombre AS "convocatorianombre",
    e.empresaidentificacion AS "empresaidentificacion",
    e.empresadigitoverificacion AS "empresadigitoverificacion",
    ac.AprobacionCapaFechaRemi AS "fecharemisionconviniente",
    ac.AprobacionCapaRadInter AS "numradrespuestainterventoria",
    ac.AprobacionCapaInterFecha AS "fecharespuestainterventoria",
    ac.AprobacionCapaNISSENA AS "nisradsena",
    ac.AprobacionCapaRadSena AS "numradsena",
    ac.AprobacionCapaFechaRad AS "fecharadsena",

    CASE hv.HVPersonaEstado
        WHEN 1 THEN 'APROBADO'
        WHEN 2 THEN 'CUMPLE PARCIALMENTE'
        WHEN 3 THEN 'RECHAZADO'
        WHEN 0 THEN 'SIN EVALUAR'
    END AS "estadohv",

    CASE hv.HVPersonaEstado
        WHEN 1 THEN 'TOTAL'
        WHEN 2 THEN 'PARCIAL'
        WHEN 3 THEN 'RECHAZADO'
        WHEN 0 THEN 'SIN EVALUAR'
    END AS "tipoentrega",

    c.CapaObservacion AS OBSERVACIONES,
    c.CapaFechaRegistro AS FECHA_REGISTRO,
    c.CapaTipo AS "tipocapacitador",

    tdi.tipodocumentoidentidadnombre AS "tipodocumento",
    per.personaidentificacion AS "identificacioncapacitador",
    TRIM(per.personanombres) AS "nombrecapacitador",
    TRIM(per.personaprimerapellido) AS "primerapellido",
    TRIM(per.personasegundoapellido) AS "segundoapellido",

    /* PERFIL ACADEMICO CONCATENADO */
    
    (
    SELECT LISTAGG(tt.TipoTituloNombre, ', ')
           WITHIN GROUP (ORDER BY tt.TipoTituloNombre)
    FROM PersonaTitulos pt
    INNER JOIN TipoTitulo tt
        ON tt.TipoTituloId = pt.TipoTituloId
    WHERE pt.personaid = per.personaid
) AS "perfilacademico",

    /* EXPERIENCIA CONCATENADA */
    (
        SELECT LISTAGG(te.TipoExperienciaNombre, ', ')
        FROM PersonaExperiencia pe
        INNER JOIN TipoExperiencia te
            ON te.TipoExperienciaID = pe.TipoExperienciaID
        WHERE pe.personaid = per.personaid
    ) AS "experiencia",

    emp2.empresaidentificacion AS "empresaidentificacion2",
    emp2.empresadigitoverificacion AS "digitoverificacion2",
    TRIM(emp2.empresarazonsocial) AS "nombrejuridico",

    /* INTERVENTOR */
    LTRIM(RTRIM(
    NVL(TRIM(pi.personanombres),'') || ' ' ||
    NVL(TRIM(pi.personaprimerapellido),'') || ' ' ||
    NVL(TRIM(pi.personasegundoapellido),'')
)) AS "interventor",

    TRIM(c.CapaInterEstado) AS ESTADO,
    TRIM(c.CapacitadorEstadoTransferencia) AS "estadotransferencia",
    TRIM(c.CapacitadorObservacionTransfer) AS "observacionestransferencia",
    TRIM(c.CapacitadorFechaTransferencia) AS "fechaaprotransferencia",

    hv.HVPersonaObservacion AS "observacioneshv",

    /* PROFESIONAL SENA */
    LTRIM(RTRIM(
    NVL(TRIM(ps.personanombres),'') || ' ' ||
    NVL(TRIM(ps.personaprimerapellido),'') || ' ' ||
    NVL(TRIM(ps.personasegundoapellido),'')
)) AS "prefesionalsena"

FROM capacitadores c

INNER JOIN proyecto p
    ON p.proyectoid = c.proyectoid

INNER JOIN convocatoria cv
    ON cv.convocatoriaid = p.convocatoriaid    

INNER JOIN empresa e
    ON e.empresaid = p.empresaid

LEFT JOIN AprobacionCapa ac
    ON ac.AprobacionCapaId = c.CapacitadoresAproCapa

LEFT JOIN persona per
    ON per.personaid = c.CapacitadorPersonaId

LEFT JOIN tipodocumentoidentidad tdi
    ON tdi.tipodocumentoidentidadid = per.tipodocumentoidentidadid

LEFT JOIN HVPersona hv
    ON hv.personaid = per.personaid

LEFT JOIN empresa emp2
    ON emp2.empresaid = c.capacitadorempresaid

LEFT JOIN persona pi
    ON pi.personaid = c.CapacitadorInterPersonaId

LEFT JOIN Usuario u
    ON u.UsuarioId = ac.AprobacionCapaUsuSena

LEFT JOIN Persona ps
    ON ps.PersonaEmail = u.UsuarioEmail

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
