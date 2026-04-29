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

-- Una sola versión FINAL por proyecto (Oracle: índice condicional con CASE).
-- Cuando VERSIONESFINAL=0 el valor indexado es NULL (no entra al unique).
CREATE UNIQUE INDEX UX_PROYECTOVERSION_FINAL
  ON PROYECTOVERSION (PROYECTOID, CASE WHEN VERSIONESFINAL = 1 THEN 1 ELSE NULL END);

-- Nota: VERSIONCODIGO ya tiene UNIQUE constraint desde v14, no se redefine.

COMMIT;
