-- v60 — cada convocatoria anterior registra sus propias preguntas.
-- Solo la c4 (DG-0001-2024) conserva la hoja; el resto queda en cero.

SET SERVEROUTPUT ON;

DECLARE
  v_modelo  CONSTANT NUMBER := 4;  -- convocatoria DG-0001-2024, la de la hoja conocida
  v_resp    NUMBER;
  v_borrados NUMBER := 0;
  v_forms    NUMBER := 0;
BEGIN
  SELECT COUNT(*) INTO v_resp FROM RETRORESPUESTA;
  IF v_resp > 0 THEN
    DBMS_OUTPUT.PUT_LINE('Hay ' || v_resp || ' respuestas: no se toca el instrumento.');
    RETURN;
  END IF;

  FOR f IN (SELECT f.RETROFORMULARIOID, f.CONVOCATORIAID, cv.ANIO, cv.NOMBRE
              FROM RETROFORMULARIO f
              JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = f.CONVOCATORIAID
             WHERE cv.ANIO <= 2025
               AND f.CONVOCATORIAID <> v_modelo
             ORDER BY cv.ANIO) LOOP

    DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID = f.RETROFORMULARIOID;
    v_borrados := v_borrados + SQL%ROWCOUNT;
    v_forms := v_forms + 1;

    UPDATE RETROFORMULARIO
       SET NOMBRE = N'Retroalimentación ' || f.ANIO || N' — ' || f.NOMBRE
     WHERE RETROFORMULARIOID = f.RETROFORMULARIOID;
  END LOOP;

  UPDATE RETROFORMULARIO
     SET NOMBRE = N'Retroalimentación 2024 — DG-0001-2024 (hoja del GGPC)'
   WHERE CONVOCATORIAID = v_modelo;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('v60: ' || v_forms || ' formularios sin preguntas ('
    || v_borrados || ' borradas). Queda el modelo en la convocatoria ' || v_modelo || '.');
END;
/

-- Comprobación
SET LINESIZE 200
COLUMN NOMBRE FORMAT A52
SELECT cv.ANIO, f.CONVOCATORIAID, TRIM(f.NOMBRE) AS NOMBRE,
       (SELECT COUNT(*) FROM RETROPREGUNTA q WHERE q.RETROFORMULARIOID = f.RETROFORMULARIOID) AS PREGUNTAS
  FROM RETROFORMULARIO f
  JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = f.CONVOCATORIAID
 WHERE f.ACTIVO = 1
 ORDER BY cv.ANIO, f.CONVOCATORIAID;

-- REVERSA: volver a correr docs/migraciones/v59_retro_instrumento_historico.sql.
