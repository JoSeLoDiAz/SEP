-- =============================================================================
-- Migración: Justificación por grupo en AFGRUPO
-- Versión: 7.0
-- Fecha: 2026-04-20
-- Autor: JoSeLoDiAz
-- Descripción: Agrega AFGRUPOJUSTIFICACION a AFGRUPO para registrar la
--              justificación de cobertura por grupo (única por grupo).
-- =============================================================================

ALTER TABLE AFGRUPO ADD AFGRUPOJUSTIFICACION NVARCHAR2(3000);

COMMIT;
