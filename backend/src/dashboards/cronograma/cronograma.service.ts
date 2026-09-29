import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class CronogramaService {

constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarCronograma(convocatoriaId?: number) {
    // NOTA: consulta recortada a las columnas y joins que consume el tablero.
    // Se eliminaron nombres de capacitadores/suplentes, tipos de documento,
    // perfiles y demás columnas no usadas para aligerar el payload y evitar
    // el timeout (el reporte es voluminoso a nivel de sesión).
    let query = `WITH Departamentos AS (
    SELECT
        agc.AFGrupoId,
        CAST(
            TRIM(LISTAGG('DEPARTAMENTO: ' || TRIM(d.DepartamentoNombre), ' - ')
            WITHIN GROUP (ORDER BY d.DepartamentoNombre)) AS VARCHAR2(4000)
        ) AS departamentosfinal,
        SUM(agc.AFGrupoCoberturaBenef) AS totalbeneficiarios,
        CAST(
            TRIM(LISTAGG(c.CiudadNombre, ', ')
            WITHIN GROUP (ORDER BY c.CiudadNombre)) AS VARCHAR2(4000)
        ) AS ciudadesfinal
    FROM AFGrupoCobertura agc
    INNER JOIN Departamento d ON d.DepartamentoId = agc.DepartamentoGrupoId
    LEFT JOIN Ciudad c ON c.CiudadId = agc.CiudadGrupoId
    GROUP BY agc.AFGrupoId
)

SELECT * FROM (
    ------------------------------------------------------------------
    -- 🟢 BLOQUE PRESENCIAL
    ------------------------------------------------------------------
    SELECT
        CAST(pro.ProyectoId AS VARCHAR2(4000)) AS "proyectoid",
        CAST(TRIM(con.ConvocatoriaId) AS VARCHAR2(4000)) AS "convocatoriaid",
        CAST(TRIM(con.ConvocatoriaNombre) AS VARCHAR2(4000)) AS "convocatoria",
        CAST(pro.ProyectoNombre AS VARCHAR2(4000)) AS "proyecto",
        CAST(af.AccionFormacionId AS VARCHAR2(4000)) AS "afid",
        CAST(af.AccionFormacionNombre AS VARCHAR2(4000)) AS "accionformacion",
        CAST(mf.ModalidadFormacionNombre AS VARCHAR2(4000)) AS "modalidad",
        CAST(ag.AFGrupoNumero AS VARCHAR2(4000)) AS "grupo",
        dep.TotalBeneficiarios AS "beneficiariosporgrupo",
        CAST(ut.UnidadTematicaNumero AS VARCHAR2(4000)) AS "numunidadtematica",
        CAST(cp.CronogramaPresencialNumSesion AS VARCHAR2(4000)) AS "numsesionactividad",
        cp.CronogramaPresencialFechaInici AS "fechainicio",
        cp.CronogramaPresencialFechaInici AS "fechafin",
        cp.CronogramaPresencialNumHoras AS "numhorastotales",
        CAST(p.PersonaIdentificacion AS VARCHAR2(4000)) AS "numdocumento",
        NVL(CAST(crad.NumeroRadicado AS VARCHAR2(4000)), '0') AS "radicado",
        TRIM(CAST(dep.departamentosfinal AS VARCHAR2(4000))) AS "coberturagrupo",
        CAST('PRESENCIAL' AS VARCHAR2(20)) AS "tipocronograma",
        CAST(crad.cronogramaradicadointer AS VARCHAR2(4000)) AS "radicadointerventoria",
        CAST(crad.cronogramaradicadosena AS VARCHAR2(4000)) AS "radicadosena",
        crad.cronogramaradicadosenafecha AS "fecharadicadosena",
        crad.cronogramaradicadofecharemi AS "fecharemision",
        crad.cronogramaradicadointerfecha AS "fecharadinterventoria",
        CAST(crad.radicadoestadogeneral AS VARCHAR2(4000)) AS "estadocronograma",
        CAST(crad.cronogramaradicadotransferenci AS NUMBER(1)) AS "cronogramatransferencia"
    FROM Proyecto pro
    INNER JOIN Convocatoria con ON con.ConvocatoriaId = pro.ConvocatoriaId
    INNER JOIN Cronograma cr ON cr.CronoProyecto = pro.ProyectoId
    INNER JOIN AFGrupo ag ON ag.AFGrupoId = cr.AFGrupoId
    INNER JOIN AccionFormacion af ON af.AccionFormacionId = ag.AccionFormacionId
    INNER JOIN ModalidadFormacion mf ON mf.ModalidadFormacionId = af.ModalidadFormacionId
    LEFT JOIN Departamentos dep ON dep.AFGrupoId = ag.AFGrupoId
    LEFT JOIN UnidadTematica ut ON ut.UnidadTematicaId = cr.UnidadTematicaId
    LEFT JOIN CronogramaPresencial cp ON cp.CronogramaId = cr.CronogramaId
    LEFT JOIN Capacitadores capa ON capa.CapacitadorId = cp.CronogramaPresencialCapaId
    LEFT JOIN Persona p ON p.PersonaId = capa.CapacitadorPersonaId
    LEFT JOIN CronogramaRadicado crad ON crad.RadicadoId = cp.CronogramaPresencialRadicadoId
    WHERE con.ConvocatoriaId IN (9, 10) AND TRIM(cp.CronogramaPresencialSigla) IS NOT NULL

    UNION ALL

    ------------------------------------------------------------------
    -- 🔵 BLOQUE VIRTUAL
    ------------------------------------------------------------------
    SELECT
        CAST(pro.ProyectoId AS VARCHAR2(4000)) AS "proyectoid",
        CAST(TRIM(con.ConvocatoriaId) AS VARCHAR2(4000)) AS "convocatoriaid",
        CAST(TRIM(con.ConvocatoriaNombre) AS VARCHAR2(4000)) AS "convocatoria",
        CAST(pro.ProyectoNombre AS VARCHAR2(4000)) AS "proyecto",
        CAST(af.AccionFormacionId AS VARCHAR2(4000)) AS "afid",
        CAST(af.AccionFormacionNombre AS VARCHAR2(4000)) AS "accionformacion",
        CAST(mf.ModalidadFormacionNombre AS VARCHAR2(4000)) AS "modalidad",
        CAST(ag.AFGrupoNumero AS VARCHAR2(4000)) AS "grupo",
        dep.TotalBeneficiarios AS "beneficiariosporgrupo",
        CAST(ut.UnidadTematicaNumero AS VARCHAR2(4000)) AS "numunidadtematica",
        CAST(cv.CronogramaVirtualNumSesion AS VARCHAR2(4000)) AS "numsesionactividad",
        cv.CronogramaVirtualFechaInicio AS "fechainicio",
        cv.CronogramaVirtualFechaFinal AS "fechafin",
        cv.CronogramaVirtualNumHoras AS "numhorastotales",
        CAST(p.PersonaIdentificacion AS VARCHAR2(4000)) AS "numdocumento",
        NVL(CAST(crad.NumeroRadicado AS VARCHAR2(4000)), '0') AS "radicado",
        TRIM(CAST(dep.departamentosfinal AS VARCHAR2(4000))) AS "coberturagrupo",
        CAST('VIRTUAL' AS VARCHAR2(20)) AS "tipocronograma",
        CAST(crad.cronogramaradicadointer AS VARCHAR2(4000)) AS "radicadointerventoria",
        CAST(crad.cronogramaradicadosena AS VARCHAR2(4000)) AS "radicadosena",
        crad.cronogramaradicadosenafecha AS "fecharadicadosena",
        crad.cronogramaradicadofecharemi AS "fecharemision",
        crad.cronogramaradicadointerfecha AS "fecharadinterventoria",
        CAST(crad.radicadoestadogeneral AS VARCHAR2(4000)) AS "estadocronograma",
        CAST(crad.cronogramaradicadotransferenci AS NUMBER(1)) AS "cronogramatransferencia"
    FROM Proyecto pro
    INNER JOIN Convocatoria con ON con.ConvocatoriaId = pro.ConvocatoriaId
    INNER JOIN Cronograma cr ON cr.CronoProyecto = pro.ProyectoId
    INNER JOIN AFGrupo ag ON ag.AFGrupoId = cr.AFGrupoId
    INNER JOIN AccionFormacion af ON af.AccionFormacionId = ag.AccionFormacionId
    INNER JOIN ModalidadFormacion mf ON mf.ModalidadFormacionId = af.ModalidadFormacionId
    LEFT JOIN Departamentos dep ON dep.AFGrupoId = ag.AFGrupoId
    LEFT JOIN UnidadTematica ut ON ut.UnidadTematicaId = cr.UnidadTematicaId
    LEFT JOIN CronogramaVirtual cv ON cv.CronogramaId = cr.CronogramaId
    LEFT JOIN Capacitadores capa ON capa.CapacitadorId = cv.CronogramaVirCapacitadorVirtua
    LEFT JOIN Persona p ON p.PersonaId = capa.CapacitadorPersonaId
    LEFT JOIN CronogramaRadicado crad ON crad.RadicadoId = cv.CronogramaVirtualRadicadoId
    WHERE pro.ConvocatoriaId IN (9, 10) AND TRIM(cv.CronogramaVirtualSigla) IS NOT NULL
)
ORDER BY "proyecto", "grupo", "numunidadtematica", "fechainicio"
`
const params = []

if (convocatoriaId) {
    query += ` AND co.convocatoriaid = :1`
    params.push(convocatoriaId)
  }

  return this.ds.query(query, params)

  }
}
