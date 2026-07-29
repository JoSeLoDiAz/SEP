-- v35_evaluador_log.sql
-- ──────────────────────────────────────────────────────────────────────────
-- EVALUADORLOG — auditoría del banco de evaluadores.
--
-- Calcado de EJECUCIONLOG (v17), que ya está probado en producción para el
-- módulo de ejecución de proyectos. Misma forma: tabla afectada, operación,
-- id del registro, usuario, perfil, fecha y snapshots antes/después.
--
-- ¿Por qué hace falta? El módulo pasa a guardar autorizaciones de jefes,
-- calificaciones de desempeño y emisión de certificados. Sin traza no hay
-- forma de responder "¿quién cambió esta nota?" ni "¿quién borró esta
-- participación?", y son exactamente las preguntas que va a hacer la
-- coordinación.
--
-- QUÉ SE LOGGEA (decisión de aplicación, no de BD):
--   - EVALUADORAPROBACION      → INSERT / UPDATE / DELETE
--   - EVALUADORCAPACITACION    → UPDATE de CALIFICACION o APROBADO
--   - EVALUADORPARTICIPACION   → cambio de ESTADOPARTID y DELETE
--   - EVALUADORPRUEBA          → UPDATE de PUNTAJEMAYOR y DELETE
--   - RETRORESPUESTA / ITEM    → cualquier UPDATE o DELETE posterior al envío
--   - RETROASIGNACION          → generación y anulación de la matriz
--   - Emisión de certificados
--   NO se loggean los cargues de documentos ni las lecturas: ruido sin valor.
--
-- ACCESO: la coordinación (perfil 2) consulta el log en modo lectura desde el
-- panel; el admin (perfil 1) además puede exportarlo. Nadie puede escribir
-- ni borrar filas de esta tabla desde la aplicación.
--
-- Idempotente. Ejecutar como SEPLOCAL.
-- ──────────────────────────────────────────────────────────────────────────


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Tabla                                                                ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE EVALUADORLOG (
    EVALUADORLOGID    NUMBER(10)      NOT NULL,
    EVALUADORID       NUMBER(10),
    PARTICIPACIONID   NUMBER(10),
    TABLA             NVARCHAR2(60)   NOT NULL,
    OPERACION         NVARCHAR2(20)   NOT NULL,
    REGISTROID        NUMBER(10),
    USUARIOEMAIL      NVARCHAR2(200)  NOT NULL,
    USUARIOPERFILID   NUMBER(10),
    FECHA             TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
    COMENTARIO        NVARCHAR2(1000),
    VALORANTES        NCLOB,
    VALORDESPUES      NCLOB,
    CONSTRAINT PK_EVALUADORLOG PRIMARY KEY (EVALUADORLOGID),
    CONSTRAINT CK_EVALLOG_OPER CHECK (
      OPERACION IN (N'INSERT', N'UPDATE', N'DELETE', N'ESTADO', N'GENERAR', N'ANULAR', N'EMITIR')
    )
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON TABLE EVALUADORLOG IS
  'Auditoría de operaciones sensibles del banco de evaluadores. Solo escritura desde el backend; lectura para coordinación y admin.';
COMMENT ON COLUMN EVALUADORLOG.EVALUADORID IS
  'Evaluador afectado. Denormalizado para poder filtrar el log de una ficha sin recorrer todas las tablas.';
COMMENT ON COLUMN EVALUADORLOG.PARTICIPACIONID IS
  'Ciclo afectado, cuando aplica. Permite mostrar la auditoría dentro del año correspondiente.';
COMMENT ON COLUMN EVALUADORLOG.OPERACION IS
  'INSERT/UPDATE/DELETE genéricos, más ESTADO (cambio de estado del ciclo), GENERAR/ANULAR (matriz de retroalimentación) y EMITIR (certificado).';
COMMENT ON COLUMN EVALUADORLOG.VALORANTES IS
  'Snapshot JSON del registro antes del cambio. NULL en INSERT.';


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Secuencia e índices                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE EVALUADORLOG_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

DECLARE
  PROCEDURE add_idx(p_ddl VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_ddl;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
  END;
BEGIN
  add_idx('CREATE INDEX IX_EVALLOG_EVAL   ON EVALUADORLOG (EVALUADORID, FECHA DESC)');
  add_idx('CREATE INDEX IX_EVALLOG_PART   ON EVALUADORLOG (PARTICIPACIONID)');
  add_idx('CREATE INDEX IX_EVALLOG_FECHA  ON EVALUADORLOG (FECHA DESC)');
  add_idx('CREATE INDEX IX_EVALLOG_TABLA  ON EVALUADORLOG (TABLA, OPERACION)');
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Auditoría en tablas que ya existían                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Las tablas creadas en v30-v33 ya nacieron con estas columnas. Aquí se
-- completan las que venían de v20-v28.

DECLARE
  PROCEDURE add_col(p_tabla VARCHAR2, p_ddl VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_tabla || ' ADD (' || p_ddl || ')';
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -1430 THEN RAISE; END IF;
  END;
BEGIN
  add_col('EVALUADOR', 'USUARIOCREACION NVARCHAR2(200)');
  add_col('EVALUADOR', 'USUARIOMODIFICACION NVARCHAR2(200)');
  add_col('EVALUADOR', 'FECHAMODIFICACION DATE');

  add_col('EVALUADORESTUDIO', 'USUARIOCREACION NVARCHAR2(200)');
  add_col('EVALUADOREXPERIENCIA', 'USUARIOCREACION NVARCHAR2(200)');
  add_col('EVALUADOREXPERIENCIA', 'FECHACARGUE DATE DEFAULT SYSDATE');
  add_col('EVALUADORTIC', 'USUARIOCREACION NVARCHAR2(200)');
  add_col('EVALUADORTIC', 'FECHACARGUE DATE DEFAULT SYSDATE');
  add_col('CONVOCATORIADOCUMENTO', 'USUARIOCREACION NVARCHAR2(200)');
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 4. GRANTS y SINÓNIMOS                                                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- SEP_APP inserta y lee. NO se otorga UPDATE ni DELETE: el log es inmutable
-- desde la aplicación, y eso es justamente lo que lo hace útil como auditoría.

GRANT SELECT, INSERT ON EVALUADORLOG     TO SEP_APP;
GRANT SELECT         ON EVALUADORLOG     TO SEP_LECTOR;
GRANT SELECT         ON EVALUADORLOG_SEQ TO SEP_APP;

CREATE OR REPLACE SYNONYM SEP_APP.EVALUADORLOG        FOR SEPLOCAL.EVALUADORLOG;
CREATE OR REPLACE SYNONYM SEP_APP.EVALUADORLOG_SEQ    FOR SEPLOCAL.EVALUADORLOG_SEQ;
CREATE OR REPLACE SYNONYM SEP_LECTOR.EVALUADORLOG     FOR SEPLOCAL.EVALUADORLOG;

COMMIT;
