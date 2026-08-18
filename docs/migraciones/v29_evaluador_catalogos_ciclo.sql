-- v29_evaluador_catalogos_ciclo.sql

-- 1. ESTADOPARTICIPACION — máquina de estados del ciclo anual

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE ESTADOPARTICIPACION (
    ESTADOPARTID   NUMBER(10)     NOT NULL,
    CODIGO         NVARCHAR2(30)  NOT NULL,
    NOMBRE         NVARCHAR2(80)  NOT NULL,
    DESCRIPCION    NVARCHAR2(300),
    COLOR          NVARCHAR2(20)  DEFAULT N'neutral' NOT NULL,
    ORDEN          NUMBER(3)      DEFAULT 100 NOT NULL,
    ESFINAL        NUMBER(1)      DEFAULT 0   NOT NULL,
    ESNEGATIVO     NUMBER(1)      DEFAULT 0   NOT NULL,
    ACTIVO         NUMBER(1)      DEFAULT 1   NOT NULL,
    CONSTRAINT PK_ESTADOPARTICIPACION PRIMARY KEY (ESTADOPARTID),
    CONSTRAINT UQ_ESTADOPART_CODIGO UNIQUE (CODIGO)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON COLUMN ESTADOPARTICIPACION.COLOR IS
  'Token de color para la UI (neutral, blue, indigo, cyan, amber, orange, green, red). No hex.';
COMMENT ON COLUMN ESTADOPARTICIPACION.ESFINAL IS
  '1 = estado terminal, la participación ya no avanza.';
COMMENT ON COLUMN ESTADOPARTICIPACION.ESNEGATIVO IS
  '1 = cierre sin haber evaluado (declinó, no aprobó, revocado). Se excluye de las métricas de desempeño.';

-- Seed idempotente de los 11 estados.
DECLARE
  TYPE t_row IS RECORD (
    id NUMBER, cod NVARCHAR2(30), nom NVARCHAR2(80), des NVARCHAR2(300),
    col NVARCHAR2(20), ord NUMBER, fin NUMBER, neg NUMBER
  );
  TYPE t_tab IS TABLE OF t_row;
  v_datos t_tab := t_tab(
    t_row(1,  N'POSTULADO',   N'Postulado / invitado',      N'Aparece en la lista de invitados de la convocatoria', N'neutral', 10, 0, 0),
    t_row(2,  N'AUTORIZADO',  N'Autorizado por el jefe',    N'El jefe directo autorizó su participación',           N'blue',    20, 0, 0),
    t_row(3,  N'EN_FORMACION',N'En curso de formación',     N'Cursando la capacitación del año',                    N'indigo',  30, 0, 0),
    t_row(4,  N'HABILITADO',  N'Habilitado',                N'Aprobó la prueba de conocimiento del año',            N'cyan',    40, 0, 0),
    t_row(5,  N'ASIGNADO',    N'Asignado a mesa/equipo',    N'Tiene mesa, equipo y proceso definidos',              N'amber',   50, 0, 0),
    t_row(6,  N'EVALUANDO',   N'Evaluando proyectos',       N'Proceso de evaluación en curso',                      N'orange',  60, 0, 0),
    t_row(7,  N'FINALIZADO',  N'Finalizó la evaluación',    N'Entregó todos los conceptos de sus proyectos',        N'green',   70, 1, 0),
    t_row(8,  N'CERTIFICADO', N'Certificado emitido',       N'Se le emitió el certificado de participación',        N'green',   80, 1, 0),
    t_row(9,  N'DECLINO',     N'Declinó la invitación',     N'No aceptó participar ese año',                        N'neutral', 90, 1, 1),
    t_row(10, N'NO_APROBO',   N'No aprobó',                 N'No superó la prueba de conocimiento o el curso',      N'red',     95, 1, 1),
    t_row(11, N'REVOCADO',    N'Participación revocada',    N'Se le revocó la participación durante el proceso',    N'red',     99, 1, 1)
  );
  v_existe NUMBER;
BEGIN
  FOR i IN 1 .. v_datos.COUNT LOOP
    SELECT COUNT(*) INTO v_existe FROM ESTADOPARTICIPACION WHERE CODIGO = v_datos(i).cod;
    IF v_existe = 0 THEN
      INSERT INTO ESTADOPARTICIPACION
        (ESTADOPARTID, CODIGO, NOMBRE, DESCRIPCION, COLOR, ORDEN, ESFINAL, ESNEGATIVO)
        VALUES (v_datos(i).id, v_datos(i).cod, v_datos(i).nom, v_datos(i).des,
                v_datos(i).col, v_datos(i).ord, v_datos(i).fin, v_datos(i).neg);
    END IF;
  END LOOP;
END;
/

-- 2. MODALIDADPART — modalidad de la participación

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE MODALIDADPART (
    MODALIDADPARTID  NUMBER(10)     NOT NULL,
    CODIGO           NVARCHAR2(30)  NOT NULL,
    NOMBRE           NVARCHAR2(80)  NOT NULL,
    DESCRIPCION      NVARCHAR2(300),
    ORDEN            NUMBER(3)      DEFAULT 100 NOT NULL,
    ACTIVO           NUMBER(1)      DEFAULT 1   NOT NULL,
    CONSTRAINT PK_MODALIDADPART PRIMARY KEY (MODALIDADPARTID),
    CONSTRAINT UQ_MODALIDADPART_CODIGO UNIQUE (CODIGO)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

MERGE INTO MODALIDADPART d
USING (
  SELECT 1 AS ID, N'PRESENCIAL' AS CODIGO, N'Presencial' AS NOMBRE,
         N'El evaluador asiste presencialmente a la mesa' AS DESCRIPCION, 10 AS ORDEN FROM DUAL
  UNION ALL SELECT 2, N'PAT', N'PAT',
         N'Puesto de Atención al Teletrabajo / trabajo asistido', 20 FROM DUAL
  UNION ALL SELECT 3, N'VIRTUAL', N'Virtual',
         N'Evaluación 100 % remota', 30 FROM DUAL
) s ON (d.CODIGO = s.CODIGO)
WHEN NOT MATCHED THEN
  INSERT (MODALIDADPARTID, CODIGO, NOMBRE, DESCRIPCION, ORDEN)
  VALUES (s.ID, s.CODIGO, s.NOMBRE, s.DESCRIPCION, s.ORDEN);

-- 3. AREAEVALUACION — área del equipo evaluador

BEGIN
  EXECUTE IMMEDIATE q'[CREATE TABLE AREAEVALUACION (
    AREAID       NUMBER(10)     NOT NULL,
    CODIGO       NVARCHAR2(30)  NOT NULL,
    NOMBRE       NVARCHAR2(80)  NOT NULL,
    GRUPOSDEFECTO NVARCHAR2(60),
    ORDEN        NUMBER(3)      DEFAULT 100 NOT NULL,
    ACTIVO       NUMBER(1)      DEFAULT 1   NOT NULL,
    CONSTRAINT PK_AREAEVALUACION PRIMARY KEY (AREAID),
    CONSTRAINT UQ_AREAEVAL_CODIGO UNIQUE (CODIGO)
  )]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

COMMENT ON COLUMN AREAEVALUACION.GRUPOSDEFECTO IS
  'Grupos que por defecto pertenecen al área, separados por coma (ej. 1,2,3,4,5,6). ' ||
  'Lo usa el generador de la matriz de retroalimentación; puede sobrescribirse por convocatoria.';

MERGE INTO AREAEVALUACION d
USING (
  SELECT 1 AS ID, N'TECNICA'    AS CODIGO, N'Técnica'    AS NOMBRE, N'1,2,3,4,5,6' AS G, 10 AS ORDEN FROM DUAL
  UNION ALL SELECT 2, N'FINANCIERA', N'Financiera', N'7', 20 FROM DUAL
  UNION ALL SELECT 3, N'JURIDICA',   N'Jurídica',   N'8', 30 FROM DUAL
) s ON (d.CODIGO = s.CODIGO)
WHEN NOT MATCHED THEN
  INSERT (AREAID, CODIGO, NOMBRE, GRUPOSDEFECTO, ORDEN)
  VALUES (s.ID, s.CODIGO, s.NOMBRE, s.G, s.ORDEN);

-- 4. ROLEVALUADOR — ampliación del catálogo

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE ROLEVALUADOR ADD (ROLEVALUADORCODIGO NVARCHAR2(40))';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE ROLEVALUADOR ADD (ROLEVALUADORORDEN NUMBER(3) DEFAULT 100)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE ROLEVALUADOR ADD (AREAID NUMBER(10))';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

COMMENT ON COLUMN ROLEVALUADOR.AREAID IS
  'Área a la que pertenece el rol por naturaleza (NULL = aplica a cualquier área).';

-- Completar el código de los tres roles que ya existían (por nombre).
UPDATE ROLEVALUADOR SET ROLEVALUADORCODIGO = N'EVALUADOR',   ROLEVALUADORORDEN = 30
 WHERE UPPER(ROLEVALUADORNOMBRE) = 'EVALUADOR'   AND ROLEVALUADORCODIGO IS NULL;
UPDATE ROLEVALUADOR SET ROLEVALUADORCODIGO = N'ANALISTA',    ROLEVALUADORORDEN = 20
 WHERE UPPER(ROLEVALUADORNOMBRE) = 'ANALISTA'    AND ROLEVALUADORCODIGO IS NULL;
UPDATE ROLEVALUADOR SET ROLEVALUADORCODIGO = N'COORDINADOR', ROLEVALUADORORDEN = 15
 WHERE UPPER(ROLEVALUADORNOMBRE) = 'COORDINADOR' AND ROLEVALUADORCODIGO IS NULL;

-- Roles nuevos del proceso FCE.
MERGE INTO ROLEVALUADOR d
USING (
  SELECT N'LIDER'              AS COD, N'LIDER'              AS NOM, N'Líder del área'                        AS DES, 10 AS ORD FROM DUAL
  UNION ALL SELECT N'APOYO_TECNICO',     N'APOYO TECNICO',     N'Apoyo técnico del grupo',              40 FROM DUAL
  UNION ALL SELECT N'APOYO_PRESUPUESTAL',N'APOYO PRESUPUESTAL',N'Apoyo presupuestal del grupo',         50 FROM DUAL
  UNION ALL SELECT N'APOYO_JURIDICO',    N'APOYO JURIDICO',    N'Apoyo jurídico del grupo',             60 FROM DUAL
  UNION ALL SELECT N'APOYO_FINANCIERO',  N'APOYO FINANCIERO',  N'Apoyo financiero del grupo',           70 FROM DUAL
  UNION ALL SELECT N'TRANSVERSAL',       N'TRANSVERSAL',       N'Evalúa con alcance explícito multi-área', 80 FROM DUAL
) s ON (d.ROLEVALUADORCODIGO = s.COD)
WHEN NOT MATCHED THEN
  INSERT (ROLEVALUADORID, ROLEVALUADORNOMBRE, ROLEVALUADORDESC, ROLEVALUADORCODIGO, ROLEVALUADORORDEN)
  VALUES (ROLEVALUADOR_SEQ.NEXTVAL, s.NOM, s.DES, s.COD, s.ORD);

-- Índice único sobre el código (los NULL de filas viejas no lo violan en Oracle).
BEGIN
  EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX UQ_ROLEVALUADOR_CODIGO ON ROLEVALUADOR (ROLEVALUADORCODIGO)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[ALTER TABLE ROLEVALUADOR ADD CONSTRAINT FK_ROLEVAL_AREA
    FOREIGN KEY (AREAID) REFERENCES AREAEVALUACION(AREAID)]';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -2264 AND SQLCODE != -2275 THEN RAISE; END IF;
END;
/

-- 5. GRANTS y SINÓNIMOS

GRANT SELECT, INSERT, UPDATE, DELETE ON ESTADOPARTICIPACION TO SEP_APP;
GRANT SELECT                         ON ESTADOPARTICIPACION TO SEP_LECTOR;

GRANT SELECT, INSERT, UPDATE, DELETE ON MODALIDADPART       TO SEP_APP;
GRANT SELECT                         ON MODALIDADPART       TO SEP_LECTOR;

GRANT SELECT, INSERT, UPDATE, DELETE ON AREAEVALUACION      TO SEP_APP;
GRANT SELECT                         ON AREAEVALUACION      TO SEP_LECTOR;

CREATE OR REPLACE SYNONYM SEP_APP.ESTADOPARTICIPACION    FOR SEPLOCAL.ESTADOPARTICIPACION;
CREATE OR REPLACE SYNONYM SEP_APP.MODALIDADPART          FOR SEPLOCAL.MODALIDADPART;
CREATE OR REPLACE SYNONYM SEP_APP.AREAEVALUACION         FOR SEPLOCAL.AREAEVALUACION;

CREATE OR REPLACE SYNONYM SEP_LECTOR.ESTADOPARTICIPACION FOR SEPLOCAL.ESTADOPARTICIPACION;
CREATE OR REPLACE SYNONYM SEP_LECTOR.MODALIDADPART       FOR SEPLOCAL.MODALIDADPART;
CREATE OR REPLACE SYNONYM SEP_LECTOR.AREAEVALUACION      FOR SEPLOCAL.AREAEVALUACION;

COMMIT;
