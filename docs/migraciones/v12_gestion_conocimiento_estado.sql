-- v12_gestion_conocimiento_estado.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Agrega el campo GESTIONCONOCIMIENTOESTADO al catálogo y normaliza el
-- listado para que coincida con el formulario oficial del VBA del MinTrabajo
-- (4 ítems estándar: INFOGRAFÍA, ARTÍCULO, VIDEO, PODCAST).
--
-- El catálogo previo (IDs 1..6) se conserva con ESTADO=0 para no romper
-- las FK existentes en AFGESTIONCONOCIMIENTO.
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Columna ESTADO: 1 = activa, 0 = inactiva.
ALTER TABLE GESTIONCONOCIMIENTO
  ADD GESTIONCONOCIMIENTOESTADO NUMBER(1) DEFAULT 1 NOT NULL;

-- 2) Inactivar el catálogo legacy (preservadas como referencia histórica).
UPDATE GESTIONCONOCIMIENTO SET GESTIONCONOCIMIENTOESTADO = 0;

-- 3) Insertar las 4 opciones oficiales (VBA MinTrabajo).
--    IDs 7..10 (siguientes al máximo actual = 6).
INSERT INTO GESTIONCONOCIMIENTO (GESTIONCONOCIMIENTOID, GESTIONCONOCIMIENTONOMBRE, GESTIONCONOCIMIENTOESTADO)
  VALUES (7, 'INFOGRAFÍA', 1);
INSERT INTO GESTIONCONOCIMIENTO (GESTIONCONOCIMIENTOID, GESTIONCONOCIMIENTONOMBRE, GESTIONCONOCIMIENTOESTADO)
  VALUES (8, 'ARTÍCULO', 1);
INSERT INTO GESTIONCONOCIMIENTO (GESTIONCONOCIMIENTOID, GESTIONCONOCIMIENTONOMBRE, GESTIONCONOCIMIENTOESTADO)
  VALUES (9, 'VIDEO', 1);
INSERT INTO GESTIONCONOCIMIENTO (GESTIONCONOCIMIENTOID, GESTIONCONOCIMIENTONOMBRE, GESTIONCONOCIMIENTOESTADO)
  VALUES (10, 'PODCAST', 1);

COMMIT;
