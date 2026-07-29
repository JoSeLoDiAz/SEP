-- v33_retroalimentacion.sql
-- ──────────────────────────────────────────────────────────────────────────
-- MÓDULO DE RETROALIMENTACIÓN (360°) — port a Oracle del sistema que hoy vive
-- aparte en FormularioInscripcionGGPC (MongoDB + Express + Vue).
--
-- Origen del modelo (colecciones Mongo → tablas Oracle):
--
--   EvalPersona     →  (NO SE PORTA) su rol/área/grupos son contexto POR AÑO
--                      y ya viven en EVALUADORPARTICIPACION (+ v34). El login
--                      deja de ser propio: pasa a USUARIO/USUARIOPERFIL del SEP.
--   EvalFormulario  →  RETROFORMULARIO + RETROPREGUNTA
--   EvalAsignacion  →  RETROASIGNACION
--   EvalSesion      →  RETROSESION
--   EvalRespuesta   →  RETRORESPUESTA + RETRORESPUESTAITEM
--   EvalSugerencia  →  RETROSUGERENCIA
--
-- DECISIÓN CLAVE: las asignaciones y las respuestas se anclan a
-- PARTICIPACIONID, no a EVALUADORID. Es lo que hace que la retroalimentación
-- caiga automáticamente en el año correcto de la ficha del evaluador, y que
-- un mismo evaluador pueda tener resultados distintos en 2024 y en 2025.
--
-- ANONIMATO: la fila SÍ guarda quién calificó (la coordinación necesita saber
-- quién no diligenció y auditar). El anonimato es de PRESENTACIÓN: con
-- RETROFORMULARIO.RESULTADOANONIMO = 1 el backend nunca expone el nombre del
-- calificador hacia el evaluado ni en su ficha; solo el origen (par, líder...).
--
-- Idempotente. Ejecutar como SEPLOCAL (owner del schema).
-- ──────────────────────────────────────────────────────────────────────────


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 1. RETROFORMULARIO — instrumento versionado por convocatoria            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE RETROFORMULARIO (
    RETROFORMULARIOID    NUMBER(10)      NOT NULL,
    CONVOCATORIAID       NUMBER(10),
    NOMBRE               NVARCHAR2(200)  NOT NULL,
    VERSION              NUMBER(3)       DEFAULT 1  NOT NULL,
    ANIO                 NUMBER(4),
    ESCALAMIN            NUMBER(3)       DEFAULT 1  NOT NULL,
    ESCALAMAX            NUMBER(3)       DEFAULT 5  NOT NULL,
    DURACIONMINUTOS      NUMBER(4)       DEFAULT 60 NOT NULL,
    RESULTADOANONIMO     NUMBER(1)       DEFAULT 1  NOT NULL,
    ACTIVO               NUMBER(1)       DEFAULT 1  NOT NULL,
    ABIERTO              NUMBER(1)       DEFAULT 0  NOT NULL,
    FECHAAPERTURA        DATE,
    FECHACIERRE          DATE,
    REGLASMATRIZ         NCLOB,
    USUARIOCREACION      NVARCHAR2(200),
    FECHACREACION        DATE            DEFAULT SYSDATE NOT NULL,
    USUARIOMODIFICACION  NVARCHAR2(200),
    FECHAMODIFICACION    DATE,
    CONSTRAINT PK_RETROFORMULARIO PRIMARY KEY (RETROFORMULARIOID),
    CONSTRAINT FK_RETROFORM_CONV FOREIGN KEY (CONVOCATORIAID)
      REFERENCES EVALUADORCONVOCATORIA(CONVOCATORIAID)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON TABLE RETROFORMULARIO IS
  'Instrumento de retroalimentación de un ciclo. Versionado: cada convocatoria puede tener su propio set de preguntas.';
COMMENT ON COLUMN RETROFORMULARIO.RESULTADOANONIMO IS
  '1 = al mostrar resultados nunca se revela quién calificó (solo el origen). La fila SÍ guarda el calificador para auditoría.';
COMMENT ON COLUMN RETROFORMULARIO.ABIERTO IS
  '1 = los evaluadores pueden diligenciar. 0 = cerrado (solo lectura de resultados).';
COMMENT ON COLUMN RETROFORMULARIO.REGLASMATRIZ IS
  'JSON con la configuración del generador de pares: {"gruposPorArea":{"TECNICA":[1,2,3,4,5,6],...},"peerEvaluation":true}. ' ||
  'Permite cambiar la topología año a año sin desplegar código.';
COMMENT ON COLUMN RETROFORMULARIO.DURACIONMINUTOS IS
  'Minutos de referencia de la sesión. Al superarlos se marca SEEXCEDIO (no bloquea el envío).';

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE RETROFORMULARIO_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- Solo un formulario activo por convocatoria (índice funcional: los NULL no chocan).
BEGIN
  EXECUTE IMMEDIATE q'[CREATE UNIQUE INDEX UQ_RETROFORM_ACTIVO
    ON RETROFORMULARIO (CASE WHEN ACTIVO = 1 THEN CONVOCATORIAID END)]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2. RETROPREGUNTA                                                        ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE RETROPREGUNTA (
    RETROPREGUNTAID    NUMBER(10)      NOT NULL,
    RETROFORMULARIOID  NUMBER(10)      NOT NULL,
    NUMERO             NUMBER(3)       NOT NULL,
    TEXTO              NVARCHAR2(1000) NOT NULL,
    CRITERIOS          NVARCHAR2(300),
    TIPO               NVARCHAR2(30)   NOT NULL,
    PESO               NUMBER(5,2)     DEFAULT 0 NOT NULL,
    REQUERIDA          NUMBER(1)       DEFAULT 0 NOT NULL,
    ORDEN              NUMBER(3)       DEFAULT 100 NOT NULL,
    ACTIVO             NUMBER(1)       DEFAULT 1 NOT NULL,
    CONSTRAINT PK_RETROPREGUNTA PRIMARY KEY (RETROPREGUNTAID),
    CONSTRAINT UQ_RETROPREG_NUM UNIQUE (RETROFORMULARIOID, NUMERO),
    CONSTRAINT FK_RETROPREG_FORM FOREIGN KEY (RETROFORMULARIOID)
      REFERENCES RETROFORMULARIO(RETROFORMULARIOID),
    CONSTRAINT CK_RETROPREG_TIPO CHECK (
      TIPO IN (N'ESCALA', N'TEXTO_POR_PERSONA', N'TEXTO_GENERAL')
    )
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON COLUMN RETROPREGUNTA.TIPO IS
  'ESCALA = radio ESCALAMIN..ESCALAMAX por persona evaluada. ' ||
  'TEXTO_POR_PERSONA = textarea por cada evaluado. ' ||
  'TEXTO_GENERAL = textarea única al cierre de la sesión (no por persona).';

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE RETROPREGUNTA_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 3. RETROASIGNACION — par (quien califica → a quien califica)            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE RETROASIGNACION (
    RETROASIGNACIONID  NUMBER(10)     NOT NULL,
    RETROFORMULARIOID  NUMBER(10)     NOT NULL,
    PARTEVALUADORID    NUMBER(10)     NOT NULL,
    PARTEVALUADOID     NUMBER(10)     NOT NULL,
    ESTADO             NVARCHAR2(20)  DEFAULT N'PENDIENTE' NOT NULL,
    ORIGEN             NVARCHAR2(20)  DEFAULT N'AUTOMATICA' NOT NULL,
    MOTIVOREGLA        NVARCHAR2(200),
    RETRORESPUESTAID   NUMBER(10),
    USUARIOCREACION    NVARCHAR2(200),
    FECHACREACION      DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_RETROASIGNACION PRIMARY KEY (RETROASIGNACIONID),
    CONSTRAINT UQ_RETROASIG_PAR UNIQUE (RETROFORMULARIOID, PARTEVALUADORID, PARTEVALUADOID),
    CONSTRAINT FK_RETROASIG_FORM FOREIGN KEY (RETROFORMULARIOID)
      REFERENCES RETROFORMULARIO(RETROFORMULARIOID),
    CONSTRAINT FK_RETROASIG_EVALUADOR FOREIGN KEY (PARTEVALUADORID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID),
    CONSTRAINT FK_RETROASIG_EVALUADO FOREIGN KEY (PARTEVALUADOID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID),
    CONSTRAINT CK_RETROASIG_ESTADO CHECK (ESTADO IN (N'PENDIENTE', N'ENVIADA', N'ANULADA')),
    CONSTRAINT CK_RETROASIG_ORIGEN CHECK (ORIGEN IN (N'AUTOMATICA', N'MANUAL')),
    CONSTRAINT CK_RETROASIG_NOAUTO CHECK (PARTEVALUADORID <> PARTEVALUADOID)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON TABLE RETROASIGNACION IS
  'Par evaluador→evaluado generado por la matriz de reglas. Se ancla a PARTICIPACION para que el resultado caiga en el año correcto.';
COMMENT ON COLUMN RETROASIGNACION.ORIGEN IS
  'AUTOMATICA = la generó el motor de reglas. MANUAL = la agregó el coordinador a mano.';
COMMENT ON COLUMN RETROASIGNACION.MOTIVOREGLA IS
  'Regla que produjo el par (ej. "lider-tecnica→analistas-g1-6"). Sirve para auditar y depurar la matriz.';
COMMENT ON COLUMN RETROASIGNACION.ESTADO IS
  'PENDIENTE / ENVIADA / ANULADA. ANULADA = el coordinador la retiró sin borrar la traza.';

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE RETROASIGNACION_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_RETROASIG_EVALUADOR ON RETROASIGNACION (PARTEVALUADORID, ESTADO)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_RETROASIG_EVALUADO ON RETROASIGNACION (PARTEVALUADOID, ESTADO)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 4. RETROSESION — un intento de diligenciamiento                         ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE RETROSESION (
    RETROSESIONID        NUMBER(10)     NOT NULL,
    RETROFORMULARIOID    NUMBER(10)     NOT NULL,
    PARTICIPACIONID      NUMBER(10)     NOT NULL,
    FECHAINICIO          DATE           DEFAULT SYSDATE NOT NULL,
    FECHAENVIO           DATE,
    DURACIONMINUTOS      NUMBER(4)      DEFAULT 60 NOT NULL,
    MINUTOSTRANSCURRIDOS NUMBER(6),
    SEEXCEDIO            NUMBER(1)      DEFAULT 0 NOT NULL,
    IPORIGEN             NVARCHAR2(60),
    USUARIOEMAIL         NVARCHAR2(200),
    CONSTRAINT PK_RETROSESION PRIMARY KEY (RETROSESIONID),
    CONSTRAINT FK_RETROSES_FORM FOREIGN KEY (RETROFORMULARIOID)
      REFERENCES RETROFORMULARIO(RETROFORMULARIOID),
    CONSTRAINT FK_RETROSES_PART FOREIGN KEY (PARTICIPACIONID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON TABLE RETROSESION IS
  'Un intento de diligenciamiento. Agrupa todas las respuestas enviadas de una vez + la pregunta general.';
COMMENT ON COLUMN RETROSESION.SEEXCEDIO IS
  '1 = superó DURACIONMINUTOS. Es informativo para el reporte de tiempos, no bloquea el envío.';

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE RETROSESION_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_RETROSES_PART ON RETROSESION (PARTICIPACIONID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RETRORESPUESTA — formulario diligenciado para UN evaluado            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE RETRORESPUESTA (
    RETRORESPUESTAID   NUMBER(10)     NOT NULL,
    RETROSESIONID      NUMBER(10)     NOT NULL,
    RETROASIGNACIONID  NUMBER(10)     NOT NULL,
    RETROFORMULARIOID  NUMBER(10)     NOT NULL,
    PARTEVALUADORID    NUMBER(10)     NOT NULL,
    PARTEVALUADOID     NUMBER(10)     NOT NULL,
    PUNTAJEESCALA      NUMBER(6,2)    DEFAULT 0 NOT NULL,
    PUNTAJEMAXIMO      NUMBER(6,2)    DEFAULT 0 NOT NULL,
    PROMEDIO           NUMBER(5,2),
    FECHAENVIO         DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_RETRORESPUESTA PRIMARY KEY (RETRORESPUESTAID),
    CONSTRAINT UQ_RETRORESP_ASIG UNIQUE (RETROASIGNACIONID),
    CONSTRAINT FK_RETRORESP_SES  FOREIGN KEY (RETROSESIONID)
      REFERENCES RETROSESION(RETROSESIONID),
    CONSTRAINT FK_RETRORESP_ASIG FOREIGN KEY (RETROASIGNACIONID)
      REFERENCES RETROASIGNACION(RETROASIGNACIONID),
    CONSTRAINT FK_RETRORESP_FORM FOREIGN KEY (RETROFORMULARIOID)
      REFERENCES RETROFORMULARIO(RETROFORMULARIOID),
    CONSTRAINT FK_RETRORESP_EVALUADOR FOREIGN KEY (PARTEVALUADORID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID),
    CONSTRAINT FK_RETRORESP_EVALUADO FOREIGN KEY (PARTEVALUADOID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON COLUMN RETRORESPUESTA.PUNTAJEMAXIMO IS
  'Máximo alcanzable con las preguntas de escala vigentes al momento del envío. Congelado para que un cambio del instrumento no altere el histórico.';
COMMENT ON COLUMN RETRORESPUESTA.PROMEDIO IS
  'PUNTAJEESCALA / número de preguntas de escala respondidas. Es el número que se muestra en la ficha del evaluado.';

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE RETRORESPUESTA_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- El índice más caliente: "dame todo lo que recibió esta participación".
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_RETRORESP_EVALUADO ON RETRORESPUESTA (PARTEVALUADOID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_RETRORESP_SES ON RETRORESPUESTA (RETROSESIONID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RETRORESPUESTAITEM — una pregunta contestada                         ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE RETRORESPUESTAITEM (
    RETROITEMID       NUMBER(10)   NOT NULL,
    RETRORESPUESTAID  NUMBER(10)   NOT NULL,
    RETROPREGUNTAID   NUMBER(10)   NOT NULL,
    PREGUNTANUMERO    NUMBER(3)    NOT NULL,
    CALIFICACION      NUMBER(3),
    COMENTARIO        NCLOB,
    CONSTRAINT PK_RETRORESPUESTAITEM PRIMARY KEY (RETROITEMID),
    CONSTRAINT UQ_RETROITEM_PREG UNIQUE (RETRORESPUESTAID, RETROPREGUNTAID),
    CONSTRAINT FK_RETROITEM_RESP FOREIGN KEY (RETRORESPUESTAID)
      REFERENCES RETRORESPUESTA(RETRORESPUESTAID),
    CONSTRAINT FK_RETROITEM_PREG FOREIGN KEY (RETROPREGUNTAID)
      REFERENCES RETROPREGUNTA(RETROPREGUNTAID)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE RETRORESPUESTAITEM_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX IX_RETROITEM_RESP ON RETRORESPUESTAITEM (RETRORESPUESTAID)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 7. RETROSUGERENCIA — pregunta general, una por sesión                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE RETROSUGERENCIA (
    RETROSUGERENCIAID  NUMBER(10)   NOT NULL,
    RETROSESIONID      NUMBER(10)   NOT NULL,
    RETROPREGUNTAID    NUMBER(10),
    PARTICIPACIONID    NUMBER(10)   NOT NULL,
    TEXTO              NCLOB,
    FECHAENVIO         DATE         DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_RETROSUGERENCIA PRIMARY KEY (RETROSUGERENCIAID),
    CONSTRAINT UQ_RETROSUG_SES UNIQUE (RETROSESIONID),
    CONSTRAINT FK_RETROSUG_SES  FOREIGN KEY (RETROSESIONID)
      REFERENCES RETROSESION(RETROSESIONID),
    CONSTRAINT FK_RETROSUG_PREG FOREIGN KEY (RETROPREGUNTAID)
      REFERENCES RETROPREGUNTA(RETROPREGUNTAID),
    CONSTRAINT FK_RETROSUG_PART FOREIGN KEY (PARTICIPACIONID)
      REFERENCES EVALUADORPARTICIPACION(PARTICIPACIONID)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON TABLE RETROSUGERENCIA IS
  'Respuesta a la pregunta de tipo TEXTO_GENERAL. Es del proceso, no de un par evaluador-evaluado.';

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE RETROSUGERENCIA_SEQ START WITH 1 INCREMENT BY 1 NOCACHE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 8. SEED — instrumento FCE con las 12 preguntas vigentes                 ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Textos tomados del instrumento "Retroalimentación FCE-2026" que hoy siembra
-- FormularioInscripcionGGPC/Backend/controllers/eval/formulario.js.
-- 10 preguntas de escala 1-5 con peso 5 (máximo 50) + Q11 por persona + Q12 general.
--
-- Se crea SIN CONVOCATORIAID (plantilla base). Al abrir un ciclo, el backend
-- clona esta plantilla hacia la convocatoria del año — así el histórico nunca
-- se altera si alguien edita las preguntas después.

DECLARE
  v_form_id NUMBER;
  v_existe  NUMBER;

  PROCEDURE add_preg(
    p_num NUMBER, p_tipo NVARCHAR2, p_peso NUMBER, p_req NUMBER,
    p_texto NVARCHAR2, p_crit NVARCHAR2
  ) IS
    v_hay NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_hay FROM RETROPREGUNTA
     WHERE RETROFORMULARIOID = v_form_id AND NUMERO = p_num;
    IF v_hay = 0 THEN
      INSERT INTO RETROPREGUNTA
        (RETROPREGUNTAID, RETROFORMULARIOID, NUMERO, TEXTO, CRITERIOS, TIPO, PESO, REQUERIDA, ORDEN)
        VALUES (RETROPREGUNTA_SEQ.NEXTVAL, v_form_id, p_num, p_texto, p_crit, p_tipo, p_peso, p_req, p_num * 10);
    END IF;
  END;
BEGIN
  SELECT COUNT(*) INTO v_existe FROM RETROFORMULARIO
   WHERE CONVOCATORIAID IS NULL AND NOMBRE = N'Retroalimentación FCE — plantilla base';

  IF v_existe = 0 THEN
    SELECT RETROFORMULARIO_SEQ.NEXTVAL INTO v_form_id FROM DUAL;
    INSERT INTO RETROFORMULARIO
      (RETROFORMULARIOID, CONVOCATORIAID, NOMBRE, VERSION, ESCALAMIN, ESCALAMAX,
       DURACIONMINUTOS, RESULTADOANONIMO, ACTIVO, ABIERTO, USUARIOCREACION)
      VALUES (v_form_id, NULL, N'Retroalimentación FCE — plantilla base', 1, 1, 5,
              60, 1, 1, 0, 'seed-v33');
  ELSE
    SELECT RETROFORMULARIOID INTO v_form_id FROM RETROFORMULARIO
     WHERE CONVOCATORIAID IS NULL AND NOMBRE = N'Retroalimentación FCE — plantilla base'
       AND ROWNUM = 1;
  END IF;

  add_preg(1, N'ESCALA', 5, 1,
    N'¿Cumplió oportunamente con las actividades, proyectos asignados y los tiempos establecidos en el cronograma del proceso de evaluación?',
    N'Responsabilidad, cumplimiento y gestión del tiempo');
  add_preg(2, N'ESCALA', 5, 1,
    N'¿Demostró dominio técnico y metodológico de los documentos de la convocatoria (pliego de condiciones, anexos, adendas y demás lineamientos aplicables)?',
    N'Conocimiento técnico de la convocatoria');
  add_preg(3, N'ESCALA', 5, 1,
    N'¿Aplicó de manera objetiva, coherente, consistente y transparente los criterios generales de evaluación establecidos para la convocatoria?',
    N'Objetividad, criterio técnico e integridad');
  add_preg(4, N'ESCALA', 5, 1,
    N'¿Demostró capacidad para identificar inconsistencias, analizar situaciones complejas y proponer soluciones para el proceso de evaluación de sus proyectos o procesos?',
    N'Pensamiento analítico y resolución de problemas');
  add_preg(5, N'ESCALA', 5, 1,
    N'¿Utilizó de manera eficiente las herramientas tecnológicas requeridas para el proceso (Ficha de evaluación, SharePoint, Excel, Adobe y demás destinadas para el proceso)?',
    N'Competencias digitales');
  add_preg(6, N'ESCALA', 5, 1,
    N'¿Mantuvo una comunicación efectiva, respetuosa y colaborativa con los demás actores del proceso (líderes, analistas, evaluadores y equipo GGPC)?',
    N'Trabajo en equipo y comunicación');
  add_preg(7, N'ESCALA', 5, 1,
    N'¿La calidad de los conceptos, observaciones, subsanaciones y/o aclaraciones remitidas durante la evaluación fueron claras, técnicas y suficientemente argumentadas de acuerdo con la temática?',
    N'Calidad técnica del trabajo');
  add_preg(8, N'ESCALA', 5, 1,
    N'¿Demostró iniciativa y autonomía para desarrollar las actividades asignadas, requiriendo el nivel adecuado de acompañamiento durante el proceso de evaluación?',
    N'Proactividad y desarrollo autónomo de actividades');
  add_preg(9, N'ESCALA', 5, 1,
    N'¿Cómo califica el desempeño integral de la persona durante el proceso de evaluación de proyectos?',
    N'Percepción global del desempeño');
  add_preg(10, N'ESCALA', 5, 1,
    N'¿Recomendaría la participación de esta persona en futuros procesos de evaluación del Grupo de Gestión para la Productividad y la Competitividad (GGPC)?',
    N'Idoneidad para futuras convocatorias');
  add_preg(11, N'TEXTO_POR_PERSONA', 0, 0,
    N'¿Qué recomendaciones, observaciones o comentarios considera pertinentes para tener en cuenta sobre el desempeño de la persona evaluada en futuros procesos?',
    NULL);
  add_preg(12, N'TEXTO_GENERAL', 0, 0,
    N'¿Qué acciones de mejora propones para el proceso de evaluación de este tipo de convocatorias?',
    NULL);
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 9. GRANTS y SINÓNIMOS                                                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT, UPDATE, DELETE ON RETROFORMULARIO     TO SEP_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON RETROPREGUNTA       TO SEP_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON RETROASIGNACION     TO SEP_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON RETROSESION         TO SEP_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON RETRORESPUESTA      TO SEP_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON RETRORESPUESTAITEM  TO SEP_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON RETROSUGERENCIA     TO SEP_APP;

GRANT SELECT ON RETROFORMULARIO    TO SEP_LECTOR;
GRANT SELECT ON RETROPREGUNTA      TO SEP_LECTOR;
GRANT SELECT ON RETROASIGNACION    TO SEP_LECTOR;
GRANT SELECT ON RETROSESION        TO SEP_LECTOR;
GRANT SELECT ON RETRORESPUESTA     TO SEP_LECTOR;
GRANT SELECT ON RETRORESPUESTAITEM TO SEP_LECTOR;
GRANT SELECT ON RETROSUGERENCIA    TO SEP_LECTOR;

GRANT SELECT ON RETROFORMULARIO_SEQ    TO SEP_APP;
GRANT SELECT ON RETROPREGUNTA_SEQ      TO SEP_APP;
GRANT SELECT ON RETROASIGNACION_SEQ    TO SEP_APP;
GRANT SELECT ON RETROSESION_SEQ        TO SEP_APP;
GRANT SELECT ON RETRORESPUESTA_SEQ     TO SEP_APP;
GRANT SELECT ON RETRORESPUESTAITEM_SEQ TO SEP_APP;
GRANT SELECT ON RETROSUGERENCIA_SEQ    TO SEP_APP;

CREATE OR REPLACE SYNONYM SEP_APP.RETROFORMULARIO        FOR SEPLOCAL.RETROFORMULARIO;
CREATE OR REPLACE SYNONYM SEP_APP.RETROFORMULARIO_SEQ    FOR SEPLOCAL.RETROFORMULARIO_SEQ;
CREATE OR REPLACE SYNONYM SEP_APP.RETROPREGUNTA          FOR SEPLOCAL.RETROPREGUNTA;
CREATE OR REPLACE SYNONYM SEP_APP.RETROPREGUNTA_SEQ      FOR SEPLOCAL.RETROPREGUNTA_SEQ;
CREATE OR REPLACE SYNONYM SEP_APP.RETROASIGNACION        FOR SEPLOCAL.RETROASIGNACION;
CREATE OR REPLACE SYNONYM SEP_APP.RETROASIGNACION_SEQ    FOR SEPLOCAL.RETROASIGNACION_SEQ;
CREATE OR REPLACE SYNONYM SEP_APP.RETROSESION            FOR SEPLOCAL.RETROSESION;
CREATE OR REPLACE SYNONYM SEP_APP.RETROSESION_SEQ        FOR SEPLOCAL.RETROSESION_SEQ;
CREATE OR REPLACE SYNONYM SEP_APP.RETRORESPUESTA         FOR SEPLOCAL.RETRORESPUESTA;
CREATE OR REPLACE SYNONYM SEP_APP.RETRORESPUESTA_SEQ     FOR SEPLOCAL.RETRORESPUESTA_SEQ;
CREATE OR REPLACE SYNONYM SEP_APP.RETRORESPUESTAITEM     FOR SEPLOCAL.RETRORESPUESTAITEM;
CREATE OR REPLACE SYNONYM SEP_APP.RETRORESPUESTAITEM_SEQ FOR SEPLOCAL.RETRORESPUESTAITEM_SEQ;
CREATE OR REPLACE SYNONYM SEP_APP.RETROSUGERENCIA        FOR SEPLOCAL.RETROSUGERENCIA;
CREATE OR REPLACE SYNONYM SEP_APP.RETROSUGERENCIA_SEQ    FOR SEPLOCAL.RETROSUGERENCIA_SEQ;

CREATE OR REPLACE SYNONYM SEP_LECTOR.RETROFORMULARIO     FOR SEPLOCAL.RETROFORMULARIO;
CREATE OR REPLACE SYNONYM SEP_LECTOR.RETROPREGUNTA       FOR SEPLOCAL.RETROPREGUNTA;
CREATE OR REPLACE SYNONYM SEP_LECTOR.RETROASIGNACION     FOR SEPLOCAL.RETROASIGNACION;
CREATE OR REPLACE SYNONYM SEP_LECTOR.RETROSESION         FOR SEPLOCAL.RETROSESION;
CREATE OR REPLACE SYNONYM SEP_LECTOR.RETRORESPUESTA      FOR SEPLOCAL.RETRORESPUESTA;
CREATE OR REPLACE SYNONYM SEP_LECTOR.RETRORESPUESTAITEM  FOR SEPLOCAL.RETRORESPUESTAITEM;
CREATE OR REPLACE SYNONYM SEP_LECTOR.RETROSUGERENCIA     FOR SEPLOCAL.RETROSUGERENCIA;

COMMIT;
