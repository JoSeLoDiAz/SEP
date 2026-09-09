-- Calcula el porcentaje de las pruebas de conocimiento anteriores.

SET SERVEROUTPUT ON;

DECLARE
  v_pruebas NUMBER;
  v_conv    NUMBER;
  v_aprob   NUMBER;
  v_no      NUMBER;
BEGIN
  UPDATE EVALUADORPRUEBA
     SET EFECTIVIDAD   = ROUND(PUNTAJEMAYOR / 50 * 100, 2),
         PUNTAJEMINIMO = 80,
         APROBADA      = CASE WHEN ROUND(PUNTAJEMAYOR / 50 * 100, 2) >= 80 THEN 1 ELSE 0 END
   WHERE EFECTIVIDAD IS NULL
     AND PUNTAJEMAYOR IS NOT NULL;
  v_pruebas := SQL%ROWCOUNT;

  -- El criterio rige desde 2021. Antes de esa fecha no se fija nada: no
  UPDATE EVALUADORCONVOCATORIA
     SET PUNTAJEMINIMOPRUEBA = 80
   WHERE ANIO >= 2021
     AND PUNTAJEMINIMOPRUEBA IS NULL;
  v_conv := SQL%ROWCOUNT;

  COMMIT;

  DBMS_OUTPUT.PUT_LINE(v_pruebas || ' pruebas con porcentaje calculado');
  DBMS_OUTPUT.PUT_LINE(v_conv    || ' convocatorias con el corte en 80 %');

  SELECT COUNT(*) INTO v_aprob FROM EVALUADORPRUEBA WHERE APROBADA = 1;
  SELECT COUNT(*) INTO v_no    FROM EVALUADORPRUEBA WHERE APROBADA = 0;
  DBMS_OUTPUT.PUT_LINE('-- Resultado --');
  DBMS_OUTPUT.PUT_LINE('  aprobadas:     ' || v_aprob);
  DBMS_OUTPUT.PUT_LINE('  no aprobadas:  ' || v_no);

  -- Verificación: que no quede ninguna prueba con puntaje y sin porcentaje.
  SELECT COUNT(*) INTO v_no FROM EVALUADORPRUEBA
   WHERE PUNTAJEMAYOR IS NOT NULL AND EFECTIVIDAD IS NULL;
  IF v_no > 0 THEN
    RAISE_APPLICATION_ERROR(-20052, 'Quedaron ' || v_no || ' pruebas sin porcentaje.');
  END IF;
END;
/
