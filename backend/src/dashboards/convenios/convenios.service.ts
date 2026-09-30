import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class ConveniosService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarConvenios(convocatoriaId?: number) {
    let query = `SELECT DISTINCT

    p.ProyectoId AS "proyectoid",

    p.ProyectoNombre AS "proyecto",

    c.convocatoriaid AS "convocatoriaid",
    
    c.ConvocatoriaNombre AS "convocatoria",

    e.EmpresaRazonSocial AS "empresa",

    e.EmpresaSigla AS "sigla",

    m.ModalidadNombre AS "modalidad",

    e.EmpresaIdentificacion AS "nit",

    cv.ConveniosNumero AS "codigosecop",

    dpto.DepartamentoNombre AS "departamento",

    TRIM(pe.PersonaNombres) || ' ' ||
    TRIM(pe.PersonaPrimerApellido) || ' ' ||
    TRIM(pe.PersonaSegundoApellido)
    AS "profesionalseguimiento",

    (
        SELECT SUM(af.AccionFormacionNumBenef)
        FROM AccionFormacion af
        WHERE af.ProyectoId = p.ProyectoId
    ) AS "beneficiarios",

    pr.PresupuestoValorTotalProyecto AS "valorproyecto",

    pr.PresupuestoCofinanciacion AS "cofinanciacion",

    pr.PresupuestoEspecie AS "contrapartidaespecie",

    pr.PresupuestoDinero AS "contrapartidadinero",

    (pr.PresupuestoEspecie + pr.PresupuestoDinero)
    AS "valorcontrapartidad",

    e.EmpresaRep AS "representantelegal",

    e.TipoIdentificacionRep AS "tipodocumento",

    e.EmpresaRepDocumento AS "numdocumento",

    CASE
        WHEN cv.ConveniosEstado = 0 THEN 'Revisión Financiero'
        WHEN cv.ConveniosEstado = 1 THEN 'Radicados por Interventoría'
        WHEN cv.ConveniosEstado = 2 THEN 'Verificación GGPC'
        WHEN cv.ConveniosEstado = 3 THEN 'Aprobación Director / Radicado'
        WHEN cv.ConveniosEstado = 4 THEN 'Grupo Contabilidad'
        WHEN cv.ConveniosEstado = 5 THEN 'Desembolsado'
        ELSE 'SIN ESTADO'
    END AS "ESTADO SUSCRIPCIÓN",

    cv.ConveniosFechaSusc AS "fechasuscripcionsecop",

    cv.ConveniosPoliza AS "numpolizacumplimiento",

    CASE
        WHEN cv.ConveniosPolizaAnexo > 0
            THEN cv.ConveniosPolizaAnexo - 1
        ELSE cv.ConveniosPolizaAnexo
    END AS "numanexo",

    cv.ConveniosFecExpPoliza AS "fechaexpedicion",

    cv.ConveniosFecAproPoliza AS "fechaaprobacionpoliza",

    cv.ConveniosPolizaRC AS "numpolizaRCE",

    cv.ConveniosPolizaAnexoRC AS "numanexoRCE",

    cv.ConveniosFecExpPolizaRC AS "fechaexpedicionRCE",

    cv.ConveniosFecAproPolizaRC AS "fechaaprobacionRCE",

    cv.ConveniosAseguradora AS "aseguradora"

FROM Convenios cv

INNER JOIN Proyecto p
    ON cv.ProyectoId = p.ProyectoId  

INNER JOIN Convocatoria c
    ON p.ConvocatoriaId = c.ConvocatoriaId  

INNER JOIN Empresa e
    ON p.EmpresaId = e.EmpresaId

INNER JOIN Modalidad m
    ON p.ModalidadId = m.ModalidadId

LEFT JOIN Departamento dpto
    ON e.DepartamentoEmpresaId = dpto.DepartamentoId

LEFT JOIN Presupuesto pr
    ON p.ProyectoId = pr.ProyectoId

LEFT JOIN (
    SELECT DISTINCT
        ProyectoId,
        DesembolsosUsuarioProSegui
    FROM Desembolsos
) ds
    ON p.ProyectoId = ds.ProyectoId

LEFT JOIN Persona pe
    ON ds.DesembolsosUsuarioProSegui = pe.PersonaId

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
