-- v38_retro_instrumento_16_preguntas.sql

-- 1. Etiquetas de la escala

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE RETROFORMULARIO ADD (ESCALAETIQUETAS NVARCHAR2(400))';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

COMMENT ON COLUMN RETROFORMULARIO.ESCALAETIQUETAS IS
  'JSON {"1":"Deficiente",...,"5":"Excelente"}. Se congela con el instrumento del ciclo.';

UPDATE RETROFORMULARIO
   SET ESCALAETIQUETAS = N'{"1":"Deficiente","2":"Bajo","3":"Aceptable","4":"Bueno","5":"Excelente"}'
 WHERE ESCALAETIQUETAS IS NULL;

-- 2. Reemplazo de las preguntas de la plantilla base

DECLARE
  v_form_id   NUMBER;
  v_clonados  NUMBER;
  v_respuestas NUMBER;

  PROCEDURE preg(
    p_num NUMBER, p_tipo NVARCHAR2, p_peso NUMBER, p_req NUMBER,
    p_texto NVARCHAR2, p_crit NVARCHAR2
  ) IS
  BEGIN
    INSERT INTO RETROPREGUNTA
      (RETROPREGUNTAID, RETROFORMULARIOID, NUMERO, TEXTO, CRITERIOS, TIPO, PESO, REQUERIDA, ORDEN)
      VALUES (RETROPREGUNTA_SEQ.NEXTVAL, v_form_id, p_num, p_texto, p_crit,
              p_tipo, p_peso, p_req, p_num * 10);
  END;
BEGIN
  SELECT RETROFORMULARIOID INTO v_form_id
    FROM RETROFORMULARIO
   WHERE CONVOCATORIAID IS NULL AND ACTIVO = 1 AND ROWNUM = 1;

  -- Guardarraíl: si alguien ya respondió sobre la plantilla base (no debería
  SELECT COUNT(*) INTO v_respuestas
    FROM RETRORESPUESTAITEM i
    JOIN RETROPREGUNTA q ON q.RETROPREGUNTAID = i.RETROPREGUNTAID
   WHERE q.RETROFORMULARIOID = v_form_id;

  IF v_respuestas > 0 THEN
    RAISE_APPLICATION_ERROR(-20010,
      'v38 ABORTADA: la plantilla base tiene ' || v_respuestas || ' respuestas asociadas. ' ||
      'No se puede reemplazar sus preguntas sin perder ese histórico.');
  END IF;

  SELECT COUNT(*) INTO v_clonados
    FROM RETROFORMULARIO WHERE CONVOCATORIAID IS NOT NULL;
  DBMS_OUTPUT.PUT_LINE('Instrumentos ya clonados (NO se tocan): ' || v_clonados);

  DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID = v_form_id;

  -- Escala 1 a 5
  preg(1, N'ESCALA', 5, 1,
    N'¿Cumplió de manera oportuna y responsable con las actividades y proyectos asignados durante el proceso de evaluación?',
    N'Responsabilidad, cumplimiento y gestión del tiempo');
  preg(2, N'ESCALA', 5, 1,
    N'¿Cumplió los tiempos establecidos en el cronograma del proceso de evaluación, entregando los productos requeridos dentro de los plazos definidos?',
    N'Gestión del tiempo y cumplimiento de plazos');
  preg(3, N'ESCALA', 5, 1,
    N'¿Demostró puntualidad y cumplimiento de la jornada laboral, manteniendo la disponibilidad requerida durante el proceso de evaluación?',
    N'Puntualidad, disponibilidad y disciplina laboral');
  preg(4, N'ESCALA', 5, 1,
    N'¿Demostró dominio técnico y metodológico de los documentos de la convocatoria (pliego de condiciones, anexos, adendas y demás lineamientos aplicables)?',
    N'Conocimiento técnico de la convocatoria');
  preg(5, N'ESCALA', 5, 1,
    N'¿Aplicó de manera objetiva, coherente, consistente y transparente los criterios generales de evaluación establecidos para la convocatoria?',
    N'Objetividad, criterio técnico e integridad');
  preg(6, N'ESCALA', 5, 1,
    N'¿Demostró capacidad para identificar inconsistencias, analizar situaciones complejas y proponer soluciones para el proceso de evaluación de sus proyectos o procesos?',
    N'Pensamiento analítico y resolución de problemas');
  preg(7, N'ESCALA', 5, 1,
    N'¿Utilizó de manera eficiente las herramientas tecnológicas requeridas para el proceso (Ficha de evaluación, SharePoint, Excel, Adobe y demás destinadas para el proceso)?',
    N'Competencias digitales');
  preg(8, N'ESCALA', 5, 1,
    N'¿Mantuvo una comunicación efectiva, respetuosa y colaborativa con los demás actores del proceso (líderes, analistas, evaluadores y equipo GGPC)?',
    N'Trabajo en equipo y comunicación');
  preg(9, N'ESCALA', 5, 1,
    N'¿La calidad de los conceptos y observaciones remitidas durante la evaluación fueron claras, técnicas y suficientemente argumentadas de acuerdo con la temática?',
    N'Calidad técnica del trabajo');
  preg(10, N'ESCALA', 5, 1,
    N'¿Demostró iniciativa y autonomía para desarrollar las actividades asignadas, requiriendo el nivel adecuado de acompañamiento durante el proceso de evaluación?',
    N'Proactividad y desarrollo autónomo de actividades');
  preg(11, N'ESCALA', 5, 1,
    N'¿Atendió de manera oportuna, clara y técnicamente adecuada las respuestas a las subsanaciones que le fueron asignadas, de acuerdo con los lineamientos establecidos en la convocatoria?',
    N'Oportunidad, calidad técnica y capacidad de respuesta');
  preg(12, N'ESCALA', 5, 1,
    N'¿Atendió de manera oportuna y efectiva los requerimientos, orientaciones y solicitudes realizadas por el líder, los analistas o el equipo del GGPC durante el proceso de evaluación?',
    N'Seguimiento de instrucciones y capacidad de respuesta');
  preg(13, N'ESCALA', 5, 1,
    N'¿Cómo califica el desempeño integral de la persona durante el proceso de evaluación de proyectos?',
    N'Percepción global del desempeño');
  preg(14, N'ESCALA', 5, 1,
    N'¿Recomendaría la participación de esta persona en futuros procesos de evaluación del Grupo de Gestión para la Productividad y la Competitividad (GGPC)?',
    N'Idoneidad para futuras convocatorias');

  -- Abiertas
  preg(15, N'TEXTO_POR_PERSONA', 0, 0,
    N'¿Qué recomendaciones, observaciones o comentarios considera pertinentes para tener en cuenta sobre el desempeño de la persona evaluada en futuros procesos?',
    NULL);
  preg(16, N'TEXTO_GENERAL', 0, 0,
    N'¿Qué acciones de mejora propones para el proceso de evaluación de este tipo de convocatorias?',
    NULL);

  UPDATE RETROFORMULARIO
     SET NOMBRE = N'Retroalimentación FCE — plantilla base',
         VERSION = VERSION + 1,
         ESCALAETIQUETAS = N'{"1":"Deficiente","2":"Bajo","3":"Aceptable","4":"Bueno","5":"Excelente"}'
   WHERE RETROFORMULARIOID = v_form_id;

  DBMS_OUTPUT.PUT_LINE('Plantilla base actualizada a 16 preguntas (14 de escala + 2 abiertas).');
END;
/

-- 3. Verificación

DECLARE
  v_total NUMBER; v_escala NUMBER; v_abiertas NUMBER;
BEGIN
  SELECT COUNT(*),
         SUM(CASE WHEN TIPO = N'ESCALA' THEN 1 ELSE 0 END),
         SUM(CASE WHEN TIPO IN (N'TEXTO_POR_PERSONA', N'TEXTO_GENERAL') THEN 1 ELSE 0 END)
    INTO v_total, v_escala, v_abiertas
    FROM RETROPREGUNTA q
    JOIN RETROFORMULARIO f ON f.RETROFORMULARIOID = q.RETROFORMULARIOID
   WHERE f.CONVOCATORIAID IS NULL AND f.ACTIVO = 1;

  DBMS_OUTPUT.PUT_LINE('── Verificación v38 ────────────────');
  DBMS_OUTPUT.PUT_LINE('Total preguntas : ' || v_total    || '   (debe ser 16)');
  DBMS_OUTPUT.PUT_LINE('De escala       : ' || v_escala   || '   (debe ser 14)');
  DBMS_OUTPUT.PUT_LINE('Abiertas        : ' || v_abiertas || '   (debe ser 2)');

  IF v_total != 16 OR v_escala != 14 OR v_abiertas != 2 THEN
    RAISE_APPLICATION_ERROR(-20011, 'v38: el conteo de preguntas no cuadra.');
  END IF;
END;
/

COMMIT;
