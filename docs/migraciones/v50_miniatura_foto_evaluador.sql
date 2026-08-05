-- Guarda una miniatura de la foto del evaluador, aparte de la original.
--
-- Las fotos son de 60 a 280 KB y se muestran en tarjetas de 100 píxeles. Una
-- página del banco descargaba más de 2 MB solo en retratos, y la más pesada se
-- cortaba a medio camino en redes que no van finas — se veía el círculo con la
-- inicial y parecía que la persona no tenía foto.
--
-- La miniatura pesa unos 20 KB y es la que se muestra. La original NO se toca
-- y sigue siendo la que se descarga y la que sale en la ficha PDF, que se
-- imprime y necesita la resolución completa.
--
-- Nada que rellenar a mano: la miniatura se genera al cargar la foto, y las
-- que ya estaban se generan solas la primera vez que alguien las mira.
--
-- Idempotente. Ejecutar como SEPLOCAL (agrega columna).

SET SERVEROUTPUT ON;

DECLARE
  v_n NUMBER;
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE EVALUADOR ADD (EVALUADORFOTOMINI BLOB)';
  DBMS_OUTPUT.PUT_LINE('Columna EVALUADORFOTOMINI agregada.');
EXCEPTION WHEN OTHERS THEN
  -- ORA-01430: la columna ya existe. Correr esto dos veces no es un error.
  IF SQLCODE = -1430 THEN
    DBMS_OUTPUT.PUT_LINE('La columna EVALUADORFOTOMINI ya existía.');
  ELSE
    RAISE;
  END IF;
END;
/

-- COMMENT no admite concatenacion: el texto va en un solo literal.
COMMENT ON COLUMN EVALUADOR.EVALUADORFOTOMINI IS
  'Miniatura JPEG (lado mayor 400 px) de EVALUADORFOTO, para mostrar en pantalla. La original se conserva y es la que se descarga y la que va en la ficha PDF. Se genera sola: al cargar la foto, o la primera vez que se pide si la fila es anterior a la v50.';

DECLARE
  v_n NUMBER;
BEGIN
  -- Verificación: que la columna esté y que las fotos sigan enteras.
  SELECT COUNT(*) INTO v_n FROM ALL_TAB_COLUMNS
   WHERE TABLE_NAME = 'EVALUADOR' AND COLUMN_NAME = 'EVALUADORFOTOMINI';
  IF v_n = 0 THEN
    RAISE_APPLICATION_ERROR(-20050, 'No quedo la columna EVALUADORFOTOMINI.');
  END IF;

  SELECT COUNT(*) INTO v_n FROM EVALUADOR
   WHERE NVL(DBMS_LOB.GETLENGTH(EVALUADORFOTO), 0) > 0;
  DBMS_OUTPUT.PUT_LINE('Fotos originales intactas: ' || v_n);
  DBMS_OUTPUT.PUT_LINE('Las miniaturas se generan solas al abrir el banco.');
END;
/
