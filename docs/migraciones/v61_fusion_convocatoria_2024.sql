-- v61 — "Dg 001 2024" y "DG-0001-2024" eran la misma: se fusionan.
-- La 1 se pasa a la 4 y se elimina. La 4 queda en periodo 01.

SET SERVEROUTPUT ON;

DECLARE
  v_origen   CONSTANT NUMBER := 1;   -- Dg 001 2024, la duplicada
  v_destino  CONSTANT NUMBER := 4;   -- DG-0001-2024, la que queda
  v_existe   NUMBER;
  v_choques  NUMBER;
  v_form     NUMBER;
  v_docs     NUMBER := 0;
  v_parts    NUMBER := 0;
  v_preg     NUMBER := 0;
BEGIN
  SELECT COUNT(*) INTO v_existe
    FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = v_origen;
  IF v_existe = 0 THEN
    DBMS_OUTPUT.PUT_LINE('La convocatoria ' || v_origen || ' ya no existe: nada que hacer.');
    RETURN;
  END IF;

  -- si alguien estuviera en las dos, la fusion le crearia dos participaciones del mismo ciclo
  SELECT COUNT(*) INTO v_choques
    FROM EVALUADORPARTICIPACION a
    JOIN EVALUADORPARTICIPACION b
      ON b.EVALUADORID = a.EVALUADORID AND b.CONVOCATORIAID = v_destino
   WHERE a.CONVOCATORIAID = v_origen;
  IF v_choques > 0 THEN
    RAISE_APPLICATION_ERROR(-20001,
      v_choques || ' evaluadores estan en las dos convocatorias. Revisar antes de fusionar.');
  END IF;

  UPDATE CONVOCATORIADOCUMENTO SET CONVOCATORIAID = v_destino WHERE CONVOCATORIAID = v_origen;
  v_docs := SQL%ROWCOUNT;

  UPDATE EVALUADORPARTICIPACION SET CONVOCATORIAID = v_destino WHERE CONVOCATORIAID = v_origen;
  v_parts := SQL%ROWCOUNT;

  -- el instrumento de la duplicada sobra: la 4 ya tiene el suyo con las mismas preguntas
  BEGIN
    SELECT RETROFORMULARIOID INTO v_form
      FROM RETROFORMULARIO WHERE CONVOCATORIAID = v_origen FETCH FIRST 1 ROWS ONLY;
    DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID = v_form;
    v_preg := SQL%ROWCOUNT;
    DELETE FROM RETROFORMULARIO WHERE RETROFORMULARIOID = v_form;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    v_form := NULL;
  END;

  DELETE FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = v_origen;

  -- al quedar una sola, el periodo 02 no tiene sentido
  UPDATE EVALUADORCONVOCATORIA SET PERIODO = '01' WHERE CONVOCATORIAID = v_destino;
  UPDATE EVALUADORPARTICIPACION SET PERIODO = '01'
   WHERE CONVOCATORIAID = v_destino AND TRIM(PERIODO) <> '01';

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('v61: ' || v_parts || ' participaciones y ' || v_docs
    || ' documentos pasados a la ' || v_destino || '; formulario ' || NVL(TO_CHAR(v_form), '-')
    || ' borrado con ' || v_preg || ' preguntas.');
END;
/

-- Comprobación
SET LINESIZE 200
COLUMN NOMBRE FORMAT A34
SELECT cv.CONVOCATORIAID, cv.ANIO, TRIM(cv.PERIODO) AS PERIODO, TRIM(cv.NOMBRE) AS NOMBRE,
       (SELECT COUNT(*) FROM EVALUADORPARTICIPACION pa
         WHERE pa.CONVOCATORIAID = cv.CONVOCATORIAID) AS PARTICIPACIONES,
       (SELECT COUNT(*) FROM EVALUADORPARTICIPACION pa
         WHERE pa.CONVOCATORIAID = cv.CONVOCATORIAID AND TRIM(pa.PERIODO) <> '01') AS FUERA_DE_P01
  FROM EVALUADORCONVOCATORIA cv
 WHERE cv.ANIO = 2024
 ORDER BY cv.CONVOCATORIAID;

-- REVERSA: se restaura con el respaldo que deja el runner
-- (scratchpad/respaldo-v61.json): devolver CONVOCATORIAID y PERIODO a
-- sus valores originales y volver a insertar la fila de la convocatoria 1.
