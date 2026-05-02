-- v18_convocatoria_resultados_publicados.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Publicación de resultados de la evaluación del SENA al proponente.
--
-- La publicación NO es por proyecto: es por CONVOCATORIA. Cuando el SENA
-- termina de evaluar todos los proyectos de una convocatoria, el admin
-- "publica" la convocatoria y simultáneamente todos los proponentes de
-- esa convocatoria ven sus resultados (aprobado o rechazado, con el
-- concepto individual por AF).
--
-- Mientras la convocatoria está sin publicar, ningún proponente ve nada
-- del proceso de evaluación: cada proyecto aparece ante su proponente como
-- "Confirmado", igual a como lo dejó al crear la versión FINAL. El admin
-- puede ir aprobando o rechazando proyectos uno por uno sin que se filtre
-- información, y al final libera todo de un solo movimiento.
--
-- Bandera CONVOCATORIARESULTADOSPUBLICADOS:
--   0 → resultados aún no publicados (borrador interno SENA, todo oculto al proponente)
--   1 → publicados — los proponentes ven el resultado de su proyecto
--                    y el concepto por AF
--
-- Backfill: las convocatorias que ya tienen al menos un proyecto evaluado
-- (estados 3/4) se marcan como publicadas, para no ocultar al proponente
-- información que ya estaba visible.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE CONVOCATORIA ADD (
  CONVOCATORIARESULTADOSPUBLICADOS NUMBER(1) DEFAULT 0 NOT NULL
);

UPDATE CONVOCATORIA c
   SET CONVOCATORIARESULTADOSPUBLICADOS = 1
 WHERE EXISTS (
   SELECT 1 FROM PROYECTO p
    WHERE p.CONVOCATORIAID = c.CONVOCATORIAID
      AND p.PROYECTOESTADO IN (3, 4)
 );

COMMIT;
