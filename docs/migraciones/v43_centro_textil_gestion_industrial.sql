-- v43_centro_textil_gestion_industrial.sql

SET SERVEROUTPUT ON;

DECLARE
  -- Revise esto
  k_centroid   CONSTANT NUMBER        := 9549;  -- código oficial si lo tiene
  k_nombre     CONSTANT VARCHAR2(200) := 'Centro Textil y de Gestión Industrial';
  k_regional   CONSTANT NUMBER        := 5;     -- Antioquia
  k_ciudad     CONSTANT NUMBER        := 5001;  -- Medellín

  v_porNombre  NUMBER;
  v_porCodigo  NUMBER;
BEGIN
  -- Se busca por nombre normalizado para no crear un duplicado si alguien ya
  SELECT COUNT(*) INTO v_porNombre FROM CENTROFORMACION
   WHERE REGIONALID = k_regional
     AND UPPER(TRIM(CENTRONOMBRE)) LIKE '%TEXTIL%GESTI%INDUSTRIAL%';

  SELECT COUNT(*) INTO v_porCodigo FROM CENTROFORMACION WHERE CENTROID = k_centroid;

  IF v_porNombre > 0 THEN
    DBMS_OUTPUT.PUT_LINE('Ya existe un centro con ese nombre en Antioquia. No se hace nada.');
  ELSIF v_porCodigo > 0 THEN
    DBMS_OUTPUT.PUT_LINE('El codigo ' || k_centroid || ' ya esta ocupado por otro centro.');
    DBMS_OUTPUT.PUT_LINE('Escoja otro CENTROID en la constante y vuelva a correr.');
  ELSE
    INSERT INTO CENTROFORMACION (CENTROID, REGIONALID, CENTRONOMBRE, CIUDADID, CENTROACTIVO)
    VALUES (k_centroid, k_regional, k_nombre, k_ciudad, 1);
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Centro creado con codigo ' || k_centroid || '.');
  END IF;
END;
/

-- Verificación

DECLARE
  v_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_n FROM CENTROFORMACION
   WHERE REGIONALID = 5 AND CENTROACTIVO = 1
     AND UPPER(TRIM(CENTRONOMBRE)) LIKE '%TEXTIL%GESTI%INDUSTRIAL%';

  DBMS_OUTPUT.PUT_LINE('-- Centros activos de Antioquia --');
  FOR c IN (SELECT CENTROID id, TRIM(CENTRONOMBRE) nom FROM CENTROFORMACION
             WHERE REGIONALID = 5 AND CENTROACTIVO = 1 ORDER BY CENTRONOMBRE) LOOP
    DBMS_OUTPUT.PUT_LINE('  ' || LPAD(c.id, 5) || '  ' || c.nom);
  END LOOP;

  IF v_n = 0 THEN
    RAISE_APPLICATION_ERROR(-20043, 'El centro no quedo disponible en el desplegable.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('-- Listo: el centro ya sale en el desplegable de Antioquia.');
END;
/
