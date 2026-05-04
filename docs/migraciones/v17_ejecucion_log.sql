-- v17_ejecucion_log.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Audit log para cambios sobre las tablas vivas durante la ejecución del
-- proyecto (estado 3 = Aprobado).
--
-- Cuando el administrador SENA modifica grupos, coberturas, unidades
-- temáticas o material de formación de un proyecto que ya fue aprobado, la
-- operación queda registrada aquí con:
--   - tabla afectada
--   - operación (INSERT/UPDATE/DELETE)
--   - id del registro
--   - usuario y perfil
--   - fecha
--   - opcional: snapshots antes/después (CLOB)
--
-- En estados distintos a 3 (formulación/ borrador) NO se loggea — esos
-- cambios son parte normal de la edición del proponente.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE EJECUCIONLOG (
  EJECUCIONLOGID    NUMBER          NOT NULL,
  PROYECTOID        NUMBER          NOT NULL,
  TABLA             VARCHAR2(60)    NOT NULL,
  OPERACION         VARCHAR2(20)    NOT NULL,
  REGISTROID        NUMBER          NULL,
  USUARIOEMAIL      VARCHAR2(200)   NOT NULL,
  USUARIOPERFILID   NUMBER          NULL,
  FECHA             TIMESTAMP       DEFAULT SYSDATE NOT NULL,
  COMENTARIO        VARCHAR2(2000)  NULL,
  VALORANTES        CLOB            NULL,
  VALORDESPUES      CLOB            NULL,
  CONSTRAINT PK_EJECUCIONLOG PRIMARY KEY (EJECUCIONLOGID),
  CONSTRAINT FK_EJECUCIONLOG_PROYECTO
    FOREIGN KEY (PROYECTOID) REFERENCES PROYECTO(PROYECTOID)
);

CREATE INDEX IX_EJECUCIONLOG_PROY  ON EJECUCIONLOG (PROYECTOID, FECHA DESC);
CREATE INDEX IX_EJECUCIONLOG_FECHA ON EJECUCIONLOG (FECHA DESC);

CREATE SEQUENCE EJECUCIONLOG_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

-- GRANTS y SINÓNIMOS para SEP_APP (CRUD) y SEP_LECTOR (SELECT)
GRANT SELECT, INSERT, UPDATE, DELETE ON EJECUCIONLOG TO SEP_APP;
GRANT SELECT                         ON EJECUCIONLOG TO SEP_LECTOR;
GRANT SELECT                         ON EJECUCIONLOG_SEQ TO SEP_APP;

CREATE OR REPLACE SYNONYM SEP_APP.EJECUCIONLOG       FOR SEPLOCAL.EJECUCIONLOG;
CREATE OR REPLACE SYNONYM SEP_APP.EJECUCIONLOG_SEQ   FOR SEPLOCAL.EJECUCIONLOG_SEQ;
CREATE OR REPLACE SYNONYM SEP_LECTOR.EJECUCIONLOG    FOR SEPLOCAL.EJECUCIONLOG;
CREATE OR REPLACE SYNONYM SEP_LECTOR.EJECUCIONLOG_SEQ FOR SEPLOCAL.EJECUCIONLOG_SEQ;

COMMIT;
