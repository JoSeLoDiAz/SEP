-- Calcula el porcentaje de las pruebas de conocimiento anteriores.
--
-- De la sesión de trabajo del 12/08/2026: la prueba es de 50 preguntas y se
-- aprueba con 80 % o más, criterio vigente desde 2021. Hasta ahora solo se
-- había guardado el PUNTAJE —el número de respuestas correctas— y sin saber
-- sobre cuántas preguntas era, ese número no permitía decidir nada: 41 puede
-- ser un 82 % o un 41 %, según el examen.
--
-- Aquí se completa lo que faltaba:
--   · EFECTIVIDAD  = PUNTAJEMAYOR / 50 * 100
--   · PUNTAJEMINIMO = 80  (el corte, congelado en la fila)
--   · APROBADA      = 1 si el porcentaje llega a 80
--
-- Y se deja el 80 en las convocatorias desde 2021, para que las pruebas que se
-- registren de ahora en adelante se evalúen solas contra el mismo criterio.
--
-- NO se tocan las filas que ya tienen porcentaje: ese dato lo escribió alguien
-- a mano y vale más que un cálculo.
--
-- Para deshacerlo: v52_REVERSA_porcentajes.sql, que trae los valores exactos
-- que tenía cada fila antes de esto.
--
-- Idempotente: correrlo dos veces no cambia nada la segunda. Corre como SEP_APP.

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
  -- consta que fuera el mismo, y ponerlo sería inventarlo.
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
