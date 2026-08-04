-- Convocatorias anteriores a 2022 y su ciclo del banco.
-- Presupuestos en 0 y fechas en NULL: anclan el año del banco, no operan
-- proyectos. Idempotente. Corre como SEP_APP.

SET SERVEROUTPUT ON;

DECLARE
  TYPE t_conv IS RECORD (anio NUMBER, nombre VARCHAR2(200), periodo VARCHAR2(2));
  TYPE t_lista IS TABLE OF t_conv;

  v_convs t_lista := t_lista(
    t_conv(2019, 'DG-0001-2019',    '01'),
    t_conv(2020, 'DG-0001-2020',    '01'),
    t_conv(2021, 'DG-0001-2021 p1', '01'),
    t_conv(2021, 'DG-0001-2021 p2', '02')
  );

  k_programa CONSTANT NUMBER := 1;   -- Formación Continua Especializada

  v_sep     NUMBER;
  v_ciclo   NUMBER;
  v_n       NUMBER;
  v_sep2019 NUMBER;
  v_falla   NUMBER := 0;
BEGIN
  FOR i IN 1 .. v_convs.COUNT LOOP

    SELECT COUNT(*) INTO v_n FROM CONVOCATORIA
     WHERE CONVOCATORIAANIO = v_convs(i).anio
       AND UPPER(TRIM(CONVOCATORIANOMBRE)) = UPPER(v_convs(i).nombre);

    IF v_n > 0 THEN
      SELECT MIN(CONVOCATORIAID) INTO v_sep FROM CONVOCATORIA
       WHERE CONVOCATORIAANIO = v_convs(i).anio
         AND UPPER(TRIM(CONVOCATORIANOMBRE)) = UPPER(v_convs(i).nombre);
      DBMS_OUTPUT.PUT_LINE('ya existe  ' || v_convs(i).nombre);
    ELSE
      SELECT NVL(MAX(CONVOCATORIAID), 0) + 1 INTO v_sep FROM CONVOCATORIA;
      INSERT INTO CONVOCATORIA (
        CONVOCATORIAID, CONVOCATORIAANIO, CONVOCATORIANOMBRE,
        CONVOCATORIAPRESUPUESTOTOTAL, CONVOCATORIAPRESUPUESTOMAXIMO,
        CONVOCATORIAMESESPROYECTO, CONVOCATORIATIPOFINANCIACION,
        CONVOCATORIAESTADOCONVOCATORIA, CONVOCATORIAESTADO,
        PROGRAMAID, CONVOCATORIARESULTADOSPUBLICADOS, CONVOCATORIAFECHAREGISTRO)
      VALUES (v_sep, v_convs(i).anio, v_convs(i).nombre, 0, 0, 0, 'COFINANCIACIÓN',
              'CERRADA', 0, k_programa, 0, SYSDATE);
      DBMS_OUTPUT.PUT_LINE('creada     ' || v_convs(i).nombre || '  id=' || v_sep);
    END IF;

    -- (convocatoria, periodo) es la pareja que el índice único de la v40 exige
    SELECT COUNT(*) INTO v_n FROM EVALUADORCONVOCATORIA
     WHERE CONVOCATORIASEPID = v_sep AND NVL(TRIM(PERIODO), 'x') = v_convs(i).periodo;

    IF v_n = 0 THEN
      SELECT NVL(MAX(CONVOCATORIAID), 0) + 1 INTO v_ciclo FROM EVALUADORCONVOCATORIA;
      INSERT INTO EVALUADORCONVOCATORIA
        (CONVOCATORIAID, ANIO, PERIODO, NOMBRE, CONVOCATORIASEPID, ACTIVO, FECHACREACION)
      VALUES (v_ciclo, v_convs(i).anio, v_convs(i).periodo, v_convs(i).nombre, v_sep, 1, SYSDATE);
      DBMS_OUTPUT.PUT_LINE('  ciclo ' || v_convs(i).anio || '-' || v_convs(i).periodo);
    END IF;

  END LOOP;

  -- El ciclo de 2019 que se creó apuntando a la convocatoria de 2022
  SELECT MIN(CONVOCATORIAID) INTO v_sep2019 FROM CONVOCATORIA
   WHERE CONVOCATORIAANIO = 2019 AND UPPER(TRIM(CONVOCATORIANOMBRE)) = 'DG-0001-2019';

  FOR c IN (SELECT ec.CONVOCATORIAID id, ec.ANIO a,
                   (SELECT COUNT(*) FROM EVALUADORPARTICIPACION p
                     WHERE p.CONVOCATORIAID = ec.CONVOCATORIAID) n
              FROM EVALUADORCONVOCATORIA ec
             WHERE UPPER(TRIM(ec.NOMBRE)) = 'DG-0001-2019'
               AND NVL(ec.CONVOCATORIASEPID, -1) <> v_sep2019) LOOP
    IF c.n > 0 THEN
      DBMS_OUTPUT.PUT_LINE('OJO  ciclo ' || c.id || ' tiene ' || c.n ||
        ' participacion(es): reasignelas antes de borrarlo');
    ELSE
      DELETE FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = c.id;
      DBMS_OUTPUT.PUT_LINE('borrado    ciclo ' || c.id || ' (apuntaba a ' || c.a || ')');
    END IF;
  END LOOP;

  COMMIT;

  -- Verificación
  FOR y IN (SELECT 2019 a, 1 esperadas FROM dual
      UNION ALL SELECT 2020, 1 FROM dual
      UNION ALL SELECT 2021, 2 FROM dual) LOOP
    SELECT COUNT(*) INTO v_n FROM CONVOCATORIA WHERE CONVOCATORIAANIO = y.a;
    IF v_n < y.esperadas THEN
      v_falla := v_falla + 1;
      DBMS_OUTPUT.PUT_LINE('FALTAN convocatorias de ' || y.a || ' (hay ' || v_n || ')');
    END IF;
  END LOOP;

  FOR c IN (SELECT ec.CONVOCATORIAID id, ec.ANIO a, cv.CONVOCATORIAANIO sa
              FROM EVALUADORCONVOCATORIA ec
              JOIN CONVOCATORIA cv ON cv.CONVOCATORIAID = ec.CONVOCATORIASEPID
             WHERE ec.ANIO <> cv.CONVOCATORIAANIO) LOOP
    v_falla := v_falla + 1;
    DBMS_OUTPUT.PUT_LINE('ciclo ' || c.id || ' dice ' || c.a || ' y su convocatoria es ' || c.sa);
  END LOOP;

  IF v_falla > 0 THEN
    RAISE_APPLICATION_ERROR(-20047, v_falla || ' problema(s).');
  END IF;
  DBMS_OUTPUT.PUT_LINE('Listo: 2019, 2020 y las dos de 2021 ya se pueden escoger.');
END;
/
