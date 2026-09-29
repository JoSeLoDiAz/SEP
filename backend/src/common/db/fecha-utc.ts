/**
 * Hora UTC en SQL.
 *
 * El SEP, el SEP viejo de GeneXus y el frontend guardan y leen en UTC —el backend corre con `TZ=UTC`—, así que estas
 * dos constantes son el único sitio donde se escribe «ahora» y no se usa `now()` a pelo en ningún servicio.
 *
 * `now()` devuelve la hora con la zona del servidor de la base. `AT TIME ZONE 'UTC'` la convierte a UTC y deja un
 * `timestamp` sin zona, que es lo que guardan las 231 columnas de fecha del esquema.
 *
 * **Las dos dan lo mismo, y eso es a propósito.** En Oracle eran distintas —`DATE` y `TIMESTAMP` son tipos
 * diferentes— y el SEP tenía que elegir según la columna. En PostgreSQL las 231 columnas de fecha del esquema son
 * `timestamp without time zone`, sin una sola `date`, así que la distinción desapareció. Se conservan las dos porque
 * los 170 sitios que las usan dicen con cuál piensan, y unificarlas obligaría a tocarlos todos sin ganar nada.
 *
 * Cuidado con el `CAST(... AS DATE)`: en Oracle el `DATE` lleva hora, pero en PostgreSQL el `date` no, y el cast la
 * tira. Escrito así, cada fecha de registro se guardaba a medianoche sin dar ningún error.
 */

/** «Ahora», en UTC. Antes se escribía `CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE)`. */
export const AHORA_UTC = "CAST((now() AT TIME ZONE 'UTC') AS timestamp)"

/** «Ahora», en UTC. Antes se escribía `SYS_EXTRACT_UTC(SYSTIMESTAMP)`. */
export const AHORA_UTC_TS = "(now() AT TIME ZONE 'UTC')"

/** El día de hoy a medianoche, en UTC. Antes se escribía `TRUNC(...)`. */
export const HOY_UTC = `date_trunc('day', ${AHORA_UTC_TS})`
