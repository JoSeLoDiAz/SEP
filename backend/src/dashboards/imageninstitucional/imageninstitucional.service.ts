import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class ImagenInstitucionalService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarImagenInstitucional(convocatoriaId?: number) {
    let query = `SELECT
    ii.ImagenInstitucionalId AS "imagenid",
    c.ConvocatoriaId as "convocatoriaid",
    c.ConvocatoriaNombre AS "convocatoria",

    p.ProyectoId AS "proyectoid",
    p.ProyectoNombre AS "proyecto",

    co.ConveniosNumero AS "numerononvenio",

    e.EmpresaRazonSocial AS "empresa",
    e.EmpresaSigla AS "sigla",

    ii.ImagenInstitucionalFechaCon AS "fecharemisionconvenio",
    ii.ImagenInstitucionalNombre AS "imageninstitucional",

    CASE
        WHEN ii.ImagenInstitucionalVALAF = 1 THEN 'SI'
        WHEN ii.ImagenInstitucionalVALAF = 2 THEN 'NO'
        ELSE ''
    END AS "aplicaparaf",

    af.accionformacionnombre AS "nombreaf",

    ii.ImagenInstitucionalFechaRem AS "fecharadremiinterventoria",
    ii.ImagenInstitucionalRadRem AS "remisionradicadointer",

    ii.ImagenInstitucionalFecInt AS "fecharespuestainter",
    ii.ImagenInstitucionalResInt AS "radicadorespuestainter",

    ii.ImagenInstitucionalFechaSENA AS "fecharadsena",
    ii.ImagenInstitucionalNisSENA AS "nissena",
    ii.ImagenInstitucionalRadSENA AS "radicadosena",

    CASE
        WHEN ii.ImagenInstitucionalEstado = 1 THEN 'APROBADO'
        WHEN ii.ImagenInstitucionalEstado = 2 THEN 'NO APROBADO'
        WHEN ii.ImagenInstitucionalEstado = 3 THEN 'SIN RESPUESTA'
        ELSE 'SIN VALIDAR'
    END AS "estado",

    pi.PersonaNombres || ' ' ||
    pi.PersonaPrimerApellido || ' ' ||
    pi.PersonaSegundoApellido AS "usuariointerventoria",

    ii.ImagenInstitucionalObserInt AS "observacioninterventoria",

    CASE
        WHEN ii.ImagenInstitucionalValSENA = 1 THEN 'CUMPLE'
        WHEN ii.ImagenInstitucionalValSENA = 2 THEN 'NO CUMPLE'
        ELSE 'SIN VALIDAR'
    END AS "estadosena",

    ii.ImagenInstitucionalObserSENA AS "observacionsena",

    ps.PersonaNombres || ' ' ||
    ps.PersonaPrimerApellido || ' ' ||
    ps.PersonaSegundoApellido AS "usuariosena"

FROM ImagenInstitucional ii

INNER JOIN Proyecto p
    ON p.ProyectoId = ii.ProyectoId

INNER JOIN Convocatoria c
    ON c.ConvocatoriaId = p.ConvocatoriaId

LEFT JOIN Convenios co
    ON co.ProyectoId = p.ProyectoId

LEFT JOIN Empresa e
    ON e.EmpresaId = p.EmpresaId

LEFT JOIN AccionFormacion af
    ON af.AccionFormacionId = ii.ImagenInstitucionalAFID

/* Usuario Interventoría */
LEFT JOIN Usuario ui
    ON ui.UsuarioId = ii.ImagenInstitucionalUsuInter

LEFT JOIN Persona pi
    ON pi.PersonaEmail = ui.UsuarioEmail

/* Usuario SENA */
LEFT JOIN Usuario us
    ON us.UsuarioId = ii.ImagenInstitucionalUsuSENA

LEFT JOIN Persona ps
    ON ps.PersonaEmail = us.UsuarioEmail

WHERE c.ConvocatoriaId IN (9,10)
`
const params = []

if (convocatoriaId) {
    query += ` AND co.convocatoriaid = :1`
    params.push(convocatoriaId)
  }

  return this.ds.query(query, params)

  }
}
