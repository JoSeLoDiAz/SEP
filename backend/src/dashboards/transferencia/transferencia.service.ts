import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class TransferenciaService {

constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarTransferencia(convocatoriaId?: number) {
    let query = `WITH Departamentos AS
( SELECT agc.AFGrupoId,
CAST( TRIM( LISTAGG( 'DEPARTAMENTO: ' || TRIM(d.DepartamentoNombre), ' - ' )
WITHIN GROUP ( ORDER BY d.DepartamentoNombre ) ) AS VARCHAR2(4000) ) AS "DepartamentosFinal",
SUM(agc.AFGrupoCoberturaBenef) AS TotalBeneficiarios,
CAST( TRIM( LISTAGG( c.CiudadNombre, ', ' )
WITHIN GROUP ( ORDER BY c.CiudadNombre ) ) AS VARCHAR2(4000) ) AS "CiudadesFinal"
FROM AFGrupoCobertura agc
INNER JOIN Departamento d ON d.DepartamentoId = agc.DepartamentoGrupoId
LEFT JOIN Ciudad c ON c.CiudadId = agc.CiudadGrupoId
GROUP BY agc.AFGrupoId )
SELECT * FROM (
/* ============================================================
BLOQUE PRESENCIAL
============================================================ */
SELECT
/* CONVOCATORIA */
p.ConvocatoriaId AS "convocatoriaId", CAST( TRIM(c.ConvocatoriaNombre) AS VARCHAR2(4000) ) AS "CONVOCATORIA",
/* PROYECTO */ p.ProyectoId AS PROYECTOID, CAST( p.ProyectoNombre AS VARCHAR2(4000) ) AS "PROYECTO",
/* ACCION DE FORMACION */ af.AccionFormacionId AS "ID-AF",
CAST( af.AccionFormacionNombre AS VARCHAR2(4000) ) AS "AF",
af.AccionFormacionNumBenef AS "#BENEFICIARIOS",
CAST( mf.ModalidadFormacionNombre AS VARCHAR2(4000) ) AS "MODALIDAD DE FORMACION",
CAST( te.TipoEventoNombre AS VARCHAR2(4000) ) AS "EVENTO",
CAST( ag.AFGrupoNumero AS VARCHAR2(4000) ) AS "GRUPO",
af.AccionFormacionTransferencia AS "ESTRANSFERENCIA",
/* BENEFICIARIO */
agb.PersonaId AS "PERSONAID",
CAST(agb.afgrupobeneestado AS VARCHAR2(4000) ) AS "ESTADO BENEFICIARIO",
CAST(agb.CERTIFICA AS VARCHAR2(4000) ) AS "CERTIFICA",
CAST(agb.validacioninterventor AS VARCHAR2(4000) ) AS "ESTADO INTERVENTORIA",
TRIM(CAST( per.PersonaNombres AS VARCHAR2(4000) )) AS "NOMBRES",
TRIM(CAST( per.PersonaPrimerApellido AS VARCHAR2(4000) )) AS "PRIMER APELLIDO",
TRIM(CAST( per.PersonaSegundoApellido AS VARCHAR2(4000) )) AS "SEGUNDO APELLIDO",
TRIM(CAST( g.GeneroNombre AS VARCHAR2(4000) )) AS "GENERO",
per.PersonaEstrato AS "ESTRATO SOCIO-ECONOMICO",
ciu.CiudadID AS "CIUDADID",
TRIM(ciu.CiudadNombre) AS "CIUDAD",
depper.Departamentoid AS "DEPARTAMENTOID",
TRIM(depper.DepartamentoNombre) AS "DEPARTAMENTO",
/* CARACTERIZACION */
CAST( car.CaracterizacionNombre AS VARCHAR2(4000) ) AS "CARACTERIZACION",
/* PERFIL DE TRANSFERENCIA */
CAST( pt.PerfilTrasferenciaNombre AS VARCHAR2(4000) ) AS "PERFIL DE TRANSFERENCIA",
/* NIVEL OCUPACIONAL */
CAST(no.NivelOcupacionalNombre AS VARCHAR2(4000)) AS "NIVEL OCUPACIONAL",
/* UNIDAD TEMATICA */ ut.UnidadTematicaId AS "ID-UT",
CAST( ut.UnidadTematicaNumero AS VARCHAR2(4000) ) AS "NUMERO UNIDAD TEMATICA",
CAST( ut.UnidadTematicaNombre AS VARCHAR2(4000) ) AS "NOMBRE UNIDAD TEMATICA",
/* CRONOGRAMA */
cr.CronogramaId AS CRONOGRAMAID, /* SESION PRESENCIAL */
CAST( cp.CronogramaPresencialNumSesion AS VARCHAR2(4000) ) AS "NUMERO DE SESION / ACTIVIDAD",
cp.CronogramaPresencialNumHoras AS "NUMERO HRS SESION",
cp.CronogramaPresencialNumHoras AS "NUMERO HRS TOTALES",
/* PERFIL CAPACITADOR */
CAST( ru.RubroNombre AS VARCHAR2(4000) ) AS "PERFIL CAPACITADOR",
/* RADICADO */
NVL( CAST( crad.NumeroRadicado AS VARCHAR2(4000) ), '0' ) AS "RADICADO",
CAST( cp.CronogramaEstadoRadicado AS VARCHAR2(4000) ) AS "ESTADO RADICACION",
CAST(crad.RadicadoEstadoGeneral AS VARCHAR2(4000)) AS "ESTADO_CRONOGRAMA",
/* PRESUPUESTO */
pr.PresupuestoCofinanciacion AS "VALOR DE COFINANCIACIÓN",
pr.PresupuestoDinero AS "VALOR DE CONTRAPARTIDA EN DINERO",
pr.PresupuestoEspecie AS "VALOR DE CONTRAPARTIDA EN ESPECIE NÚMEROS",
pr.PresupuestoValorTotalProyecto AS "VALOR TOTAL DEL PROYECTO",
/* DESEMBOLSOS */
d.DesembolsosNumero AS "NÚMERO DESEMBOLSO",
d.DesembolsosPorcentaje AS "PORCENTAJE DESEMBOLSO",
d.DesembolsosValor AS "VALOR DEL DESEMBOLSO",
/* TIPO */
CAST( 'PRESENCIAL' AS VARCHAR2(20) ) AS "TIPO CRONOGRAMA",
CAST(
    TRIM(
        TRIM(pcap.PersonaNombres) || ' ' ||
        TRIM(pcap.PersonaPrimerApellido) || ' ' ||
        TRIM(pcap.PersonaSegundoApellido)
    ) AS VARCHAR2(4000)
) AS "CAPACITADOR",

CAST(pcap.PersonaIdentificacion AS VARCHAR2(4000))
    AS "DOCUMENTO CAPACITADOR"
FROM Proyecto p
INNER JOIN Convocatoria c ON c.ConvocatoriaId = p.ConvocatoriaId
INNER JOIN Cronograma cr ON cr.CronoProyecto = p.ProyectoId
INNER JOIN AFGrupo ag ON ag.AFGrupoId = cr.AFGrupoId
INNER JOIN AccionFormacion af ON af.AccionFormacionId = ag.AccionFormacionId
INNER JOIN ModalidadFormacion mf ON mf.ModalidadFormacionId = af.ModalidadFormacionId
LEFT JOIN TipoEvento te ON te.TipoEventoId = af.TipoEventoId
LEFT JOIN Departamentos dep ON dep.AFGrupoId = ag.AFGrupoId
LEFT JOIN UnidadTematica ut ON ut.UnidadTematicaId = cr.UnidadTematicaId
/* PRESENCIAL */
INNER JOIN CronogramaPresencial cp ON cp.CronogramaId = cr.CronogramaId
/* CAPACITADOR */
LEFT JOIN Capacitadores capa ON capa.CapacitadorId = cp.CronogramaPresencialCapaId
LEFT JOIN Persona capper ON capper.PersonaId = capa.CapacitadorPersonaId
/* PERFIL CAPACITADOR */
LEFT JOIN PerfilUT put ON put.PerfilUTId = cp.CronogramaPrePerfilUTId
LEFT JOIN Rubro ru ON ru.RubroId = put.RubroIdUT
/* RADICADO */
LEFT JOIN CronogramaRadicado crad ON crad.RadicadoId = cp.CronogramaPresencialRadicadoId
/* BENEFICIARIOS */
LEFT JOIN AFGrupoBeneficiario agb ON agb.AFGrupoId = ag.AFGrupoId
LEFT JOIN Persona per ON per.PersonaId = agb.PersonaId
LEFT JOIN Genero g ON g.GeneroId = per.GeneroId
LEFT JOIN Ciudad ciu ON ciu.ciudadid = per.ciudadid
LEFT JOIN Departamento depper
    ON depper.DepartamentoId = ciu.DepartamentoId
/* POSTULACION */
LEFT JOIN Postulacion pos ON pos.PersonaId = per.PersonaId
LEFT JOIN NivelOcupacional no
    ON no.NivelOcupacionalId = pos.NivelOcupacionalId
LEFT JOIN PerfilTrasferencia pt ON pt.PerfilTrasferenciaId = pos.PerfilTrasferenciaId
LEFT JOIN Caracterizacion car ON car.CaracterizacionId = pos.CaracterizacionId
/* PRESUPUESTO */
LEFT JOIN Presupuesto pr ON pr.ProyectoId = p.ProyectoId
/* DESEMBOLSOS */
LEFT JOIN Desembolsos d ON d.ProyectoId = p.ProyectoId
LEFT JOIN Capacitadores capa ON capa.CapacitadorId = cp.CronogramaPresencialCapaId
LEFT JOIN Persona pcap ON pcap.PersonaId = capa.CapacitadorPersonaId
WHERE p.ConvocatoriaId = 9
AND af.AccionFormacionTransferencia = 2
AND TRIM(cp.CronogramaPresencialSigla) IS NOT NULL UNION ALL
/* ============================================================
BLOQUE VIRTUAL
============================================================ */
SELECT /* CONVOCATORIA */ p.ConvocatoriaId AS "convocatoriaId",
CAST( TRIM(c.ConvocatoriaNombre) AS VARCHAR2(4000) ) AS "CONVOCATORIA",
/* PROYECTO */
p.ProyectoId AS PROYECTOID, CAST( p.ProyectoNombre AS VARCHAR2(4000) ) AS "PROYECTO",
/* ACCION DE FORMACION */
af.AccionFormacionId AS "ID-AF",
CAST( af.AccionFormacionNombre AS VARCHAR2(4000) ) AS "AF",
af.AccionFormacionNumBenef AS "#BENEFICIARIOS",
CAST( mf.ModalidadFormacionNombre AS VARCHAR2(4000) ) AS "MODALIDAD DE FORMACION",
CAST( te.TipoEventoNombre AS VARCHAR2(4000) ) AS "EVENTO",
CAST( ag.AFGrupoNumero AS VARCHAR2(4000) ) AS "GRUPO",
af.AccionFormacionTransferencia AS "ESTRANSFERENCIA",
/* BENEFICIARIO */
agb.PersonaId AS "PERSONAID",
CAST(agb.afgrupobeneestado AS VARCHAR2(4000) ) AS "ESTADO BENEFICIARIO",
CAST(agb.CERTIFICA AS VARCHAR2(4000) ) AS "CERTIFICA",
CAST(agb.validacioninterventor AS VARCHAR2(4000) ) AS "ESTADO INTERVENTORIA",
TRIM(CAST( per.PersonaNombres AS VARCHAR2(4000) )) AS "NOMBRES",
TRIM(CAST( per.PersonaPrimerApellido AS VARCHAR2(4000) )) AS "PRIMER APELLIDO",
TRIM(CAST( per.PersonaSegundoApellido AS VARCHAR2(4000) )) AS "SEGUNDO APELLIDO",
TRIM(CAST( g.GeneroNombre AS VARCHAR2(4000) )) AS "GENERO",
per.PersonaEstrato AS "ESTRATO SOCIO-ECONOMICO",
ciu.CiudadID AS "CIUDADID",
TRIM(ciu.CiudadNombre) AS "CIUDAD",
depper.Departamentoid AS "DEPARTAMENTOID",
TRIM(depper.DepartamentoNombre) AS "DEPARTAMENTO",
/* CARACTERIZACION */
CAST( car.CaracterizacionNombre AS VARCHAR2(4000) ) AS "CARACTERIZACION",
/* PERFIL DE TRANSFERENCIA */
CAST( pt.PerfilTrasferenciaNombre AS VARCHAR2(4000) ) AS "PERFIL DE TRANSFERENCIA",
CAST(no.NivelOcupacionalNombre AS VARCHAR2(4000)) AS "NIVEL OCUPACIONAL",
/* UNIDAD TEMATICA */
ut.UnidadTematicaId AS "ID-UT",
CAST( ut.UnidadTematicaNumero AS VARCHAR2(4000) ) AS "NUMERO UNIDAD TEMATICA",
CAST( ut.UnidadTematicaNombre AS VARCHAR2(4000) ) AS "NOMBRE UNIDAD TEMATICA",
/* CRONOGRAMA */
cr.CronogramaId AS "CRONOGRAMAID",
/* SESION VIRTUAL */
CAST( cv.CronogramaVirtualNumSesion AS VARCHAR2(4000) ) AS "NUMERO DE SESION / ACTIVIDAD",
cv.CronogramaVirtualNumHoras AS "NUMERO HRS SESION",
cv.CronogramaVirtualNumHoras AS "NUMERO HRS TOTALES",
/* PERFIL CAPACITADOR */
CAST( ru.RubroNombre AS VARCHAR2(4000) ) AS "PERFIL CAPACITADOR",
/* RADICADO */
NVL( CAST( crad.NumeroRadicado AS VARCHAR2(4000) ), '0' ) AS "RADICADO",
CAST( cv.CronogramaVirEstadoRadicado AS VARCHAR2(4000) ) AS "ESTADO RADICACION",
CAST( crad.RadicadoEstadoGeneral AS VARCHAR2(4000) ) AS "ESTADO_CRONOGRAMA",
/* PRESUPUESTO */
pr.PresupuestoCofinanciacion AS "VALOR DE COFINANCIACIÓN",
pr.PresupuestoDinero AS "VALOR DE CONTRAPARTIDA EN DINERO",
pr.PresupuestoEspecie AS "VALOR DE CONTRAPARTIDA EN ESPECIE NÚMEROS",
pr.PresupuestoValorTotalProyecto AS "VALOR TOTAL DEL PROYECTO",
/* DESEMBOLSOS */ d.DesembolsosNumero AS "NÚMERO DESEMBOLSO",
d.DesembolsosPorcentaje AS "PORCENTAJE DESEMBOLSO",
d.DesembolsosValor AS "VALOR DEL DESEMBOLSO",
/* TIPO */
CAST( 'VIRTUAL' AS VARCHAR2(20) ) AS "TIPO CRONOGRAMA",
CAST(
    TRIM(
        TRIM(pcap.PersonaNombres) || ' ' ||
        TRIM(pcap.PersonaPrimerApellido) || ' ' ||
        TRIM(pcap.PersonaSegundoApellido)
    ) AS VARCHAR2(4000)
) AS "CAPACITADOR",

CAST(pcap.PersonaIdentificacion AS VARCHAR2(4000))
    AS "DOCUMENTO CAPACITADOR"
FROM Proyecto p
INNER JOIN Convocatoria c ON c.ConvocatoriaId = p.ConvocatoriaId
INNER JOIN Cronograma cr ON cr.CronoProyecto = p.ProyectoId
INNER JOIN AFGrupo ag ON ag.AFGrupoId = cr.AFGrupoId
INNER JOIN AccionFormacion af ON af.AccionFormacionId = ag.AccionFormacionId
INNER JOIN ModalidadFormacion mf ON mf.ModalidadFormacionId = af.ModalidadFormacionId
LEFT JOIN TipoEvento te ON te.TipoEventoId = af.TipoEventoId
LEFT JOIN Departamentos dep ON dep.AFGrupoId = ag.AFGrupoId
LEFT JOIN UnidadTematica ut ON ut.UnidadTematicaId = cr.UnidadTematicaId
/* VIRTUAL */
INNER JOIN CronogramaVirtual cv ON cv.CronogramaId = cr.CronogramaId
/* CAPACITADOR */
LEFT JOIN Capacitadores capa ON capa.CapacitadorId = cv.CronogramaVirCapacitadorVirtua
LEFT JOIN Persona capper ON capper.PersonaId = capa.CapacitadorPersonaId
/* PERFIL CAPACITADOR */
LEFT JOIN PerfilUT put ON put.PerfilUTId = cv.CronogramaVirPerfilUTId
LEFT JOIN Rubro ru ON ru.RubroId = put.RubroIdUT
/* RADICADO */
LEFT JOIN CronogramaRadicado crad ON crad.RadicadoId = cv.CronogramaVirtualRadicadoId
/* BENEFICIARIOS */
LEFT JOIN AFGrupoBeneficiario agb ON agb.AFGrupoId = ag.AFGrupoId
LEFT JOIN Persona per ON per.PersonaId = agb.PersonaId
LEFT JOIN Genero g ON g.GeneroId = per.GeneroId
LEFT JOIN Ciudad ciu ON ciu.ciudadid = per.ciudadid
LEFT JOIN Departamento depper
    ON depper.DepartamentoId = ciu.DepartamentoId
/* POSTULACION */
LEFT JOIN Postulacion pos ON pos.PersonaId = per.PersonaId
LEFT JOIN NivelOcupacional no
    ON no.NivelOcupacionalId = pos.NivelOcupacionalId
LEFT JOIN PerfilTrasferencia pt ON pt.PerfilTrasferenciaId = pos.PerfilTrasferenciaId
LEFT JOIN Caracterizacion car ON car.CaracterizacionId = pos.CaracterizacionId
/* PRESUPUESTO */
LEFT JOIN Presupuesto pr ON pr.ProyectoId = p.ProyectoId
/* DESEMBOLSOS */
LEFT JOIN Desembolsos d ON d.ProyectoId = p.ProyectoId
LEFT JOIN Capacitadores capa
    ON capa.CapacitadorId = cv.CronogramaVirCapacitadorVirtua

LEFT JOIN Persona pcap
    ON pcap.PersonaId = capa.CapacitadorPersonaId
WHERE p.ConvocatoriaId IN (9,10) AND af.AccionFormacionTransferencia = 2
AND TRIM(cv.CronogramaVirtualSigla) IS NOT NULL )
ORDER BY PROYECTO, "GRUPO", "NUMERO UNIDAD TEMATICA"
`
const params = []

if (convocatoriaId) {
    query += ` AND co.convocatoriaid = :1`
    params.push(convocatoriaId)
  }

  return this.ds.query(query, params)

  }
}
