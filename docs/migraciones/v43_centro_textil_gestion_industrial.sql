-- v43_centro_textil_gestion_industrial.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Falta un centro de formación en el catálogo: el Centro Textil y de Gestión
-- Industrial, de la Regional Antioquia.
--
-- Reportado al registrar a David Alexander Fique, que pertenece a ese centro
-- y no lo encontraba en el desplegable. Se comprobó: el catálogo tiene 116
-- centros en 34 regionales —la estructura completa— y Antioquia tiene 15,
-- pero ese no está entre ellos. El centro existe (centrotgi.blogspot.com).
--
-- ⚠  ANTES DE CORRER: revise el CENTROID de abajo.
--
--    Los CENTROID de esta tabla NO son un consecutivo: son los códigos
--    oficiales del SENA (9101, 9206, 9212…) y no siguen un bloque por
--    regional —los 92xx están repartidos entre las regionales 5, 8 y 11—,
--    así que el código correcto no se puede deducir de los que ya hay.
--
--    Aquí va MAX+1, que no choca con nada de lo cargado. Si tiene a la mano
--    el código oficial del centro, reemplácelo en la constante y corra con
--    ese: así el día que se recargue el catálogo oficial no aparece
--    duplicado y los evaluadores no quedan repartidos entre dos registros.
--
-- Idempotente: si el centro ya existe (por nombre o por código), no hace nada.
-- Puede correrse como SEP_APP: no lleva DDL.
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

DECLARE
  -- ── Revise esto ────────────────────────────────────────────────────────
  k_centroid   CONSTANT NUMBER        := 9549;  -- código oficial si lo tiene
  k_nombre     CONSTANT VARCHAR2(200) := 'Centro Textil y de Gestión Industrial';
  k_regional   CONSTANT NUMBER        := 5;     -- Antioquia
  k_ciudad     CONSTANT NUMBER        := 5001;  -- Medellín
  -- ───────────────────────────────────────────────────────────────────────

  v_porNombre  NUMBER;
  v_porCodigo  NUMBER;
BEGIN
  -- Se busca por nombre normalizado para no crear un duplicado si alguien ya
  -- lo cargó con otras tildes o mayúsculas.
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


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se comprueba el HECHO: que el centro aparece entre los de Antioquia y
-- activo, que es lo que el desplegable necesita para mostrarlo.

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
