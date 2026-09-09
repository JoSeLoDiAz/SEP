-- El dinamizador de la mesa, escrito a mano.

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
