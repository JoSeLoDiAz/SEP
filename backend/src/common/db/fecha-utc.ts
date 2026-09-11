/**
 * Hora UTC en SQL.
 *
 * SYSDATE y SYSTIMESTAMP dan la hora del sistema operativo del servidor de la base: UTC en el XE y hora de
 * Colombia (-05:00) en el Exadata. El SEP, GeneXus y el frontend guardan y leen en UTC (el backend corre con
 * TZ=UTC), así que el SEP no usa SYSDATE ni SYSTIMESTAMP: usa estas expresiones, que dan UTC en las dos bases.
 */

/** En lugar de SYSDATE, para columnas DATE. */
export const AHORA_UTC = 'CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE)'

/** En lugar de SYSTIMESTAMP, para columnas TIMESTAMP sin zona. */
export const AHORA_UTC_TS = 'SYS_EXTRACT_UTC(SYSTIMESTAMP)'
