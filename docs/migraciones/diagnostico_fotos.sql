-- Qué foto tiene cada evaluador de verdad. Solo consulta, no cambia nada.
-- Correr en PRODUCCIÓN para saber si el problema es el dato o la pantalla.
--
-- Interesa la columna ESTADO:
--   ok              la imagen está completa
--   VACÍA           la columna no es nula pero no tiene bytes: la subida se
--                   guardó a medias y hay que volver a cargarla
--   NO ES IMAGEN    se guardó otra cosa (los primeros bytes no son de JPG,
--                   PNG ni WebP)
--   sin foto        nunca se cargó

SET LINESIZE 200
SET PAGESIZE 100
COLUMN nombre  FORMAT A34
COLUMN archivo FORMAT A40
COLUMN estado  FORMAT A14
COLUMN mime    FORMAT A12

SELECT e.EVALUADORID                                        AS id,
       SUBSTR(TRIM(p.PERSONANOMBRES) || ' ' ||
              TRIM(p.PERSONAPRIMERAPELLIDO), 1, 34)         AS nombre,
       NVL(DBMS_LOB.GETLENGTH(e.EVALUADORFOTO), 0)          AS bytes,
       TRIM(e.EVALUADORFOTOMIME)                            AS mime,
       CASE
         WHEN e.EVALUADORFOTO IS NULL                     THEN 'sin foto'
         WHEN DBMS_LOB.GETLENGTH(e.EVALUADORFOTO) = 0     THEN 'VACIA'
         -- Firmas: JPG empieza FFD8, PNG 89504E47, GIF 47494638, WebP RIFF
         WHEN RAWTOHEX(DBMS_LOB.SUBSTR(e.EVALUADORFOTO, 4, 1))
              IN ('FFD8FFE0','FFD8FFE1','FFD8FFDB','FFD8FFEE')  THEN 'ok'
         WHEN RAWTOHEX(DBMS_LOB.SUBSTR(e.EVALUADORFOTO, 4, 1)) = '89504E47' THEN 'ok'
         WHEN RAWTOHEX(DBMS_LOB.SUBSTR(e.EVALUADORFOTO, 4, 1)) = '52494646' THEN 'ok'
         ELSE 'NO ES IMAGEN'
       END                                                  AS estado,
       SUBSTR(TRIM(e.EVALUADORFOTONOMBRE), 1, 40)           AS archivo
  FROM EVALUADOR e
  JOIN PERSONA   p ON p.PERSONAID = e.PERSONAID
 ORDER BY e.EVALUADORID;
