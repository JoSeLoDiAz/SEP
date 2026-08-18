-- v45_despachos_regionales.sql

SET SERVEROUTPUT ON;

DECLARE
  v_creados NUMBER := 0;
  v_id      NUMBER;
BEGIN
  FOR r IN (SELECT REGIONALID id, TRIM(REGIONALNOMBRE) nom FROM REGIONAL ORDER BY 2) LOOP
    -- Dirección General ya tiene el suyo (1001) y no es una regional más.
    IF r.id <> 1 THEN
      DECLARE
        v_tiene NUMBER;
        v_choca NUMBER;
      BEGIN
        SELECT COUNT(*) INTO v_tiene FROM CENTROFORMACION
         WHERE REGIONALID = r.id
           AND (UPPER(TRIM(CENTRONOMBRE)) LIKE '%DESPACHO%'
             OR UPPER(TRIM(CENTRONOMBRE)) LIKE '%DIRECCION REGIONAL%');

        IF v_tiene > 0 THEN
          NULL;  -- ya lo tiene
        ELSE
          v_id := 1000 + r.id;
          SELECT COUNT(*) INTO v_choca FROM CENTROFORMACION WHERE CENTROID = v_id;
          IF v_choca > 0 THEN
            DBMS_OUTPUT.PUT_LINE('OJO  ' || RPAD(r.nom, 24) ||
              'el codigo ' || v_id || ' ya esta ocupado; se omite');
          ELSE
            INSERT INTO CENTROFORMACION
              (CENTROID, REGIONALID, CENTRONOMBRE, CIUDADID, CENTROACTIVO)
            VALUES (v_id, r.id, 'Despacho Regional', NULL, 1);
            v_creados := v_creados + 1;
            DBMS_OUTPUT.PUT_LINE('  ' || LPAD(v_id, 5) || '  ' || r.nom);
          END IF;
        END IF;
      END;
    END IF;
  END LOOP;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('-- Despachos creados: ' || v_creados);
END;
/

-- Verificación

DECLARE
  v_faltan NUMBER := 0;
BEGIN
  DBMS_OUTPUT.PUT_LINE('-- Regionales sin despacho --');
  FOR r IN (SELECT REGIONALID id, TRIM(REGIONALNOMBRE) nom FROM REGIONAL
             WHERE REGIONALID <> 1 ORDER BY 2) LOOP
    DECLARE v_n NUMBER;
    BEGIN
      SELECT COUNT(*) INTO v_n FROM CENTROFORMACION
       WHERE REGIONALID = r.id AND CENTROACTIVO = 1
         AND (UPPER(TRIM(CENTRONOMBRE)) LIKE '%DESPACHO%'
           OR UPPER(TRIM(CENTRONOMBRE)) LIKE '%DIRECCION REGIONAL%');
      IF v_n = 0 THEN
        v_faltan := v_faltan + 1;
        DBMS_OUTPUT.PUT_LINE('  FALTA: ' || r.nom);
      END IF;
    END;
  END LOOP;

  IF v_faltan > 0 THEN
    RAISE_APPLICATION_ERROR(-20045, v_faltan || ' regional(es) siguen sin despacho.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('  ninguna');
  DBMS_OUTPUT.PUT_LINE('-- Listo: todas las regionales tienen su despacho en el desplegable.');
END;
/
