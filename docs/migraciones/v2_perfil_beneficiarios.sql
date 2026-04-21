-- =============================================================================
-- Migración: Perfil de Beneficiarios de Acción de Formación
-- Versión: 2.0
-- Fecha: 2026-04-20
-- Autor: JoSeLoDiAz
-- Descripción: Agrega las columnas de economía campesina (justificación)
--              y economía popular (número + justificación) a la tabla
--              ACCIONFORMACION. Las tablas relacionadas (AREAFUNCIONAL,
--              AFAREAFUNCIONAL, NIVELOCUPACIONAL, AFNIVELOCUPACIONAL,
--              OCUPACIONCUOC, OCUPACIONCOUCAF, AFENFOQUE, SECTORAF,
--              SUBSECTORAF, AFPSECTOR, AFPSUBSECTOR, AFSECTOR, AFSUBSECTOR,
--              y columna ACCIONFORMACIONSECSUBD) ya existen en el modelo original.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACCIONFORMACION — Columnas nuevas para economía campesina y popular
--    Verificación previa:
--      SELECT COLUMN_NAME FROM USER_TAB_COLUMNS
--      WHERE TABLE_NAME='ACCIONFORMACION'
--      AND COLUMN_NAME IN ('ACCIONFORMACIONJUSTCAMPESINO',
--                          'ACCIONFORMACIONNUMPOPULAR',
--                          'ACCIONFORMACIONJUSTPOPULAR');
-- ─────────────────────────────────────────────────────────────────────────────

-- Justificación de trabajadores de la Economía Campesina
ALTER TABLE ACCIONFORMACION ADD ACCIONFORMACIONJUSTCAMPESINO NCLOB;

-- Número de trabajadores de la Economía Popular
ALTER TABLE ACCIONFORMACION ADD ACCIONFORMACIONNUMPOPULAR NUMBER;

-- Justificación de trabajadores de la Economía Popular
ALTER TABLE ACCIONFORMACION ADD ACCIONFORMACIONJUSTPOPULAR NCLOB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TIPOEVENTO — Inactivar eventos no usados y renombrar eventos tipo Taller
--    Verificación previa:
--      SELECT TIPOEVENTOID, TIPOEVENTONOMBRE, TIPOEVENTOACTIVO
--      FROM TIPOEVENTO ORDER BY TIPOEVENTOID;
-- ─────────────────────────────────────────────────────────────────────────────

-- Ampliar columna para nombres más largos
ALTER TABLE TIPOEVENTO MODIFY (TIPOEVENTONOMBRE NCHAR(50));

-- Inactivar "Maximizando tu proceso" (ID 7) y "Campamento de Formación" (ID 10)
UPDATE TIPOEVENTO SET TIPOEVENTOACTIVO = 0 WHERE TIPOEVENTOID IN (7, 10);

-- Renombrar eventos tipo Taller
UPDATE TIPOEVENTO SET TIPOEVENTONOMBRE = 'Taller - Puesto de trabajo real' WHERE TIPOEVENTOID = 8;
UPDATE TIPOEVENTO SET TIPOEVENTONOMBRE = 'Taller - Bootcamp'               WHERE TIPOEVENTOID = 9;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AFENFOQUE — Inactivar "Formación Internacional" (ID 4)
--    Verificación previa:
--      SELECT AFENFOQUEID, AFENFOQUENOMBRE, AFENFOQUEESTADO FROM AFENFOQUE ORDER BY AFENFOQUEID;
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE AFENFOQUE SET AFENFOQUEESTADO = 0 WHERE AFENFOQUEID = 4;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SECTORAF / SUBSECTORAF — Inactivar opción "OTRO"
--    Verificación previa:
--      SELECT SECTORAFID, SECTORAFNOMBRE, SECTORAFESTADO FROM SECTORAF ORDER BY SECTORAFID;
--      SELECT SUBSECTORAFID, SUBSECTORAFNOMBRE, SUBSECTORAFESTADO FROM SUBSECTORAF ORDER BY SUBSECTORAFID;
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE SECTORAF    SET SECTORAFESTADO    = 0 WHERE SECTORAFID    = 22;
UPDATE SUBSECTORAF SET SUBSECTORAFESTADO = 0 WHERE SUBSECTORAFID = 21;

COMMIT;
