-- El dinamizador de la mesa, escrito a mano.
--
-- Hasta ahora la participación solo podía apuntar a una PERSONA registrada
-- (DINAMIZADORPERSONAID). La ficha mostraba "Dinamizó", el PDF lo imprimía…
-- y nunca se llenó: 0 de 102 participaciones lo tienen, porque no había
-- ningún formulario donde ponerlo. Quien dinamiza una mesa no siempre está
-- en el banco ni hace falta que lo esté, así que se guarda el nombre tal
-- cual, igual que EQUIPOEVALUADOR.
--
-- La columna vieja NO se borra. Está vacía y no estorba, y quitarla sería un
-- cambio destructivo a cambio de nada. El backend lee la nueva y, si viene
-- vacía, cae en el nombre de la persona enlazada — así una fila antigua
-- (ninguna hoy) seguiría viéndose.
--
-- 500 caracteres, los mismos que MESA y EQUIPOEVALUADOR: un nombre cabe de
-- sobra y no hay razón para que este campo se corte antes que sus hermanos.
--
-- Idempotente. Ejecutar como SEPLOCAL (agrega columna).

SET SERVEROUTPUT ON;

DECLARE
  v_n NUMBER;
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE EVALUADORPARTICIPACION ADD (DINAMIZADOR VARCHAR2(500))';
  DBMS_OUTPUT.PUT_LINE('Columna DINAMIZADOR agregada.');
EXCEPTION WHEN OTHERS THEN
  -- ORA-01430: ya existe. Correrlo dos veces no es un error.
  IF SQLCODE = -1430 THEN
    DBMS_OUTPUT.PUT_LINE('La columna DINAMIZADOR ya existía.');
  ELSE
    RAISE;
  END IF;
END;
/

COMMENT ON COLUMN EVALUADORPARTICIPACION.DINAMIZADOR IS
  'Nombre de quien dinamizo la mesa, en texto libre. Sustituye a DINAMIZADORPERSONAID, que quedo sin uso: el dinamizador no siempre esta registrado como persona del SEP.';

DECLARE
  v_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_n FROM ALL_TAB_COLUMNS
   WHERE TABLE_NAME = 'EVALUADORPARTICIPACION' AND COLUMN_NAME = 'DINAMIZADOR';
  IF v_n = 0 THEN
    RAISE_APPLICATION_ERROR(-20051, 'No quedo la columna DINAMIZADOR.');
  END IF;

  SELECT COUNT(*) INTO v_n FROM EVALUADORPARTICIPACION;
  DBMS_OUTPUT.PUT_LINE('Participaciones intactas: ' || v_n);
END;
/
