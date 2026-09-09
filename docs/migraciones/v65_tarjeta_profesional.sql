-- v65 — tipo de documento "Tarjeta o matrícula profesional".
--
-- Es un documento de la persona, no de un año ni de un estudio: va en su propia
-- tarjeta en el perfil, al lado de la cédula, y hay uno solo por evaluador
-- (ADMITEMULTIPLE = 0, igual que CEDULA).
--
-- ORDEN = 15 para que quede justo después de la cédula (10) y antes de la
-- autorización (20). Acepta PDF y foto (jpg/jpeg/png): casi siempre la toman
-- con el celular. El mapa de extensiones vive en formatos-correo.ts.

SET SERVEROUTPUT ON;

DECLARE
  v_existe NUMBER;
  v_id     NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_existe
    FROM TIPODOCUMENTOEVAL WHERE UPPER(TRIM(CODIGO)) = 'TARJETA_PROFESIONAL';

  IF v_existe > 0 THEN
    DBMS_OUTPUT.PUT_LINE('TARJETA_PROFESIONAL ya existe, no se toca');
  ELSE
    -- MAX+1: la tabla no tiene secuencia asociada
    SELECT NVL(MAX(TIPODOCUMENTOEVALID), 0) + 1 INTO v_id FROM TIPODOCUMENTOEVAL;
    INSERT INTO TIPODOCUMENTOEVAL
      (TIPODOCUMENTOEVALID, CODIGO, NOMBRE, ADMITEMULTIPLE, ORDEN, ACTIVO)
    VALUES (v_id, 'TARJETA_PROFESIONAL', 'Tarjeta o matrícula profesional', 0, 15, 1);
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('TARJETA_PROFESIONAL creada con id ' || v_id);
  END IF;
END;
/
