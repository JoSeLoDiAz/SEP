-- v59 — instrumento histórico de retroalimentación (2019-2025).
-- Reemplaza las preguntas de los años anteriores. 2026 no se toca.

SET SERVEROUTPUT ON;

DECLARE
  v_form   NUMBER;
  v_tocados NUMBER := 0;
  v_resp    NUMBER;

  PROCEDURE poner(p_num NUMBER, p_tipo NVARCHAR2, p_texto NVARCHAR2) IS
  BEGIN
    INSERT INTO RETROPREGUNTA
      (RETROPREGUNTAID, RETROFORMULARIOID, NUMERO, TEXTO, CRITERIOS, TIPO, PESO, REQUERIDA, ORDEN, ACTIVO)
    VALUES (RETROPREGUNTA_SEQ.NEXTVAL, v_form, p_num, p_texto, NULL, p_tipo, 1, 1, p_num * 10, 1);
  END;
BEGIN
  -- si ya hay respuestas cargadas, no se reescribe nada
  SELECT COUNT(*) INTO v_resp FROM RETRORESPUESTA;
  IF v_resp > 0 THEN
    DBMS_OUTPUT.PUT_LINE('Hay ' || v_resp || ' respuestas: no se toca el instrumento.');
    RETURN;
  END IF;

  FOR c IN (SELECT cv.CONVOCATORIAID, cv.ANIO
              FROM EVALUADORCONVOCATORIA cv
             WHERE cv.ANIO <= 2025
             ORDER BY cv.ANIO) LOOP
    BEGIN
      SELECT RETROFORMULARIOID INTO v_form
        FROM RETROFORMULARIO
       WHERE CONVOCATORIAID = c.CONVOCATORIAID AND ACTIVO = 1
       ORDER BY VERSION DESC FETCH FIRST 1 ROWS ONLY;
    EXCEPTION WHEN NO_DATA_FOUND THEN
      CONTINUE;
    END;

    DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID = v_form;

    poner(1, N'ESCALA', N'¿Es responsable con los proyectos asignados, cronograma del proceso de evaluación y con la información del GGPC?');
    poner(2, N'ESCALA', N'¿Cuenta con habilidades informáticas para manejar los programas que hacen parte de la evaluación (SEP, SharePoint, Excel, Adobe, otros)?');
    poner(3, N'ESCALA', N'¿Cuenta con un dominio técnico sobre el pliego, anexos y adendas de la convocatoria (financiera y técnicamente)?');
    poner(4, N'ESCALA', N'¿Identifica problemáticas en los proyectos y plantea soluciones en el proceso de evaluación ante las inquietudes y dudas técnico-metodológicas que se presentaron en el proceso?');
    poner(5, N'ESCALA', N'¿Cómo considera usted el rendimiento general realizado por el evaluador?');
    poner(6, N'TEXTO_POR_PERSONA', N'¿Recomendaría usted al evaluador calificado para próximos procesos de evaluación de convocatorias del GGPC?');
    poner(7, N'TEXTO_POR_PERSONA', N'¿Recomendaría usted al evaluador calificado para que participe de manera presencial o de manera PAT en futuros procesos?');

    UPDATE RETROFORMULARIO
       SET NOMBRE = N'Retroalimentación ' || c.ANIO || N' (instrumento histórico)'
     WHERE RETROFORMULARIOID = v_form;

    v_tocados := v_tocados + 1;
  END LOOP;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('v59: ' || v_tocados || ' formularios con el instrumento histórico');
END;
/

-- Comprobación
SET LINESIZE 200
COLUMN NOMBRE FORMAT A46
SELECT f.RETROFORMULARIOID, cv.ANIO, TRIM(f.NOMBRE) AS NOMBRE,
       (SELECT COUNT(*) FROM RETROPREGUNTA q WHERE q.RETROFORMULARIOID = f.RETROFORMULARIOID) AS PREGUNTAS
  FROM RETROFORMULARIO f
  JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = f.CONVOCATORIAID
 WHERE f.ACTIVO = 1
 ORDER BY cv.ANIO;

-- REVERSA: volver a correr docs/migraciones/v49_replantilla_retroalimentacion.sql
-- tras borrar las preguntas de esos formularios.
