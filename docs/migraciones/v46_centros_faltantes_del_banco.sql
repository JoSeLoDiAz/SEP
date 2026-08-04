-- v46_centros_faltantes_del_banco.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Los dos centros que de verdad faltaban, después de cotejar las 480 filas
-- del banco contra el catálogo.
--
--   Complejo Mixto Regional                  Antioquia            4 evaluadores
--   Centro de Formación para el Desarrollo   Norte de Santander  10 evaluadores
--   Rural y Minero (CEDRUM)
--
-- El CEDRUM aparece escrito de cuatro formas distintas en el archivo —con la
-- sigla delante, detrás, y sin ella— justamente porque no hay ninguna opción
-- que escoger. No existe en ninguna regional del catálogo; Norte de Santander
-- solo tiene el Centro Atención Sector Agropecuario, el Centro de la
-- Industria la Empresa y los Servicios, y el despacho.
--
-- Qué NO entra aquí, y por qué:
--
--   CSET (Santander)                    ya existe: 9309, "Centro de Servicios
--                                       Empresariales y Turísticos"
--   Centro para el Desarrollo del       existe (9203) pero en ANTIOQUIA. En el
--   Hábitat y la Construcción           archivo está bajo Cesar: hay que
--                                       corregir la regional del evaluador,
--                                       no crear un centro
--   "REGIONAL BOYACÁ", "DIRECCIÓN       eran el despacho de la regional, que
--   REGIONAL TOLIMA" y demás            ya creó la v45
--   33 nombres más                      son variantes de escritura del Excel
--                                       ("COMERCIO Y SERVICIOS" por "Centro de
--                                       Comercio y Servicios"): crearlos
--                                       duplicaría el catálogo
--
-- ⚠  SOBRE LOS CÓDIGOS — la misma advertencia de la v43 y la v45.
--    Los CENTROID son los códigos oficiales del SENA y no se pueden deducir.
--    Aquí van dos libres que no chocan con nada. Si consigue los oficiales,
--    cámbielos abajo antes de correr: el día que se recargue el catálogo del
--    SENA estos quedarían duplicados y los evaluadores repartidos entre dos
--    registros.
--
-- CIUDADID queda NULL, igual que en los despachos de la v45.
--
-- Idempotente: lo que ya exista por nombre o por código no se toca.
-- Puede correrse como SEP_APP: no lleva DDL.
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

DECLARE
  TYPE t_centro IS RECORD (
    id       NUMBER,
    regional NUMBER,
    nombre   VARCHAR2(200),
    patron   VARCHAR2(100)   -- para reconocerlo si ya está con otro nombre
  );
  TYPE t_lista IS TABLE OF t_centro;

  -- ── Revise los códigos ─────────────────────────────────────────────────
  v_centros t_lista := t_lista(
    t_centro(9550,  5, 'Complejo Mixto Regional',                            '%COMPLEJO MIXTO%'),
    t_centro(9551, 54, 'Centro de Formación para el Desarrollo Rural y Minero', '%RURAL Y MINERO%')
  );
  -- ───────────────────────────────────────────────────────────────────────

  v_porNombre NUMBER;
  v_porCodigo NUMBER;
  v_creados   NUMBER := 0;
BEGIN
  FOR i IN 1 .. v_centros.COUNT LOOP
    SELECT COUNT(*) INTO v_porNombre FROM CENTROFORMACION
     WHERE REGIONALID = v_centros(i).regional
       AND UPPER(TRIM(CENTRONOMBRE)) LIKE v_centros(i).patron;

    SELECT COUNT(*) INTO v_porCodigo FROM CENTROFORMACION
     WHERE CENTROID = v_centros(i).id;

    IF v_porNombre > 0 THEN
      DBMS_OUTPUT.PUT_LINE('ya existe   ' || v_centros(i).nombre);
    ELSIF v_porCodigo > 0 THEN
      DBMS_OUTPUT.PUT_LINE('OJO         codigo ' || v_centros(i).id ||
        ' ocupado; escoja otro para ' || v_centros(i).nombre);
    ELSE
      INSERT INTO CENTROFORMACION (CENTROID, REGIONALID, CENTRONOMBRE, CIUDADID, CENTROACTIVO)
      VALUES (v_centros(i).id, v_centros(i).regional, v_centros(i).nombre, NULL, 1);
      v_creados := v_creados + 1;
      DBMS_OUTPUT.PUT_LINE('creado ' || LPAD(v_centros(i).id, 5) || '  ' || v_centros(i).nombre);
    END IF;
  END LOOP;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('-- Creados: ' || v_creados);
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se comprueba el HECHO: que los dos salen activos en su regional, que es lo
-- que el desplegable necesita para ofrecerlos.

DECLARE
  v_a NUMBER;
  v_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_a FROM CENTROFORMACION
   WHERE REGIONALID = 5 AND CENTROACTIVO = 1
     AND UPPER(TRIM(CENTRONOMBRE)) LIKE '%COMPLEJO MIXTO%';

  SELECT COUNT(*) INTO v_n FROM CENTROFORMACION
   WHERE REGIONALID = 54 AND CENTROACTIVO = 1
     AND UPPER(TRIM(CENTRONOMBRE)) LIKE '%RURAL Y MINERO%';

  DBMS_OUTPUT.PUT_LINE('Antioquia, Complejo Mixto Regional  : ' || v_a);
  DBMS_OUTPUT.PUT_LINE('Norte de Santander, CEDRUM          : ' || v_n);

  DBMS_OUTPUT.PUT_LINE('-- Centros de Norte de Santander --');
  FOR c IN (SELECT CENTROID id, TRIM(CENTRONOMBRE) nom FROM CENTROFORMACION
             WHERE REGIONALID = 54 AND CENTROACTIVO = 1 ORDER BY CENTRONOMBRE) LOOP
    DBMS_OUTPUT.PUT_LINE('  ' || LPAD(c.id, 5) || '  ' || c.nom);
  END LOOP;

  IF v_a = 0 OR v_n = 0 THEN
    RAISE_APPLICATION_ERROR(-20046, 'Alguno de los dos centros no quedo disponible.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('-- Listo: los dos salen en su desplegable.');
END;
/
