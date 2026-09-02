// El dinamizador del GGPC como fuente de retroalimentación, aparte del ciclo.
//
// Una retroalimentación siempre tiene dos participaciones detrás —quién la hizo
// y quién la recibió— porque las columnas son NOT NULL con llave foránea a
// EVALUADORPARTICIPACION. El dinamizador no es evaluador y no está inscrito en
// ningún ciclo, así que entra por una participación centinela SIN convocatoria,
// creada una sola vez por docs/migraciones/v68_dinamizador_ggpc.sql.
//
// Al no tener convocatoria queda fuera, por construcción, de todo lo que filtra
// por ella: la matriz, el tablero de avance, la lista de compañeros y los
// participantes del Excel. No hay que acordarse de excluirlo en ningún lado.
//
// Vive en su propio archivo para que lo puedan leer tanto retroalimentacion como
// evaluadores sin que los dos módulos se importen entre sí.

/** PERSONA.PERSONAIDENTIFICACION del centinela. La columna es NCHAR: siempre TRIM. */
export const IDENTIFICACION_DINAMIZADOR = 'GGPC-DINAMIZADOR'

/** Lo que se lee en pantalla y en el PDF. Nunca el nombre propio de la persona. */
export const NOMBRE_DINAMIZADOR = 'Dinamizador GGPC'

/**
 * RETROASIGNACION.ORIGEN solo acepta AUTOMATICA o MANUAL, así que el origen real
 * se marca en el motivo. Empieza por HISTORICO a propósito: es lo que hace que
 * se pueda corregir y borrar como cualquier otra cargada a mano.
 */
export const MOTIVO_DINAMIZADOR = 'HISTORICO - dinamizador GGPC'

/** Reconoce la fila del dinamizador por la identificación del centinela. */
export const ES_DINAMIZADOR_SQL = (columnaIdentificacion: string) =>
  `CASE WHEN TRIM(${columnaIdentificacion}) = '${IDENTIFICACION_DINAMIZADOR}'
        THEN 1 ELSE 0 END`
