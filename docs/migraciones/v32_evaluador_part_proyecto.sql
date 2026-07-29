-- v32_evaluador_part_proyecto.sql
-- ──────────────────────────────────────────────────────────────────────────
-- EVALUADORPARTPROYECTO — proyectos que el evaluador evaluó en un ciclo.
--
-- Mata el CLOB EVALUADORPARTICIPACION.PROYECTOSEVALUADOS, que es texto libre
-- y por tanto no se puede contar, filtrar ni cruzar con la tabla PROYECTO.
--
-- Tres formas de referenciar el proyecto, en cascada, para que el histórico
-- 2021-2023 también entre sin bloquear el cargue:
--   1) PROYECTOID  → FK a PROYECTO           (proyecto que llegó a ejecutarse)
--   2) GUARDADOID  → FK a CONVPROYGUARDADO   (proyecto solo formulado, v28)
--   3) NIT + RAZONSOCIAL + NOMBREPROYECTO    (texto, histórico sin sistema)
--
-- El CHECK exige al menos una de las tres. La migración de datos del CLOB va
-- al final de este archivo y es re-ejecutable.
--
-- Idempotente. Ejecutar como SEPLOCAL (owner del schema).
-- ──────────────────────────────────────────────────────────────────────────


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Tabla                                                                ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE EVALUADORPARTPROYECTO (
    PARTPROYECTOID       NUMBER(10)      NOT NULL,
    PARTICIPACIONID      NUMBER(10)      NOT NULL,
    PROYECTOID           NUMBER(10),
    GUARDADOID           NUMBER(10),
    NIT                  NVARCHAR2(30),
    RAZONSOCIAL          NVARCHAR2(300),
    NOMBREPROYECTO       NVARCHAR2(400),
    PUNTAJEOTORGADO      NUMBER(5,2),
    FECHAEVALUACION      DATE,
    OBSERVACIONES        NVARCHAR2(1000),
    USUARIOCREACION      NVARCHAR2(200),
    FECHACREACION        DATE            DEFAULT SYSDATE NOT NULL,
    USUARIOMODIFICACION  NVARCHAR2(200),
    FECHAMODIFICACION    DATE,
    CONSTRAINT PK_EVALUADORPARTPROYECTO PRIMARY KEY (PARTPROYECTOID),
    CONSTRAINT FK_PARTPROY_PART FOREIGN KEY (PARTICIPACIONID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID),
    CONSTRAINT CK_PARTPROY_REF CHECK (
      PROYECTOID IS NOT NULL OR GUARDADOID IS NOT NULL OR NOMBREPROYECTO IS NOT NULL
    )
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON TABLE EVALUADORPARTPROYECTO IS
  'Proyectos evaluados por un evaluador en un ciclo. Reemplaza el CLOB PROYECTOSEVALUADOS.';
COMMENT ON COLUMN EVALUADORPARTPROYECTO.PROYECTOID IS
  'FK lógica a PROYECTO. Sin constraint: el histórico puede referirse a proyectos purgados.';
COMMENT ON COLUMN EVALUADORPARTPROYECTO.GUARDADOID IS
  'FK lógica a CONVPROYGUARDADO (v28) para proyectos formulados que nunca se importaron.';
COMMENT ON COLUMN EVALUADORPARTPROYECTO.PUNTAJEOTORGADO IS
  'Puntaje que ESTE evaluador le dio al proyecto (no el consolidado de la mesa).';


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Secuencia e índices                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE EVALUADORPARTPROYECTO_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_PARTPROY_PART ON EVALUADORPARTPROYECTO (PARTICIPACIONID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/

-- Para responder "¿qué evaluadores tocaron el proyecto X?"
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_PARTPROY_PROYECTO ON EVALUADORPARTPROYECTO (PROYECTOID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_PARTPROY_GUARDADO ON EVALUADORPARTPROYECTO (GUARDADOID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 3. MIGRACIÓN DEL CLOB PROYECTOSEVALUADOS                                ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Parte el texto libre por salto de línea, punto y coma o pipe, y crea una
-- fila por fragmento no vacío en NOMBREPROYECTO.
--
-- Re-ejecutable: solo procesa participaciones que todavía no tengan filas en
-- EVALUADORPARTPROYECTO. La columna PROYECTOSEVALUADOS NO se dropea aquí —
-- eso queda para la v36, después de que la gestión de evaluadores valide el resultado.

DECLARE
  v_texto   CLOB;
  v_frag    VARCHAR2(4000);
  v_resto   CLOB;
  v_pos     NUMBER;
  v_migradas NUMBER := 0;
BEGIN
  FOR p IN (
    SELECT pa.PARTICIPACIONID, pa.PROYECTOSEVALUADOS
      FROM EVALUADORPARTICIPACION pa
     WHERE pa.PROYECTOSEVALUADOS IS NOT NULL
       AND DBMS_LOB.GETLENGTH(pa.PROYECTOSEVALUADOS) > 0
       AND NOT EXISTS (
             SELECT 1 FROM EVALUADORPARTPROYECTO x
              WHERE x.PARTICIPACIONID = pa.PARTICIPACIONID
           )
  ) LOOP
    -- Normalizar separadores a ';'
    v_resto := REPLACE(REPLACE(REPLACE(p.PROYECTOSEVALUADOS, CHR(13), ''), CHR(10), ';'), '|', ';');

    LOOP
      v_pos := INSTR(v_resto, ';');
      IF v_pos > 0 THEN
        v_frag  := TRIM(DBMS_LOB.SUBSTR(v_resto, v_pos - 1, 1));
        v_resto := DBMS_LOB.SUBSTR(v_resto, DBMS_LOB.GETLENGTH(v_resto) - v_pos, v_pos + 1);
      ELSE
        v_frag  := TRIM(DBMS_LOB.SUBSTR(v_resto, 4000, 1));
        v_resto := NULL;
      END IF;

      IF v_frag IS NOT NULL AND LENGTH(v_frag) > 0 THEN
        INSERT INTO EVALUADORPARTPROYECTO
          (PARTPROYECTOID, PARTICIPACIONID, NOMBREPROYECTO, USUARIOCREACION)
          VALUES (EVALUADORPARTPROYECTO_SEQ.NEXTVAL, p.PARTICIPACIONID,
                  SUBSTR(v_frag, 1, 400), 'migracion-v32');
        v_migradas := v_migradas + 1;
      END IF;

      EXIT WHEN v_resto IS NULL OR DBMS_LOB.GETLENGTH(v_resto) = 0;
    END LOOP;
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('v32: filas creadas desde PROYECTOSEVALUADOS = ' || v_migradas);
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 4. GRANTS y SINÓNIMOS                                                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT, UPDATE, DELETE ON EVALUADORPARTPROYECTO     TO SEP_APP;
GRANT SELECT                         ON EVALUADORPARTPROYECTO     TO SEP_LECTOR;
GRANT SELECT                         ON EVALUADORPARTPROYECTO_SEQ TO SEP_APP;

CREATE OR REPLACE SYNONYM SEP_APP.EVALUADORPARTPROYECTO     FOR SEPLOCAL.EVALUADORPARTPROYECTO;
CREATE OR REPLACE SYNONYM SEP_APP.EVALUADORPARTPROYECTO_SEQ FOR SEPLOCAL.EVALUADORPARTPROYECTO_SEQ;
CREATE OR REPLACE SYNONYM SEP_LECTOR.EVALUADORPARTPROYECTO  FOR SEPLOCAL.EVALUADORPARTPROYECTO;

COMMIT;
