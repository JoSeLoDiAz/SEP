-- v36_evaluador_limpieza.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ⚠️  NO EJECUTAR TODAVÍA.  ⚠️
--
-- Esta es la ÚNICA migración destructiva del rediseño. Elimina las columnas
-- que quedaron sin uso después de v29-v35. Se ejecuta cuando se cumplan las
-- tres condiciones:
--
--   1. Al menos un sprint completo con el módulo nuevo en producción.
--   2. La gestión de evaluadores validó que la migración del CLOB PROYECTOSEVALUADOS (v32) quedó
--      correcta — es la única cuyo dato no se puede reconstruir.
--   3. Backup del schema tomado el mismo día.
--
-- Antes de correrla, ejecutar la sección 0 (verificación) y confirmar que
-- todos los contadores dan lo esperado.
--
-- Ejecutar como SEPLOCAL.
-- ──────────────────────────────────────────────────────────────────────────


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 0. VERIFICACIÓN PREVIA — correr esto primero y leer la salida           ║
-- ╚════════════════════════════════════════════════════════════════════════╝

SET SERVEROUTPUT ON;

DECLARE
  v_clob_con_texto   NUMBER;
  v_filas_migradas   NUMBER;
  v_part_sin_estado  NUMBER;
  v_modalidad_huerf  NUMBER;
  v_quienaprueba     NUMBER;
  v_aprobaciones     NUMBER;
  v_otrosest         NUMBER;

  -- Los contadores sobre columnas que esta misma migración dropea tienen que
  -- ir por SQL dinámico: si ya se corrió una vez, la columna no existe y el
  -- script no compilaría.
  FUNCTION contar(p_sql VARCHAR2) RETURN NUMBER IS
    v NUMBER;
  BEGIN
    EXECUTE IMMEDIATE p_sql INTO v;
    RETURN v;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -904 THEN RETURN 0; END IF;  -- ORA-00904: columna ya dropeada
    RAISE;
  END;
BEGIN
  v_clob_con_texto := contar(
    'SELECT COUNT(*) FROM EVALUADORPARTICIPACION
      WHERE PROYECTOSEVALUADOS IS NOT NULL
        AND DBMS_LOB.GETLENGTH(PROYECTOSEVALUADOS) > 0');

  SELECT COUNT(DISTINCT PARTICIPACIONID) INTO v_filas_migradas
    FROM EVALUADORPARTPROYECTO;

  SELECT COUNT(*) INTO v_part_sin_estado
    FROM EVALUADORPARTICIPACION WHERE ESTADOPARTID IS NULL;

  v_modalidad_huerf := contar(
    'SELECT COUNT(*) FROM EVALUADORPARTICIPACION
      WHERE MODALIDADPART IS NOT NULL AND MODALIDADPARTID IS NULL');

  v_quienaprueba := contar(
    'SELECT COUNT(*) FROM EVALUADOR
      WHERE EVALUADORQUIENAPRUEBA IS NOT NULL
        AND LENGTH(TRIM(EVALUADORQUIENAPRUEBA)) > 0');

  v_otrosest := contar(
    'SELECT COUNT(*) FROM EVALUADOR
      WHERE EVALUADOROTROSEST IS NOT NULL
        AND DBMS_LOB.GETLENGTH(EVALUADOROTROSEST) > 0');

  SELECT COUNT(*) INTO v_aprobaciones FROM EVALUADORAPROBACION;

  DBMS_OUTPUT.PUT_LINE('── Verificación previa v36 ─────────────────────────');
  DBMS_OUTPUT.PUT_LINE('Participaciones con CLOB de proyectos  : ' || v_clob_con_texto);
  DBMS_OUTPUT.PUT_LINE('Participaciones ya normalizadas        : ' || v_filas_migradas ||
                       '   (debe ser >= la anterior)');
  DBMS_OUTPUT.PUT_LINE('Participaciones sin estado             : ' || v_part_sin_estado ||
                       '   (debe ser 0)');
  DBMS_OUTPUT.PUT_LINE('Modalidades texto sin mapear a catálogo: ' || v_modalidad_huerf ||
                       '   (debe ser 0)');
  DBMS_OUTPUT.PUT_LINE('EVALUADORQUIENAPRUEBA con texto        : ' || v_quienaprueba ||
                       '   (debe ser <= filas en EVALUADORAPROBACION)');
  DBMS_OUTPUT.PUT_LINE('Filas en EVALUADORAPROBACION           : ' || v_aprobaciones);
  DBMS_OUTPUT.PUT_LINE('EVALUADOROTROSEST con texto            : ' || v_otrosest ||
                       '   (debe ser 0 — no hay migración automática)');
  DBMS_OUTPUT.PUT_LINE('───────────────────────────────────────────────────');

  -- ⚠️ Este bloque tenía un defecto en su primera versión: imprimía el
  -- contador de EVALUADORQUIENAPRUEBA pero NO lo incluía en la condición de
  -- aborto, así que dejó dropear una columna con texto sin migrar. Corregido:
  -- ahora cada contador impreso también bloquea.
  IF v_part_sin_estado > 0 THEN
    RAISE_APPLICATION_ERROR(-20001,
      'v36 ABORTADA: hay ' || v_part_sin_estado || ' participaciones sin ESTADOPARTID. Correr la v34 primero.');
  END IF;

  IF v_modalidad_huerf > 0 THEN
    RAISE_APPLICATION_ERROR(-20002,
      'v36 ABORTADA: hay ' || v_modalidad_huerf || ' modalidades en texto que no mapearon al catálogo. ' ||
      'Revisar MODALIDADPART antes de dropear la columna.');
  END IF;

  IF v_filas_migradas < v_clob_con_texto THEN
    RAISE_APPLICATION_ERROR(-20003,
      'v36 ABORTADA: ' || v_clob_con_texto || ' participaciones tienen PROYECTOSEVALUADOS con texto pero ' ||
      'solo ' || v_filas_migradas || ' quedaron normalizadas. Correr la v32 de nuevo.');
  END IF;

  IF v_quienaprueba > v_aprobaciones THEN
    RAISE_APPLICATION_ERROR(-20004,
      'v36 ABORTADA: hay ' || v_quienaprueba || ' evaluadores con EVALUADORQUIENAPRUEBA en texto y solo ' ||
      v_aprobaciones || ' filas en EVALUADORAPROBACION. El backfill de la v34 solo alcanza a los ' ||
      'evaluadores CON participaciones; los que no tienen ninguna quedan sin migrar y su dato se perdería. ' ||
      'Crearles la participación primero, o anotar el valor a mano antes de continuar.');
  END IF;

  IF v_otrosest > 0 THEN
    RAISE_APPLICATION_ERROR(-20005,
      'v36 ABORTADA: hay ' || v_otrosest || ' evaluadores con texto en EVALUADOROTROSEST. ' ||
      'Ese texto NO se migra automáticamente a EVALUADORESTUDIO. Revisarlo y pasarlo a mano ' ||
      'antes de dropear la columna, o vaciarla explícitamente si no aporta nada.');
  END IF;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 1. DROP de columnas muertas                                             ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Idempotente: ORA-00904 = la columna ya no existe.

DECLARE
  PROCEDURE drop_col(p_tabla VARCHAR2, p_col VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_tabla || ' DROP COLUMN ' || p_col;
    DBMS_OUTPUT.PUT_LINE('DROP  ' || p_tabla || '.' || p_col);
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -904 OR SQLCODE = -942 THEN
      DBMS_OUTPUT.PUT_LINE('skip  ' || p_tabla || '.' || p_col || ' (ya no existe)');
    ELSE
      RAISE;
    END IF;
  END;
BEGIN
  -- Reemplazada por las 3 columnas estructuradas de v25 (JEFENOMBRE/EMAIL/CARGO).
  drop_col('EVALUADOR', 'EVALUADORJEFEDIR');

  -- Reemplazada por EVALUADORAPROBACION (v30), migrada en v34 §5.6.
  drop_col('EVALUADOR', 'EVALUADORQUIENAPRUEBA');

  -- Texto libre paralelo a EVALUADORESTUDIO, que ya tiene tipo, institución y PDF.
  drop_col('EVALUADOR', 'EVALUADOROTROSEST');

  -- Reemplazado por EVALUADORPARTPROYECTO (v32).
  drop_col('EVALUADORPARTICIPACION', 'PROYECTOSEVALUADOS');

  -- Reemplazada por el estado REVOCADO del catálogo ESTADOPARTICIPACION (v29).
  drop_col('EVALUADORPARTICIPACION', 'PROCESOREVOCADO');

  -- Reemplazadas por FK a MODALIDADPART (v29), backfill en v34 §5.1.
  drop_col('EVALUADORPARTICIPACION', 'MODALIDADPART');
  drop_col('EVALUADORCONVOCATORIA', 'MODALIDADPART');
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Lo que se conserva a propósito (no borrar)                           ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
--   EVALUADOR.EVALUADORPROFESION   — resumen para el listado, la búsqueda y
--   EVALUADOR.EVALUADORPOSGRADO      el PDF de la ficha. Duplican parcialmente
--                                    EVALUADORESTUDIO, pero el formulario los
--                                    autosugiere desde ahí en vez de pedirlos
--                                    dos veces. Borrarlos obligaría a un JOIN
--                                    con agregación en todas las pantallas.
--
--   EVALUADORDOCUMENTO.ANIOREFERENCIA — sigue sirviendo para documentos con año
--                                    pero sin ciclo asociado (histórico suelto).
--
--   EVALUADORPARTICIPACION.MESA    — texto libre a propósito: la nomenclatura de
--   EVALUADORPARTICIPACION.EQUIPOEVALUADOR  mesas cambia año a año y no vale la
--                                    pena un catálogo que nadie va a mantener.
--                                    El dato estructurado del grupo ya está en
--                                    EVALUADORPARTGRUPO.

COMMIT;
