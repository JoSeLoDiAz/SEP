-- v21_evaluador_foto_nombre.sql

ALTER TABLE EVALUADOR
  ADD (EVALUADORFOTONOMBRE VARCHAR2(255) NULL);

COMMENT ON COLUMN EVALUADOR.EVALUADORFOTONOMBRE IS
  'Nombre original del archivo de foto cargado (para Content-Disposition al descargar).';

COMMIT;
