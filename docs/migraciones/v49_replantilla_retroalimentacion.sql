-- Repone la plantilla base del instrumento de retroalimentación.

SET SERVEROUTPUT ON;

DECLARE
  v_form_id NUMBER;

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
  -- Se busca por lo MISMO que consulta el backend, no por el nombre: si el
  BEGIN
    SELECT RETROFORMULARIOID INTO v_form_id
      FROM RETROFORMULARIO
     WHERE CONVOCATORIAID IS NULL AND ACTIVO = 1
     ORDER BY VERSION DESC FETCH FIRST 1 ROWS ONLY;
    DBMS_OUTPUT.PUT_LINE('Ya existía la plantilla base (id ' || v_form_id || '). Solo se revisan las preguntas.');
  EXCEPTION WHEN NO_DATA_FOUND THEN
    SELECT RETROFORMULARIO_SEQ.NEXTVAL INTO v_form_id FROM DUAL;
    INSERT INTO RETROFORMULARIO
      (RETROFORMULARIOID, CONVOCATORIAID, NOMBRE, VERSION, ESCALAMIN, ESCALAMAX,
       DURACIONMINUTOS, RESULTADOANONIMO, ACTIVO, ABIERTO, USUARIOCREACION)
      VALUES (v_form_id, NULL, N'Retroalimentación FCE — plantilla base', 1, 1, 5,
              60, 1, 1, 0, 'seed-v49');
    DBMS_OUTPUT.PUT_LINE('Plantilla base creada (id ' || v_form_id || ').');
  END;

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

  COMMIT;

  DECLARE
    v_n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_n FROM RETROPREGUNTA WHERE RETROFORMULARIOID = v_form_id;
    IF v_n <> 12 THEN
      RAISE_APPLICATION_ERROR(-20049, 'La plantilla quedo con ' || v_n || ' preguntas y deben ser 12.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('Plantilla base lista: 12 preguntas, escala 1-5.');
    DBMS_OUTPUT.PUT_LINE('Abrir la matriz de cada convocatoria para que se clone su copia del año.');
  END;
END;
/
