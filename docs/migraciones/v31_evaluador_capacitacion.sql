-- v31_evaluador_capacitacion.sql
-- ──────────────────────────────────────────────────────────────────────────
-- EVALUADORCAPACITACION — curso de formación que el evaluador debe aprobar
-- para habilitarse en un ciclo, con su calificación y su certificado.
--
-- ¿Por qué NO se mete en EVALUADORTIC?
--   EVALUADORTIC es formación complementaria PERSONAL y atemporal del
--   evaluador (sus certificados TIC de toda la vida). Esto es un REQUISITO
--   DEL CICLO: cambia año a año, tiene nota de corte, y su aprobación es un
--   hito del checklist. Mezclarlos haría imposible responder "¿aprobó el
--   curso de 2024?".
--
-- Preparada para que el curso se dicte y se califique DENTRO del SEP más
-- adelante: la columna ORIGEN distingue el resultado cargado a mano
-- (EXTERNO — plataforma Territorium/Blackboard/Sofía) del que genere el
-- propio sistema (SISTEMA). Mientras tanto solo se usa EXTERNO y el módulo
-- interno se construye después sin migrar nada.
--
-- Idempotente. Ejecutar como SEPLOCAL (owner del schema).
-- ──────────────────────────────────────────────────────────────────────────


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Tabla                                                                ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE EVALUADORCAPACITACION (
    CAPACITACIONID       NUMBER(10)      NOT NULL,
    PARTICIPACIONID      NUMBER(10)      NOT NULL,
    NOMBRE               NVARCHAR2(200)  NOT NULL,
    ORIGEN               NVARCHAR2(20)   DEFAULT N'EXTERNO' NOT NULL,
    PLATAFORMA           NVARCHAR2(80),
    HORAS                NUMBER(5),
    FECHAINICIO          DATE,
    FECHAFIN             DATE,
    CALIFICACION         NUMBER(5,2),
    CALIFICACIONMINIMA   NUMBER(5,2),
    APROBADO             NUMBER(1)       DEFAULT 0 NOT NULL,
    INTENTOS             NUMBER(3),
    ARCHIVOPDF           BLOB,
    ARCHIVOMIME          NVARCHAR2(120),
    ARCHIVONOMBRE        NVARCHAR2(255),
    OBSERVACIONES        NVARCHAR2(1000),
    USUARIOCREACION      NVARCHAR2(200),
    FECHACREACION        DATE            DEFAULT SYSDATE NOT NULL,
    USUARIOMODIFICACION  NVARCHAR2(200),
    FECHAMODIFICACION    DATE,
    CONSTRAINT PK_EVALUADORCAPACITACION PRIMARY KEY (CAPACITACIONID),
    CONSTRAINT FK_CAPAC_PART FOREIGN KEY (PARTICIPACIONID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID),
    CONSTRAINT CK_CAPAC_ORIGEN CHECK (ORIGEN IN (N'EXTERNO', N'SISTEMA'))
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON TABLE EVALUADORCAPACITACION IS
  'Curso de formación exigido en un ciclo de evaluación, con calificación y certificado.';
COMMENT ON COLUMN EVALUADORCAPACITACION.ORIGEN IS
  'EXTERNO = resultado cargado desde plataforma externa. SISTEMA = curso dictado y calificado dentro del SEP (fase futura).';
COMMENT ON COLUMN EVALUADORCAPACITACION.CALIFICACIONMINIMA IS
  'Nota de corte de ESE curso. Se copia de la convocatoria al crear, para que un cambio posterior no reescriba el histórico.';
COMMENT ON COLUMN EVALUADORCAPACITACION.APROBADO IS
  '1 = aprobó. Alimenta el hito 4 del checklist del ciclo.';


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Secuencia e índices                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE EVALUADORCAPACITACION_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_CAPAC_PART ON EVALUADORCAPACITACION (PARTICIPACIONID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 3. GRANTS y SINÓNIMOS                                                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT, UPDATE, DELETE ON EVALUADORCAPACITACION     TO SEP_APP;
GRANT SELECT                         ON EVALUADORCAPACITACION     TO SEP_LECTOR;
GRANT SELECT                         ON EVALUADORCAPACITACION_SEQ TO SEP_APP;

CREATE OR REPLACE SYNONYM SEP_APP.EVALUADORCAPACITACION     FOR SEPLOCAL.EVALUADORCAPACITACION;
CREATE OR REPLACE SYNONYM SEP_APP.EVALUADORCAPACITACION_SEQ FOR SEPLOCAL.EVALUADORCAPACITACION_SEQ;
CREATE OR REPLACE SYNONYM SEP_LECTOR.EVALUADORCAPACITACION  FOR SEPLOCAL.EVALUADORCAPACITACION;

COMMIT;
