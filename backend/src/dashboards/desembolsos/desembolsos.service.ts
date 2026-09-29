import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class DesembolsosService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarDesembolsos(convocatoriaId?: number) {
    let query = `WITH AsignacionesRankeadas AS (
    SELECT a.ProyectoId,
           a.UsuarioId,
           a.AsignacionFechaRegistro,
           u.PerfilId,
           u.UsuarioEmail,
           ROW_NUMBER() OVER (
               PARTITION BY a.ProyectoId, u.PerfilId
               ORDER BY a.AsignacionFechaRegistro DESC, a.AsignacionId DESC
           ) AS rn
    FROM Asignacion a
    INNER JOIN Usuario u ON u.UsuarioId = a.UsuarioId
    WHERE TRIM(a.AsignacionEstadoRegistro) = 'ACTIVO'
      AND u.PerfilId IN (3, 4)
),
ProfSeguimiento AS (
    SELECT ar.ProyectoId,
           per.PersonaNombres,
           per.PersonaPrimerApellido,
           per.PersonaSegundoApellido
    FROM AsignacionesRankeadas ar
    INNER JOIN Persona per ON UPPER(TRIM(per.PersonaEmail)) = UPPER(TRIM(ar.UsuarioEmail))
    WHERE ar.PerfilId = 3
      AND ar.rn = 1
),
ProfFinanciero AS (
    SELECT ar.ProyectoId,
           per.PersonaNombres,
           per.PersonaPrimerApellido,
           per.PersonaSegundoApellido
    FROM AsignacionesRankeadas ar
    INNER JOIN Persona per ON UPPER(TRIM(per.PersonaEmail)) = UPPER(TRIM(ar.UsuarioEmail))
    WHERE ar.PerfilId = 4
      AND ar.rn = 1
)
SELECT
    ROW_NUMBER() OVER(ORDER BY d.DesembolsosNumero) AS ITEM,
    TRIM(c.ConvocatoriaNombre) AS "CONVOCATORIA",
    p.ProyectoId AS "CÓDIGO SEP",
    p.ProyectoNombre AS "CONVENIO",
    e.EmpresaIdentificacion AS "NIT",
    e.EmpresaDigitoVerificacion AS "DIGITO DE VERIFICACIÓN",
    cv.ConveniosNumero AS "CONTRATO SECOP II",
    cv.ConveniosFechaSusc AS "FECHA SUSCRIPCIÓN",
    cv.ConveniosFechaRegistro AS "FECHA DE INICIO",
    cv.ConveniosLinkSecop AS "LINK SECOP",
    cv.ConveniosRP AS "RP",
    cv.ConveniosFechaRP AS "FECHA RP",
    cv.ConveniosRadiPresupuesto AS "RADICADO SOLICITUD RP",
    CASE
        WHEN cv.ConveniosTipoCuenta = 1 THEN 'AHORROS'
        WHEN cv.ConveniosTipoCuenta = 2 THEN 'CORRIENTE'
        ELSE NULL
    END AS "TIPO DE CUENTA",
    cv.ConveniosBanco AS "BANCO",
    cv.ConveniosCuenta AS "No Cuenta Ahorros",
    cv.ConveniosAseguradora AS "NOMBRE ASEGURADORA",
    CASE
        WHEN cv.ConveniosOtroSi = 1 THEN 'SI'
        WHEN cv.ConveniosOtroSi = 2 THEN 'NO'
        ELSE NULL
    END AS "OTRO SI",
    cv.ConveniosFechaOtroSi AS "FECHA APROBACIÓN OTRO SI",
    cv.ConveniosPoliza AS "NÚMERO DE POLIZA CUMPLIMIENTO",
    CASE
        WHEN cv.ConveniosPolizaAnexo > 0 THEN cv.ConveniosPolizaAnexo - 1
        ELSE cv.ConveniosPolizaAnexo
    END AS "ANEXOS POLIZA DE CUMPLIMIENTO",
    cv.ConveniosFecExpPoliza AS "FECHA DE EXPEDICIÓN POLIZA DE CUMPLIMIENTO",
    cv.ConveniosFecAproPoliza AS "FECHA DE APROBACIÓN POLIZA DE CUMPLIMIENTO",
    cv.ConveniosPolizaRC AS "NÚMERO DE PÓLIZA DE RESPONSABILIDAD CIVIL",
    cv.ConveniosPolizaAnexoRC AS "ANEXOS PÓLIZA DE RESPONSABILIDAD CIVIL",
    cv.ConveniosFecExpPolizaRC AS "FECHA DE EXPEDICIÓN PÓLIZA DE RESPONSABILIDAD CIVIL",
    cv.ConveniosFecAproPolizaRC AS "FECHA DE APROBACIÓN PÓLIZA DE RESPONSABILIDAD CIVIL",
    pr.PresupuestoCofinanciacion AS "VALOR DE COFINANCIACIÓN",
    pr.PresupuestoDinero AS "VALOR DE CONTRAPARTIDA EN DINERO",
    pr.PresupuestoEspecie AS "VALOR DE CONTRAPARTIDA EN ESPECIE NÚMEROS",
    (NVL(pr.PresupuestoDinero,0) + NVL(pr.PresupuestoEspecie,0)) AS "VALOR TOTAL DE CONTRAPARTIDA NÚMEROS",
    pr.PresupuestoValorTotalProyecto AS "VALOR TOTAL DEL PROYECTO",
    d.DesembolsosNumero AS "NÚMERO DESEMBOLSO",
    d.DesembolsosPorcentaje AS "PORCENTAJE DESEMBOLSO",
    d.DesembolsosValor AS "VALOR DEL DESEMBOLSO",
    d.DesembolsosRadInter AS "RADICADO INTERVENTORIA",
    d.DesembolsosInterFecha AS "FECHA RADICADO INTERVENTORIA",
    d.DesembolsosRadSenaOB AS "RADICADO SENA ONBASE",
    d.DesembolsosFechaRadSenaOB AS "FECHA DE RADICADO SENA ONBASE",
    d.DesembolsosNIS AS "NIS",
    d.DesembolsosRadConta AS "RADICADO CONTABILIDAD",
    d.DesembolsosFechaConta AS "FECHA RADICADO CONTABILIDAD",
    CASE
        WHEN d.DesembolsosPagoSecop = 1 THEN 'SI'
        WHEN d.DesembolsosPagoSecop = 2 THEN 'NO'
        ELSE NULL
    END AS "CARGADO EN SECOP II",
    d.DesembolsosFechaPago AS "FECHA DE PAGO",
    CASE
        WHEN d.DesembolsosEstado = 0 THEN 'Revisión Financiero'
        WHEN d.DesembolsosEstado = 1 THEN 'Radicados por Interventoría'
        WHEN d.DesembolsosEstado = 2 THEN 'Verificación GGPC'
        WHEN d.DesembolsosEstado = 3 THEN 'Aprobación Director / Radicado'
        WHEN d.DesembolsosEstado = 4 THEN 'Grupo Contabilidad'
        WHEN d.DesembolsosEstado = 5 THEN 'Desembolsado'
        ELSE 'SIN ESTADO'
    END AS "ESTADO",
    d.DesembolsosObserva AS "OBSERVACIONES",
    TRIM(
        TRIM(ps.PersonaNombres)        || ' ' ||
        TRIM(ps.PersonaPrimerApellido) || ' ' ||
        TRIM(ps.PersonaSegundoApellido)
    ) AS "PROFESIONAL DE SEGUIMIENTO",
    TRIM(
        TRIM(pf.PersonaNombres)        || ' ' ||
        TRIM(pf.PersonaPrimerApellido) || ' ' ||
        TRIM(pf.PersonaSegundoApellido)
    ) AS "PROFESIONAL FINANCIERO"
FROM Desembolsos d
    INNER JOIN Proyecto    p  ON d.ProyectoId     = p.ProyectoId
    INNER JOIN Convocatoria c ON p.ConvocatoriaId = c.ConvocatoriaId
    INNER JOIN Convenios   cv ON p.ProyectoId     = cv.ProyectoId
    INNER JOIN Empresa     e  ON p.EmpresaId      = e.EmpresaId
    INNER JOIN Presupuesto pr ON p.ProyectoId     = pr.ProyectoId
    LEFT JOIN ProfSeguimiento ps ON ps.ProyectoId = p.ProyectoId
    LEFT JOIN ProfFinanciero pf ON pf.ProyectoId = p.ProyectoId
WHERE p.ConvocatoriaId IN (9, 10)
`
const params = []

if (convocatoriaId) {
    query += ` AND co.convocatoriaid = :1`
    params.push(convocatoriaId)
  }

  return this.ds.query(query, params)

  }
}
