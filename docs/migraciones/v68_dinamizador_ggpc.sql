-- v68 — "Dinamizador GGPC" como fuente de retroalimentación, aparte del ciclo.
--
-- Hasta ahora una retroalimentación solo podía venir de otro participante del
-- MISMO ciclo: RETROASIGNACION.PARTEVALUADORID y RETRORESPUESTA.PARTEVALUADORID
-- son NOT NULL con llave foránea a EVALUADORPARTICIPACION (v33), y encima
-- retro-historico.service.ts exige que autor y evaluado sean de la misma
-- convocatoria. El dinamizador del GGPC no es evaluador y no está inscrito en
-- ningún ciclo, así que no tenía por dónde entrar.
--
-- SEP_APP no tiene permiso de DDL, así que aquí no se toca ni una tabla: solo
-- se insertan tres filas. La pieza que lo hace posible es que
-- EVALUADORPARTICIPACION.CONVOCATORIAID es NULLABLE (solo PARTICIPACIONID,
-- EVALUADORID y ANIO son obligatorias).
--
-- Se crea UNA sola participación centinela, con CONVOCATORIAID NULL, que sirve
-- de autor para todos los años. Al no pertenecer a ninguna convocatoria queda
-- fuera por construcción de las cuatro consultas que filtran por ella —la
-- matriz (retro-matriz.service.ts), el tablero de avance
-- (retroalimentacion.service.ts), la lista de compañeros y los participantes
-- del Excel—, así que no ensucia ningún conteo. Y como sí tiene PERSONA y
-- EVALUADOR detrás, ningún JOIN al autor se cae: la lista "ya cargadas", la
-- pantalla de resultados y el PDF siguen mostrando la fila, con el nombre
-- "Dinamizador GGPC".
--
-- Una sola fila alcanza para todos los años porque UQ_RETROASIG_PAR es
-- (RETROFORMULARIOID, PARTEVALUADORID, PARTEVALUADOID): el formulario cambia
-- con la convocatoria y el evaluado cambia con el año, así que el par nunca
-- choca entre ciclos, y dentro de un mismo ciclo sigue impidiendo cargarla dos
-- veces. Igual que antes, gratis.
--
-- ANIO es NOT NULL y el centinela no pertenece a ningún año: se le pone 0, que
-- no es un año. catalogos.service.ts filtra ANIO > 0 para que ese 0 no aparezca
-- en el desplegable de años del banco.
--
-- El nombre propio de quien dinamizó cada mesa NO se guarda aquí: ya está en
-- EVALUADORPARTICIPACION.DINAMIZADOR de la persona evaluada (lleno hoy en 84 de
-- 303 filas), que es donde corresponde, porque hay un dinamizador por mesa y no
-- uno por ciclo (23 distintos en 2024, 10 en 2026).
--
-- EVALUADORACTIVO = 0 a propósito: no es un evaluador del banco. Pero eso NO
-- basta para dejarlo fuera del listado, porque el botón "Con inactivos" cambia
-- ese filtro por 1 = 1; por eso evaluadores.service.ts lo excluye además por
-- identificación, sin condición. Lo mismo pasaba con el tablero del ciclo: no
-- queda fuera "por construcción" de todo, solo de lo que filtra por el autor.
--
-- Idempotente: correrlo dos veces no duplica nada.

SET SERVEROUTPUT ON;

DECLARE
  -- NCHAR rellena con espacios: todas las comparaciones van con TRIM
  c_identificacion CONSTANT VARCHAR2(40) := 'GGPC-DINAMIZADOR';
  c_nombres        CONSTANT VARCHAR2(40) := 'Dinamizador';
  c_apellido       CONSTANT VARCHAR2(40) := 'GGPC';
  -- dominio .local a propósito: no existe, para que nunca salga un correo hacia allá
  c_email          CONSTANT VARCHAR2(60) := 'dinamizador.ggpc@sep.local';
  c_tipo_doc       CONSTANT NUMBER := 5;   -- "Otro": no es una cédula de nadie

  v_persona     NUMBER;
  v_evaluador   NUMBER;
  v_participa   NUMBER;
BEGIN
  ------------------------------------------------------------------ PERSONA
  BEGIN
    SELECT PERSONAID INTO v_persona
      FROM PERSONA
     WHERE TRIM(PERSONAIDENTIFICACION) = c_identificacion;
    DBMS_OUTPUT.PUT_LINE('PERSONA ya existía: ' || v_persona);
  EXCEPTION WHEN NO_DATA_FOUND THEN
    SELECT PERSONAID.NEXTVAL INTO v_persona FROM dual;
    INSERT INTO PERSONA (
      PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONAIDENTIFICACION,
      PERSONANOMBRES, PERSONAPRIMERAPELLIDO, PERSONAEMAIL, PERSONAFECHAREGISTRO)
    VALUES (
      v_persona, c_tipo_doc, c_identificacion,
      c_nombres, c_apellido, c_email, SYSDATE);
    DBMS_OUTPUT.PUT_LINE('PERSONA creada: ' || v_persona);
  END;

  ---------------------------------------------------------------- EVALUADOR
  BEGIN
    SELECT EVALUADORID INTO v_evaluador
      FROM EVALUADOR WHERE PERSONAID = v_persona;
    DBMS_OUTPUT.PUT_LINE('EVALUADOR ya existía: ' || v_evaluador);
  EXCEPTION WHEN NO_DATA_FOUND THEN
    SELECT EVALUADOR_SEQ.NEXTVAL INTO v_evaluador FROM dual;
    INSERT INTO EVALUADOR (EVALUADORID, PERSONAID, EVALUADORACTIVO, FECHACREACION)
    VALUES (v_evaluador, v_persona, 0, SYSDATE);
    DBMS_OUTPUT.PUT_LINE('EVALUADOR creado (inactivo): ' || v_evaluador);
  END;

  ------------------------------------------------- PARTICIPACION CENTINELA
  BEGIN
    SELECT PARTICIPACIONID INTO v_participa
      FROM EVALUADORPARTICIPACION
     WHERE EVALUADORID = v_evaluador AND CONVOCATORIAID IS NULL;
    DBMS_OUTPUT.PUT_LINE('PARTICIPACION centinela ya existía: ' || v_participa);
  EXCEPTION WHEN NO_DATA_FOUND THEN
    SELECT EVALUADORPARTICIPACION_SEQ.NEXTVAL INTO v_participa FROM dual;
    INSERT INTO EVALUADORPARTICIPACION (
      PARTICIPACIONID, EVALUADORID, ANIO,
      CONVOCATORIAID, ROLEVALUADORID, AREAID, ESTADOPARTID, USUARIOCREACION)
    VALUES (
      v_participa, v_evaluador, 0,
      NULL, NULL, NULL, NULL, 'migracion v68');
    DBMS_OUTPUT.PUT_LINE('PARTICIPACION centinela creada: ' || v_participa);
  END;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('--');
  DBMS_OUTPUT.PUT_LINE('Dinamizador GGPC listo. participacionId = ' || v_participa);
END;
/

-- Comprobación: debe devolver exactamente una fila, sin convocatoria y con el
-- evaluador inactivo, y no debe haber ninguna OTRA participación sin convocatoria.
SELECT pa.PARTICIPACIONID, pa.ANIO, pa.CONVOCATORIAID, e.EVALUADORACTIVO,
       TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS NOMBRE
  FROM EVALUADORPARTICIPACION pa
  JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
  JOIN PERSONA   p ON p.PERSONAID   = e.PERSONAID
 WHERE pa.CONVOCATORIAID IS NULL;
