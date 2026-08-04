-- v47_convocatorias_2019_2020.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Faltan las convocatorias anteriores a 2022, y sin ellas no se pueden
-- registrar las participaciones más viejas del banco.
--
-- En el archivo del banco hay evaluadores desde 2019:
--
--   2019  FCE  19 evaluadores
--   2020  FCE  33 evaluadores
--
-- y en la tabla CONVOCATORIA no existe nada anterior a 2022. Por eso al
-- registrar una participación de esos años no hay convocatoria que escoger, y
-- el ciclo queda huérfano: sin invitación heredada, fuera de la matriz de
-- retroalimentación y sin poder certificar.
--
-- Qué hace:
--   1. Crea las convocatorias del SEP de 2019 y 2020 (programa FCE).
--   2. Endereza el ciclo del banco "Dg-0001-2019", que se creó apuntando a la
--      convocatoria de 2022 porque no había otra: pasa a apuntar a la de 2019
--      y su año queda en 2019. Tiene 0 participaciones, así que no arrastra
--      nada; se conserva en vez de borrarlo para no perder lo ya hecho.
--   3. Crea el ciclo del banco de 2020.
--
-- ⚠  SOBRE LOS PRESUPUESTOS
--    Las columnas de presupuesto son obligatorias y aquí van en 0, igual que
--    las convocatorias de 2022, 2023 y 2024 que ya están cargadas así. NO se
--    inventan cifras: estas convocatorias se crean para anclar el año de las
--    participaciones del banco, no para operar proyectos. Si después se cargan
--    los valores reales, se actualizan sin afectar nada de esto.
--
--    Las fechas de inicio y cierre quedan en NULL por lo mismo.
--
-- ⚠  2021 NO SE CREA
--    Se reportó que existen dos convocatorias FCE de 2021, pero el archivo del
--    banco no trae ningún evaluador de ese año y no se conocen sus nombres.
--    Al final hay un bloque listo para habilitarlas cuando se confirmen.
--
-- Idempotente. Puede correrse como SEP_APP: no lleva DDL.
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

-- ── 1. Las convocatorias del SEP ─────────────────────────────────────────
DECLARE
  k_programa CONSTANT NUMBER := 1;   -- Formación Continua Especializada

  PROCEDURE crear(p_anio NUMBER, p_nombre VARCHAR2) IS
    v_n  NUMBER;
    v_id NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_n FROM CONVOCATORIA
     WHERE CONVOCATORIAANIO = p_anio AND UPPER(TRIM(CONVOCATORIANOMBRE)) = UPPER(p_nombre);
    IF v_n > 0 THEN
      DBMS_OUTPUT.PUT_LINE('ya existe   ' || p_nombre);
      RETURN;
    END IF;

    SELECT NVL(MAX(CONVOCATORIAID), 0) + 1 INTO v_id FROM CONVOCATORIA;
    INSERT INTO CONVOCATORIA (
      CONVOCATORIAID, CONVOCATORIAANIO, CONVOCATORIANOMBRE,
      CONVOCATORIAPRESUPUESTOTOTAL, CONVOCATORIAPRESUPUESTOMAXIMO,
      CONVOCATORIAMESESPROYECTO, CONVOCATORIATIPOFINANCIACION,
      CONVOCATORIAESTADOCONVOCATORIA, CONVOCATORIAESTADO,
      PROGRAMAID, CONVOCATORIARESULTADOSPUBLICADOS, CONVOCATORIAFECHAREGISTRO)
    VALUES (
      v_id, p_anio, p_nombre,
      0, 0,
      0, 'COFINANCIACIÓN',
      'CERRADA', 0,
      k_programa, 0, SYSDATE);
    DBMS_OUTPUT.PUT_LINE('creada  id=' || LPAD(v_id, 3) || '  ' || p_nombre);
  END;
BEGIN
  crear(2019, 'DG-0001-2019');
  crear(2020, 'DG-0001-2020');
  COMMIT;
END;
/


-- ── 2 y 3. Los ciclos del banco ──────────────────────────────────────────
DECLARE
  v_sep2019 NUMBER;
  v_sep2020 NUMBER;
  v_ciclo   NUMBER;
  v_n       NUMBER;
BEGIN
  SELECT CONVOCATORIAID INTO v_sep2019 FROM CONVOCATORIA
   WHERE CONVOCATORIAANIO = 2019 AND UPPER(TRIM(CONVOCATORIANOMBRE)) = 'DG-0001-2019';
  SELECT CONVOCATORIAID INTO v_sep2020 FROM CONVOCATORIA
   WHERE CONVOCATORIAANIO = 2020 AND UPPER(TRIM(CONVOCATORIANOMBRE)) = 'DG-0001-2020';

  -- 2. El ciclo que se creó apuntando a 2022 se endereza en vez de borrarse.
  UPDATE EVALUADORCONVOCATORIA
     SET ANIO = 2019, PERIODO = '01', CONVOCATORIASEPID = v_sep2019,
         NOMBRE = 'DG-0001-2019'
   WHERE UPPER(TRIM(NOMBRE)) = 'DG-0001-2019' AND ANIO <> 2019;
  IF SQL%ROWCOUNT > 0 THEN
    DBMS_OUTPUT.PUT_LINE('enderezado  el ciclo 2019 ahora apunta a su convocatoria');
  END IF;

  -- 3. El de 2020, si no está.
  SELECT COUNT(*) INTO v_n FROM EVALUADORCONVOCATORIA
   WHERE ANIO = 2020 AND CONVOCATORIASEPID = v_sep2020;
  IF v_n = 0 THEN
    SELECT NVL(MAX(CONVOCATORIAID), 0) + 1 INTO v_ciclo FROM EVALUADORCONVOCATORIA;
    INSERT INTO EVALUADORCONVOCATORIA
      (CONVOCATORIAID, ANIO, PERIODO, NOMBRE, CONVOCATORIASEPID, ACTIVO, FECHACREACION)
    VALUES (v_ciclo, 2020, '01', 'DG-0001-2020', v_sep2020, 1, SYSDATE);
    DBMS_OUTPUT.PUT_LINE('creado      ciclo del banco 2020-01');
  ELSE
    DBMS_OUTPUT.PUT_LINE('ya existe   ciclo del banco 2020');
  END IF;

  COMMIT;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se comprueba el HECHO: que 2019 y 2020 ya se pueden escoger, y que ningún
-- ciclo del banco quedó con el año distinto al de su convocatoria.

DECLARE
  v_falla NUMBER := 0;
BEGIN
  DBMS_OUTPUT.PUT_LINE('-- Convocatorias del SEP --');
  FOR c IN (SELECT CONVOCATORIAANIO a, TRIM(CONVOCATORIANOMBRE) n FROM CONVOCATORIA
             ORDER BY 1, 2) LOOP
    DBMS_OUTPUT.PUT_LINE('  ' || c.a || '  ' || c.n);
  END LOOP;

  FOR y IN (SELECT 2019 a FROM dual UNION ALL SELECT 2020 FROM dual) LOOP
    DECLARE v_n NUMBER;
    BEGIN
      SELECT COUNT(*) INTO v_n FROM CONVOCATORIA WHERE CONVOCATORIAANIO = y.a;
      IF v_n = 0 THEN
        v_falla := v_falla + 1;
        DBMS_OUTPUT.PUT_LINE('  FALTA la convocatoria de ' || y.a);
      END IF;
    END;
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('-- Ciclos del banco cuyo anio no coincide con su convocatoria --');
  FOR c IN (SELECT ec.CONVOCATORIAID id, ec.ANIO a, TRIM(ec.NOMBRE) n, cv.CONVOCATORIAANIO sa
              FROM EVALUADORCONVOCATORIA ec
              JOIN CONVOCATORIA cv ON cv.CONVOCATORIAID = ec.CONVOCATORIASEPID
             WHERE ec.ANIO <> cv.CONVOCATORIAANIO) LOOP
    v_falla := v_falla + 1;
    DBMS_OUTPUT.PUT_LINE('  ciclo ' || c.id || ' "' || c.n || '" dice ' || c.a ||
      ' pero su convocatoria es de ' || c.sa);
  END LOOP;

  IF v_falla > 0 THEN
    RAISE_APPLICATION_ERROR(-20047, v_falla || ' problema(s). Revise la salida.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('  ninguno');
  DBMS_OUTPUT.PUT_LINE('-- Listo: 2019 y 2020 ya se pueden escoger al crear un ciclo.');
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2021 — habilitar cuando se confirmen los nombres                        ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se reportó que hay DOS convocatorias FCE de 2021. Quite los comentarios y
-- ponga los nombres reales cuando los tenga.
--
-- DECLARE
--   v_id NUMBER;
--   PROCEDURE crear2021(p_nombre VARCHAR2) IS
--   BEGIN
--     SELECT NVL(MAX(CONVOCATORIAID), 0) + 1 INTO v_id FROM CONVOCATORIA;
--     INSERT INTO CONVOCATORIA (
--       CONVOCATORIAID, CONVOCATORIAANIO, CONVOCATORIANOMBRE,
--       CONVOCATORIAPRESUPUESTOTOTAL, CONVOCATORIAPRESUPUESTOMAXIMO,
--       CONVOCATORIAMESESPROYECTO, CONVOCATORIATIPOFINANCIACION,
--       CONVOCATORIAESTADOCONVOCATORIA, CONVOCATORIAESTADO,
--       PROGRAMAID, CONVOCATORIARESULTADOSPUBLICADOS, CONVOCATORIAFECHAREGISTRO)
--     VALUES (v_id, 2021, p_nombre, 0, 0, 0, 'COFINANCIACIÓN',
--             'CERRADA', 0, 1, 0, SYSDATE);
--   END;
-- BEGIN
--   crear2021('<<nombre de la primera>>');
--   crear2021('<<nombre de la segunda>>');
--   COMMIT;
-- END;
-- /
