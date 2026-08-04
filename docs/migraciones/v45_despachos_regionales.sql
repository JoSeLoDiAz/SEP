-- v45_despachos_regionales.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Falta el despacho de la regional en casi todas las regionales.
--
-- Reportado desde Tolima ("en Tolima no está el despacho"), pero al cotejar
-- el banco completo contra el catálogo resultó ser general: de las 34
-- regionales, la ÚNICA con su despacho cargado es Antioquia (código 1010).
-- Dirección General tiene el suyo aparte (1001).
--
-- En el archivo del banco, 30 evaluadores están adscritos al despacho de su
-- regional y lo escriben de cinco formas distintas —"DESPACHO DIRECCIÓN",
-- "DIRECCIÓN REGIONAL", "DIRECION REGIONAL", "DESPACHO REGIONAL", "REGIONAL
-- <nombre>"— justamente porque no hay ninguna opción que escoger.
--
-- Qué hace: crea "Despacho Regional" en cada regional que no lo tenga.
--
-- ⚠  SOBRE EL CÓDIGO
--    Los CENTROID son los códigos oficiales del SENA y no se pueden deducir:
--    Antioquia es la regional 5 y su despacho es 1010, así que no hay
--    fórmula. Aquí se usa 1000 + REGIONALID, que es determinista, legible y
--    no choca con nada de lo cargado (en el rango 1000-1099 solo están
--    ocupados 1001 y 1010).
--
--    Si consigue los códigos oficiales de los despachos, es mejor cargarlos
--    con esos: el día que se recargue el catálogo del SENA, estos quedarían
--    duplicados y los evaluadores repartidos entre dos registros.
--
-- CIUDADID se deja en NULL a propósito: la columna lo permite y poner la
-- capital "a ojo" en 26 regionales es inventar dato. Se puede completar
-- después sin afectar el desplegable, que solo filtra por regional.
--
-- Idempotente: si la regional ya tiene despacho, no la toca.
-- Puede correrse como SEP_APP: no lleva DDL.
-- ──────────────────────────────────────────────────────────────────────────

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


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se comprueba el HECHO: que no queda ninguna regional sin despacho.

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
