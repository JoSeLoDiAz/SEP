-- v44_equipo_evaluador_mas_largo.sql
-- ──────────────────────────────────────────────────────────────────────────
-- "Equipo evaluador" no cabe en 120 caracteres.
--
-- El campo se diseñó para una etiqueta corta ("Equipo A"), pero en la práctica
-- las gestoras escriben la lista de quienes lo componen, que es información
-- útil y es lo que tienen a la mano cuando registran:
--
--   Aline Isabel Melo Henriquez, Andrea Suarez, Alejandro Arias Osorio,
--   Francisco Javier Arazo Gomez, Yesenia Lizeth Duarte Meza      -> 124
--
-- Con VARCHAR2(120) eso no entra, y Oracle responde ORA-12899, que llegaba a
-- la pantalla como "Internal server error": ni el campo, ni cuánto sobraba.
-- Ese mensaje ya está traducido en el backend, pero el límite real sigue
-- siendo demasiado corto para el uso que tiene.
--
-- Qué hace: lleva MESA y EQUIPOEVALUADOR a 500 caracteres. Solo AMPLÍA; en
-- Oracle un VARCHAR2 es de longitud variable, así que no ocupa más espacio
-- por estar declarado más grande, y ninguna fila existente se toca.
--
-- Si esta migración se corre tarde no se rompe nada: hasta entonces el
-- backend dice exactamente qué campo se pasó y por cuántos caracteres, y con
-- eso se puede acortar y guardar.
--
-- Idempotente. Ejecutar como SEPLOCAL en SQL Developer (lleva DDL).
-- ──────────────────────────────────────────────────────────────────────────

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


  -- ╔════════════════════════════════════════════════════════════════════════╗
  -- ║ Verificación                                                            ║
  -- ╚════════════════════════════════════════════════════════════════════════╝
  -- Se comprueba el HECHO: que el texto que no cabía ahora entra. La fila de
  -- prueba se deshace.

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
