import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class MaterialFormacionService {
  
constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}
  async listarMaterialFormacion(convocatoriaId?: number) {
    let query = `SELECT
    maf.MaterialAFFormacionId AS "materialid",
    c.ConvocatoriaId AS "convocatoriaid",
    c.ConvocatoriaNombre AS "convocatoria",

    p.ProyectoId AS "proyectoid",
    p.ProyectoNombre AS "proyecto",

    maf.MaterialAFFormacionFechaCon AS "fecharemisionconvenio",

    af.AccionFormacionId AS "afid",
    af.AccionFormacionNumero AS "numaf",
    af.AccionFormacionNombre AS "accionformacion",

    mf.MaterialFormacionNombre AS "materialformacion",

    maf.MaterialAFFormacionFechaRem AS "fecharadremisioninterventoria",
    maf.MaterialAFFormacionRadRem AS "remisionradinterventoria",
    maf.MaterialAFFormacionFechaRta AS "fecharespinterventoria",
    maf.MaterialAFFormacionRadRta AS "radresinterventoria",

    maf.MaterialAFFormacionFechaSena AS "fecharadsena",
    maf.MaterialAFFormacionNisSena AS "nisradsena",
    maf.MaterialAFFormacionRadSena AS "radicadosena",

    CASE maf.MaterialAFFormacionEstado
        WHEN 1 THEN 'APROBADO'
        WHEN 2 THEN 'NO APROBADO'
        WHEN 3 THEN 'SIN RESPUESTA'
        ELSE 'SIN VALIDAR'
    END AS "estado",

    pi.PersonaNombres || ' ' ||
    pi.PersonaPrimerApellido || ' ' ||
    pi.PersonaSegundoApellido AS "usuariointerventoria",

    maf.MaterialAFFormacionObserInter AS "observacioninterventoria",

    CASE maf.MaterialAFFormacionValdSena
        WHEN 1 THEN 'CUMPLE'
        WHEN 2 THEN 'NO CUMPLE'
        ELSE 'SIN VALIDAR'
    END AS "estadosena",

    maf.MaterialAFFormacionObsSena AS "observacionsena",

    ps.PersonaNombres || ' ' ||
    ps.PersonaPrimerApellido || ' ' ||
    ps.PersonaSegundoApellido AS "usuariosena",

    -- LIBRO
    CASE maf.MaterialAFFormacionLiContRele WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "librocontenidorelevante",
    CASE maf.MaterialAFFormacionLiEstruOrg WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "libroestructuraorganizacion",
    CASE maf.MaterialAFFormacionLiClaridad WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "libroclaridadcomunicacion",
    CASE maf.MaterialAFFormacionLiISBN WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "librocodigoisbn",
    CASE maf.MaterialAFFormacionLiFullCol WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "librofullcolor",
    CASE maf.MaterialAFFormacionLiProRec WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "libroproduccionreciente",
    CASE maf.MaterialAFFormacionLiAcceso WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "libroacceso",
    CASE maf.MaterialAFFormacionLiIdioma WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "libroidioma",
    CASE maf.MaterialAFFormacionLiVigencia WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "librovigencia",

    -- RECURSO DIDACTICO
    CASE maf.MaterialAFFormacionReRea WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticorealismoautenticidad",
    CASE maf.MaterialAFFormacionReInt WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticointeractividad",
    CASE maf.MaterialAFFormacionReObj WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticoobjetivoaprendizaje",
    CASE maf.MaterialAFFormacionReFle WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticoflexibilidad",
    CASE maf.MaterialAFFormacionReFe WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticofeedback",
    CASE maf.MaterialAFFormacionReSeg WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticoseguimiento",
    CASE maf.MaterialAFFormacionReAcc WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticoaccesibilidad",
    CASE maf.MaterialAFFormacionReCon WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticocontextualizacion",
    CASE maf.MaterialAFFormacionRePer WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "recursodidacticopertinencia",

    -- CARTILLA
    CASE maf.MaterialAFFormacionCaPort WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaportada",
    CASE maf.MaterialAFFormacionCaConPor WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillacontraportada",
    CASE maf.MaterialAFFormacionCaTabCon WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillatablacontenido",
    CASE maf.MaterialAFFormacionCaIntro WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaintroduccion",
    CASE maf.MaterialAFFormacionCaObje WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaobjetivo",
    CASE maf.MaterialAFFormacionCaIden WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaidentificacionconocimientos",
    CASE maf.MaterialAFFormacionCaPeda WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartilladesarrollocontenidos",
    CASE maf.MaterialAFFormacionCaGlosa WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaglosario",
    CASE maf.MaterialAFFormacionCaRef WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillareferenciasbibliograficas",
    CASE maf.MaterialAFFormacionCaFull WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillafullcolor",
    CASE maf.MaterialAFFormacionCaAuCap WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaautoriacapacitador",
    CASE maf.MaterialAFFormacionCaPro WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaproduccionreciente",
    CASE maf.MaterialAFFormacionCaCart WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillatamanocarta",
    CASE maf.MaterialAFFormacionCaPos WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaposicionvertical",
    CASE maf.MaterialAFFormacionCaPapel WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillapapel",
    CASE maf.MaterialAFFormacionCaCar WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillacaratula",
    CASE maf.MaterialAFFormacionCaEnc WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaencuadernacion",
    CASE maf.MaterialAFFormacionCaExt WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaextencionminima",
    CASE maf.MaterialAFFormacionCaImg WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "cartillaimageninstitucional",

    -- FOLLETO
    CASE maf.MaterialAFFormacionFoTi WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletotitulossubtitulos",
    CASE maf.MaterialAFFormacionFoIlus WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletoilustracioncontenido",
    CASE maf.MaterialAFFormacionFoDat WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletodatoscontacto",
    CASE maf.MaterialAFFormacionFoFull WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletofullcolor",
    CASE maf.MaterialAFFormacionFoCap WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletoautoriacapacitador",
    CASE maf.MaterialAFFormacionFoPro WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletoproduccionreciente",
    CASE maf.MaterialAFFormacionFoTam WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletotamanooficio",
    CASE maf.MaterialAFFormacionFoExt WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletoextencion",
    CASE maf.MaterialAFFormacionFoPo WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletoposicionhorizontal",
    CASE maf.MaterialAFFormacionFoPap WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletopapel",
    CASE maf.MaterialAFFormacionFoTri WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletotriptico",
    CASE maf.MaterialAFFormacionFoLen WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletolenguaje",
    CASE maf.MaterialAFFormacionFoImg WHEN 1 THEN 'CUMPLE' WHEN 2 THEN 'NO CUMPLE' WHEN 3 THEN 'N/A' ELSE '' END AS "folletoimageninstitucional"

FROM MaterialAFFormacion maf
INNER JOIN AccionFormacion af
    ON maf.AccionFormacionId = af.AccionFormacionId
INNER JOIN Proyecto p
    ON af.ProyectoId = p.ProyectoId
INNER JOIN Convocatoria c
    ON p.ConvocatoriaId = c.ConvocatoriaId
INNER JOIN MaterialFormacion mf
    ON maf.MaterialFormacionId = mf.MaterialFormacionId

LEFT JOIN Usuario ui
    ON maf.MaterialAFFormacionUsuInter = ui.UsuarioId
LEFT JOIN Persona pi
    ON ui.UsuarioEmail = pi.PersonaEmail

LEFT JOIN Usuario us
    ON maf.MaterialAFFormacionUsuSena = us.UsuarioId
LEFT JOIN Persona ps
    ON us.UsuarioEmail = ps.PersonaEmail

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
