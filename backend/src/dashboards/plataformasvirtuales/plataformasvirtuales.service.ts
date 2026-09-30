import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class PlataformasVirtualesService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarPlataformasVirtuales(convocatoriaId?: number) {
    let query = `SELECT
    c.ConvocatoriaId                                        AS "convocatoriaid",
    c.ConvocatoriaNombre                                    AS "convocatoria",
    cv.ConveniosNumero                                      AS "numconvenio",

    e.EmpresaIdentificacion                                 AS "numidentificacion",
    e.EmpresaDigitoVerificacion                             AS "digitoverificacion",
    e.EmpresaRazonSocial                                    AS "convenio",
    e.EmpresaSigla                                          AS "sigla",

    p.ProyectoId                                            AS "proyectoid",
    p.ProyectoNombre                                        AS "proyecto",

    pv.PlataformasVirtualesFechaCon                        AS "fecharemisionconvenio",
    pv.PlataformasVirtualesFechaRemi                        AS "fecharemisioninterventoria",
    pv.PlataformasVirtualesRadInter                         AS "radicadoremisioninterventoria",
    pv.PlataformasVirtualesFecRadRes                        AS "fecharespuestainterventoria",
    pv.PlataformasVirtualesRadResInte                      AS "radicadorespuestainterventoria",
    pv.PlataformasVirtualesNisSena                          AS "nissena",
    pv.PlataformasVirtualesRadSena                          AS "radicadosena",
    pv.PlataformasVirtualesFecRadSena                       AS "fecharadicadosena",
    pv.PlataformasVirtualesLink                             AS "linkplataforma",
    pv.PlataformasVirtualesUsuario                          AS "usuario",
    pv.PlataformasVirtualesClave                            AS "clave",

    CASE pv.PlataformasVirtualesEstado
        WHEN 1 THEN 'APROBADO'
        WHEN 2 THEN 'NO APROBADO'
        WHEN 3 THEN 'SIN RESPUESTA'
        ELSE 'SIN VALIDAR'
    END                                                     AS "estado",

    pi.PersonaNombres || ' ' ||
pi.PersonaPrimerApellido || ' ' ||
NVL(pi.PersonaSegundoApellido,'') AS "usuariointerventoria",

    pv.PlataformasVirtualesObservacio                      AS "observacioninterventoria",

    CASE pv.PlataformasVirtualesValSena
        WHEN 1 THEN 'CUMPLE'
        WHEN 2 THEN 'NO CUMPLE'
        ELSE 'SIN VALIDAR'
    END                                                     AS "validacionsena",

    pv.PlataformasVirtualesObsSena                          AS "observacionsena",

    ps.PersonaNombres || ' ' ||
ps.PersonaPrimerApellido || ' ' ||
NVL(ps.PersonaSegundoApellido,'') AS "profesionalsena"

FROM PlataformasVirtuales pv

INNER JOIN Proyecto p
    ON p.ProyectoId = pv.ProyectoId

INNER JOIN Convocatoria c
    ON c.ConvocatoriaId = p.ConvocatoriaId

LEFT JOIN Empresa e
    ON e.EmpresaId = p.EmpresaId

LEFT JOIN Convenios cv
    ON cv.ProyectoId = p.ProyectoId

LEFT JOIN Usuario ui
    ON ui.UsuarioEmail = pv.PlataformasVirtualesUsuRegistr

LEFT JOIN Persona pi
    ON pi.PersonaEmail = ui.UsuarioEmail

LEFT JOIN Usuario us
    ON us.UsuarioEmail = pv.PlataformasVirtualesUsuSena

LEFT JOIN Persona ps
    ON ps.PersonaEmail = us.UsuarioEmail
    WHERE c.ConvocatoriaId IN (9,10)
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
    console.log(`[plataformasvirtuales] OK filas=${rows.length} en ${Date.now() - t0}ms`)
    return rows
  } catch (e) {
    console.error(`[plataformasvirtuales] ERROR tras ${Date.now() - t0}ms:`, e)
    throw e
  }

  }
}
