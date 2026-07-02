-- v21_evaluador_foto_nombre.sql
-- Agrega la columna EVALUADORFOTONOMBRE para conservar el nombre original
-- del archivo cargado como foto del evaluador. Se usa al descargar la foto
-- via Content-Disposition: attachment; filename="...".
--
-- Ejecutar como SEPLOCAL (owner del schema).

ALTER TABLE EVALUADOR
  ADD (EVALUADORFOTONOMBRE VARCHAR2(255) NULL);

COMMENT ON COLUMN EVALUADOR.EVALUADORFOTONOMBRE IS
  'Nombre original del archivo de foto cargado (para Content-Disposition al descargar).';

COMMIT;
