-- v23_evaluador_documento_tipos_extra.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Fase 2 del módulo Evaluadores — carga el resto de tipos de documento del
-- catálogo TIPODOCUMENTOEVAL. Todos con ADMITEMULTIPLE = 1 (pueden repetirse
-- por evaluador).
--
-- La v22 sembró id=1 (CEDULA). Esta migración agrega ids 2..6.
--
-- Idempotente: cada INSERT usa WHERE NOT EXISTS sobre CODIGO (que es UNIQUE),
-- así que reejecutar el script no produce errores ni duplicados.
--
-- Ejecutar como SEPLOCAL (owner del schema).
-- ──────────────────────────────────────────────────────────────────────────


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Seed idempotente de tipos de documento (Fase 2)                         ║
-- ╚════════════════════════════════════════════════════════════════════════╝

INSERT INTO TIPODOCUMENTOEVAL (TIPODOCUMENTOEVALID, CODIGO, NOMBRE, ADMITEMULTIPLE, ORDEN)
  SELECT 2, N'AUTORIZACION', N'Correo de autorización', 1, 20 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM TIPODOCUMENTOEVAL WHERE CODIGO = N'AUTORIZACION');

INSERT INTO TIPODOCUMENTOEVAL (TIPODOCUMENTOEVALID, CODIGO, NOMBRE, ADMITEMULTIPLE, ORDEN)
  SELECT 3, N'CONFIDENCIALIDAD', N'Acuerdo de confidencialidad', 1, 30 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM TIPODOCUMENTOEVAL WHERE CODIGO = N'CONFIDENCIALIDAD');

INSERT INTO TIPODOCUMENTOEVAL (TIPODOCUMENTOEVALID, CODIGO, NOMBRE, ADMITEMULTIPLE, ORDEN)
  SELECT 4, N'EXPERIENCIA_PROFESIONAL', N'Experiencia laboral profesional', 1, 40 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM TIPODOCUMENTOEVAL WHERE CODIGO = N'EXPERIENCIA_PROFESIONAL');

INSERT INTO TIPODOCUMENTOEVAL (TIPODOCUMENTOEVALID, CODIGO, NOMBRE, ADMITEMULTIPLE, ORDEN)
  SELECT 5, N'EXPERIENCIA_PROYECTOS', N'Experiencia laboral en proyectos', 1, 50 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM TIPODOCUMENTOEVAL WHERE CODIGO = N'EXPERIENCIA_PROYECTOS');

INSERT INTO TIPODOCUMENTOEVAL (TIPODOCUMENTOEVALID, CODIGO, NOMBRE, ADMITEMULTIPLE, ORDEN)
  SELECT 6, N'CERTIFICADO_PARTICIPACION', N'Certificado de participación en evaluación', 1, 60 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM TIPODOCUMENTOEVAL WHERE CODIGO = N'CERTIFICADO_PARTICIPACION');


COMMIT;
