-- v15_proyecto_version_final_anulada.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Etapa 3 del control de versiones del proyecto.
--
-- Agrega dos conceptos a PROYECTOVERSION:
--
--   1) VERSIONESFINAL: marca cuál de las versiones del proyecto es la
--      "oficial" enviada a SECOP. Solo puede haber UNA versión final por
--      proyecto (unique index condicional). Mientras una versión esté
--      marcada como final, el proyecto no se puede desconfirmar ni editar.
--
--   2) VERSIONANULADA: soft-delete de versiones obsoletas (borradores
--      intermedios). La versión queda en histórico pero deja de
--      considerarse para "última versión". No se puede anular la versión
--      marcada como FINAL.
--
-- Las versiones existentes parten con VERSIONESFINAL=0 y VERSIONANULADA=0.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE PROYECTOVERSION ADD (
  VERSIONESFINAL       NUMBER(1)    DEFAULT 0 NOT NULL,
  VERSIONANULADA       NUMBER(1)    DEFAULT 0 NOT NULL,
  VERSIONFINALFECHA    TIMESTAMP    NULL,
  VERSIONFINALUSUARIO  VARCHAR2(200) NULL,
  VERSIONANULADAFECHA  TIMESTAMP    NULL,
  VERSIONANULADAUSUARIO VARCHAR2(200) NULL
);

-- Una sola versión FINAL por proyecto.
-- Patrón de "índice único parcial" en Oracle: cuando VERSIONESFINAL != 1 el
-- valor indexado es NULL en un índice mono-columna, por lo que la fila NO
-- entra al índice (Oracle no indexa filas con valor NULL en un índice de una
-- sola columna). Cuando VERSIONESFINAL = 1 el valor indexado es PROYECTOID,
-- garantizando unicidad por proyecto.
--
-- Nota: NO usar la variante compuesta (PROYECTOID, CASE…) — en Oracle ese
-- patrón sigue indexando filas con NULL en la 2ª columna y enforza uniqueness
-- sobre PROYECTOID solo, bloqueando cualquier 2ª versión del mismo proyecto.
CREATE UNIQUE INDEX UX_PROYECTOVERSION_FINAL
  ON PROYECTOVERSION (CASE WHEN VERSIONESFINAL = 1 THEN PROYECTOID ELSE NULL END);

-- Nota: VERSIONCODIGO ya tiene UNIQUE constraint desde v14, no se redefine.

COMMIT;
