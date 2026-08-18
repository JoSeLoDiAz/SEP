-- v40_evaluador_convocatoria_sep.sql

SET SERVEROUTPUT ON;

-- 0. Verificación previa

DECLARE
  v_huerfanas NUMBER;
BEGIN
  -- Si alguien ya escribió ids que no existen, la FK fallaría a mitad. Mejor
  SELECT COUNT(*) INTO v_huerfanas
    FROM EVALUADORCONVOCATORIA e
   WHERE e.CONVOCATORIASEPID IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM CONVOCATORIA c
                      WHERE c.CONVOCATORIAID = e.CONVOCATORIASEPID);

  DBMS_OUTPUT.PUT_LINE('Ciclos con CONVOCATORIASEPID inexistente: ' || v_huerfanas);
  IF v_huerfanas > 0 THEN
    RAISE_APPLICATION_ERROR(-20040,
      'Hay ' || v_huerfanas || ' ciclo(s) apuntando a una convocatoria que no existe. ' ||
      'Corríjalos o póngalos en NULL antes de crear la llave foránea.');
  END IF;
END;
/

-- 1. Llave foránea

BEGIN
  EXECUTE IMMEDIATE q'[
    ALTER TABLE EVALUADORCONVOCATORIA
      ADD CONSTRAINT FK_EVALCONV_CONVSEP
      FOREIGN KEY (CONVOCATORIASEPID) REFERENCES CONVOCATORIA (CONVOCATORIAID)]';
  DBMS_OUTPUT.PUT_LINE('FK_EVALCONV_CONVSEP creada');
EXCEPTION WHEN OTHERS THEN
  -- ORA-02275: ya existe una FK igual sobre esa columna
  IF SQLCODE IN (-2275, -2264) THEN
    DBMS_OUTPUT.PUT_LINE('FK_EVALCONV_CONVSEP ya existía');
  ELSE RAISE; END IF;
END;
/

-- 2. Índices

-- La v34 ya creó IX_CONV_SEP sobre CONVOCATORIASEPID. Se comprueba en vez de
DECLARE
  v_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_n
    FROM ALL_IND_COLUMNS
   WHERE TABLE_NAME = 'EVALUADORCONVOCATORIA'
     AND COLUMN_NAME = 'CONVOCATORIASEPID'
     AND COLUMN_POSITION = 1;

  IF v_n > 0 THEN
    DBMS_OUTPUT.PUT_LINE('CONVOCATORIASEPID ya está indexada (v34: IX_CONV_SEP)');
  ELSE
    EXECUTE IMMEDIATE
      'CREATE INDEX IX_EVALCONV_CONVSEP ON EVALUADORCONVOCATORIA (CONVOCATORIASEPID)';
    DBMS_OUTPUT.PUT_LINE('IX_EVALCONV_CONVSEP creado');
  END IF;
END;
/

BEGIN
  -- Único parcial: dos ciclos del MISMO periodo sobre la MISMA convocatoria
  EXECUTE IMMEDIATE q'[
    CREATE UNIQUE INDEX UQ_EVALCONV_SEP_PERIODO ON EVALUADORCONVOCATORIA (
      CASE WHEN CONVOCATORIASEPID IS NOT NULL THEN CONVOCATORIASEPID END,
      CASE WHEN CONVOCATORIASEPID IS NOT NULL THEN NVL(TRIM(PERIODO), '-') END)]';
  DBMS_OUTPUT.PUT_LINE('UQ_EVALCONV_SEP_PERIODO creado');
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE IN (-955, -1408) THEN
    DBMS_OUTPUT.PUT_LINE('UQ_EVALCONV_SEP_PERIODO ya existía');
  ELSIF SQLCODE = -1452 THEN
    DBMS_OUTPUT.PUT_LINE(
      'No se pudo crear UQ_EVALCONV_SEP_PERIODO: ya hay dos ciclos sobre la misma ' ||
      'convocatoria del SEP y el mismo periodo. Revíselos y vuelva a correr.');
  ELSE RAISE; END IF;
END;
/

-- COMMENT no admite expresiones: el texto tiene que ir en UN literal. Con
COMMENT ON COLUMN EVALUADORCONVOCATORIA.CONVOCATORIASEPID IS 'Convocatoria real del SEP sobre la que se monta este ciclo de evaluadores. De ahi salen el nombre y el anio; aqui solo viven las reglas del banco (notas de corte, certificacion, matriz de retroalimentacion). Nullable: el historico anterior a la v40 no tiene con que atarse.';

-- 3. Verificación

DECLARE
  v_fk NUMBER; v_ix NUMBER; v_uq NUMBER; v_com NUMBER; v_sueltas NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_fk FROM ALL_CONSTRAINTS
   WHERE TABLE_NAME = 'EVALUADORCONVOCATORIA'
     AND CONSTRAINT_NAME = 'FK_EVALCONV_CONVSEP' AND CONSTRAINT_TYPE = 'R';

  -- Se comprueba el HECHO —que la columna esté indexada— y no un nombre que
  SELECT COUNT(*) INTO v_ix FROM ALL_IND_COLUMNS
   WHERE TABLE_NAME = 'EVALUADORCONVOCATORIA'
     AND COLUMN_NAME = 'CONVOCATORIASEPID' AND COLUMN_POSITION = 1;

  SELECT COUNT(*) INTO v_uq FROM ALL_INDEXES
   WHERE TABLE_NAME = 'EVALUADORCONVOCATORIA'
     AND INDEX_NAME = 'UQ_EVALCONV_SEP_PERIODO' AND UNIQUENESS = 'UNIQUE';

  SELECT COUNT(*) INTO v_com FROM ALL_COL_COMMENTS
   WHERE TABLE_NAME = 'EVALUADORCONVOCATORIA'
     AND COLUMN_NAME = 'CONVOCATORIASEPID' AND COMMENTS IS NOT NULL;

  SELECT COUNT(*) INTO v_sueltas FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIASEPID IS NULL;

  DBMS_OUTPUT.PUT_LINE('── Verificación ───────────────────');
  DBMS_OUTPUT.PUT_LINE('Llave foránea         : ' || v_fk || '  (esperado 1)');
  DBMS_OUTPUT.PUT_LINE('Columna indexada      : ' || v_ix || '  (esperado >= 1)');
  DBMS_OUTPUT.PUT_LINE('Único por convocatoria: ' || v_uq || '  (esperado 1)');
  DBMS_OUTPUT.PUT_LINE('Comentario            : ' || v_com || '  (esperado 1)');
  DBMS_OUTPUT.PUT_LINE('Ciclos sin atar       : ' || v_sueltas ||
                       '  (histórico; se atan desde la pantalla, en Editar)');

  -- Cada cosa que se imprime también bloquea. Un contador que se muestra pero
  IF v_fk < 1 THEN
    RAISE_APPLICATION_ERROR(-20041, 'La llave foránea FK_EVALCONV_CONVSEP no quedó creada.');
  END IF;
  IF v_ix < 1 THEN
    RAISE_APPLICATION_ERROR(-20042, 'CONVOCATORIASEPID quedó sin índice.');
  END IF;
  IF v_uq < 1 THEN
    RAISE_APPLICATION_ERROR(-20043,
      'Falta UQ_EVALCONV_SEP_PERIODO. Si falló por duplicados, revise qué dos ciclos ' ||
      'comparten convocatoria del SEP y periodo, corríjalos y vuelva a correr.');
  END IF;
  IF v_com < 1 THEN
    RAISE_APPLICATION_ERROR(-20044, 'El comentario de la columna no quedó puesto.');
  END IF;
END;
/
