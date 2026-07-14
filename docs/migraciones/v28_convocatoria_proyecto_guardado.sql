-- v28_convocatoria_proyecto_guardado.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Banco de proyectos GUARDADOS de una convocatoria (SIN importarlos al sistema).
--
-- Objetivo: poder guardar toda la información de un proyecto formulado (el mismo
-- JSON del preview del importador) asociada a una convocatoria, para luego ver un
-- reporte general filtrable y descargar una sábana (Excel) de acciones de
-- formación, unidades temáticas, actividades y rubros — todo sin crear EMPRESA,
-- USUARIO ni PROYECTO reales.
--
-- Diseño:
--   - CONVPROYGUARDADO — una fila por proyecto guardado. Columnas clave para
--     filtrar/reportar + DATOSJSON (CLOB) con TODO el proyecto (PreviewImportacion).
--   - CONVPROYGUARDADO_SEQ — secuencia para el id.
--
-- Idempotente: q-strings + EXCEPTION para ORA-00955 (ya existe), ORA-01408
-- (columna ya indexada). Ejecutar como SEPLOCAL en SQL Developer.
-- ──────────────────────────────────────────────────────────────────────────


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 1. CONVPROYGUARDADO — proyectos guardados de la convocatoria             ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE CONVPROYGUARDADO (
    GUARDADOID       NUMBER(10)      NOT NULL,
    CONVOCATORIAID   NUMBER(10)      NOT NULL,
    NIT              NVARCHAR2(30),
    RAZONSOCIAL      NVARCHAR2(300),
    NOMBREPROYECTO   NVARCHAR2(400),
    MODALIDAD        NVARCHAR2(60),
    NUMAF            NUMBER(6)       DEFAULT 0 NOT NULL,
    NUMBENEF         NUMBER(10)      DEFAULT 0 NOT NULL,
    VALORTOTAL       NUMBER(18,2)    DEFAULT 0 NOT NULL,
    COFINSENA        NUMBER(18,2)    DEFAULT 0 NOT NULL,
    USUARIOID        NUMBER(10),
    FECHAGUARDADO    DATE            DEFAULT SYSDATE NOT NULL,
    DATOSJSON        CLOB            NOT NULL,
    CONSTRAINT PK_CONVPROYGUARDADO PRIMARY KEY (GUARDADOID)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Secuencia                                                             ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE CONVPROYGUARDADO_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Índices                                                               ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_CPG_CONV ON CONVPROYGUARDADO (CONVOCATORIAID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 4. GRANTS y SINÓNIMOS                                                    ║
-- ╚════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT, UPDATE, DELETE ON CONVPROYGUARDADO TO SEP_APP;
GRANT SELECT                         ON CONVPROYGUARDADO TO SEP_LECTOR;
GRANT SELECT                         ON CONVPROYGUARDADO_SEQ TO SEP_APP;

CREATE OR REPLACE SYNONYM SEP_APP.CONVPROYGUARDADO       FOR SEPLOCAL.CONVPROYGUARDADO;
CREATE OR REPLACE SYNONYM SEP_APP.CONVPROYGUARDADO_SEQ   FOR SEPLOCAL.CONVPROYGUARDADO_SEQ;
CREATE OR REPLACE SYNONYM SEP_LECTOR.CONVPROYGUARDADO    FOR SEPLOCAL.CONVPROYGUARDADO;

COMMIT;
