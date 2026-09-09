-- v44_equipo_evaluador_mas_largo.sql

  SET SERVEROUTPUT ON;

  DECLARE
    k_nuevo CONSTANT NUMBER := 500;

    PROCEDURE ampliar(p_col VARCHAR2) IS
      v_actual NUMBER;
    BEGIN
      SELECT CHAR_LENGTH INTO v_actual FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'EVALUADORPARTICIPACION' AND COLUMN_NAME = p_col;

      IF v_actual >= k_nuevo THEN
        DBMS_OUTPUT.PUT_LINE(RPAD(p_col, 20) || 'ya estaba en ' || v_actual);
      ELSE
        EXECUTE IMMEDIATE 'ALTER TABLE EVALUADORPARTICIPACION MODIFY (' ||
          p_col || ' VARCHAR2(' || k_nuevo || '))';
        DBMS_OUTPUT.PUT_LINE(RPAD(p_col, 20) || v_actual || ' -> ' || k_nuevo);
      END IF;
    END;
  BEGIN
    ampliar('MESA');
    ampliar('EQUIPOEVALUADOR');
  END;
  /

  -- Verificación

  DECLARE
    v_len  NUMBER;
    v_part NUMBER;
    v_ant  VARCHAR2(500);
    k_texto CONSTANT VARCHAR2(500) :=
      'Aline Isabel Melo Henriquez, Andrea Suarez, Alejandro Arias Osorio, ' ||
      'Francisco Javier Arazo Gomez, Yesenia Lizeth Duarte Meza';
  BEGIN
    SELECT CHAR_LENGTH INTO v_len FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'EVALUADORPARTICIPACION' AND COLUMN_NAME = 'EQUIPOEVALUADOR';
    DBMS_OUTPUT.PUT_LINE('EQUIPOEVALUADOR admite ahora ' || v_len || ' caracteres.');
    DBMS_OUTPUT.PUT_LINE('El texto reportado mide ' || LENGTH(k_texto) || '.');

    IF v_len < LENGTH(k_texto) THEN
      RAISE_APPLICATION_ERROR(-20044, 'La columna sigue siendo mas corta que el caso reportado.');
    END IF;

    SELECT MIN(PARTICIPACIONID) INTO v_part FROM EVALUADORPARTICIPACION;
    IF v_part IS NULL THEN
      DBMS_OUTPUT.PUT_LINE('(no hay participaciones para probar la escritura)');
    ELSE
      SELECT EQUIPOEVALUADOR INTO v_ant FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = v_part;
      UPDATE EVALUADORPARTICIPACION SET EQUIPOEVALUADOR = k_texto WHERE PARTICIPACIONID = v_part;
      DBMS_OUTPUT.PUT_LINE('Escritura del texto completo: OK');
      ROLLBACK;
      DBMS_OUTPUT.PUT_LINE('Deshecho: el ciclo quedo con lo que tenia.');
    END IF;

    DBMS_OUTPUT.PUT_LINE('-- Listo: ya cabe la lista del equipo evaluador.');
  END;
  /
