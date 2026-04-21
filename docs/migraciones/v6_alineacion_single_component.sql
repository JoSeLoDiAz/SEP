-- =============================================================================
-- Migración: Componente de alineación como campo único en ACCIONFORMACION
-- Versión: 6.0
-- Fecha: 2026-04-20
-- Autor: JoSeLoDiAz
-- Descripción: Agrega ACCIONFORMACIONCOMPONENTEID a ACCIONFORMACION para
--              guardar el único componente estratégico alineado a la AF.
-- =============================================================================

ALTER TABLE ACCIONFORMACION ADD ACCIONFORMACIONCOMPONENTEID NUMBER;

ALTER TABLE ACCIONFORMACION
  ADD CONSTRAINT FK_AF_ALINEACION_COMP
  FOREIGN KEY (ACCIONFORMACIONCOMPONENTEID)
  REFERENCES AFCOMPONENTE(AFCOMPONENTEID);

COMMIT;
