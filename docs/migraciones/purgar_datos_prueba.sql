-- purgar_datos_prueba.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Limpieza de los datos que dejan las verificaciones de punta a punta del
-- módulo de evaluadores. NO es una migración: se corre cuando haga falta.
--
-- Reemplaza a `purgar_datos_prueba_certificados.sql`, que cubría solo un caso.
--
-- ¿Por qué hay que correrla a mano como SEPLOCAL?
--   `SEP_APP` tiene sobre EVALUADORCERTIFICADO solo SELECT, INSERT y UPDATE
--   (v37) — deliberadamente, para que un documento oficial que ya circuló no
--   pueda desaparecer desde la aplicación. Como consecuencia, la app tampoco
--   puede borrar sus propios datos de prueba, y por FK eso arrastra a la
--   participación, al evaluador, a la persona y a la convocatoria.
--
--   Es el diseño funcionando, no un defecto. Pero significa que cualquier
--   prueba que llegue a emitir un certificado necesita esta purga.
--
-- Qué borra, y solo eso:
--   · certificados de los años de prueba (2027 y 2028)
--   · participaciones marcadas PRUEBA_%
--   · convocatorias llamadas PRUEBA_%
--   · personas con identificación 9000000xx–9000003xx
--   · usuarios @prueba-*.local
--
-- Los años 2027 y 2028 se usaron a propósito para no quemar consecutivos de
-- la serie 2026, que es la que va a usarse de verdad.
--
-- Idempotente. Ejecutar como SEPLOCAL en SQL Developer.
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

DECLARE
  TYPE t_txt IS TABLE OF VARCHAR2(4000);
  v_sqls t_txt := t_txt(
    -- Certificados primero: son los que bloquean todo lo demás.
    'DELETE FROM EVALUADORCERTIFICADO WHERE ANIO IN (2027, 2028)',

    -- Retroalimentación de los ciclos de prueba
    'DELETE FROM RETRORESPUESTAITEM WHERE RETRORESPUESTAID IN
       (SELECT r.RETRORESPUESTAID FROM RETRORESPUESTA r
         WHERE r.PARTEVALUADORID IN (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION
                                      WHERE OBSERVACIONES LIKE ''PRUEBA_%''))',
    'UPDATE RETROASIGNACION SET RETRORESPUESTAID = NULL
      WHERE PARTEVALUADORID IN (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION
                                 WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM RETRORESPUESTA WHERE PARTEVALUADORID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM RETROASIGNACION WHERE PARTEVALUADORID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM RETROSUGERENCIA WHERE PARTICIPACIONID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM RETROSESION WHERE PARTICIPACIONID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',

    -- Hijos del ciclo
    'DELETE FROM EVALUADORPARTPROYECTO WHERE PARTICIPACIONID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM EVALUADORCAPACITACION WHERE PARTICIPACIONID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM EVALUADORAPROBACION WHERE PARTICIPACIONID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM EVALUADORPARTGRUPO WHERE PARTICIPACIONID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',
    'DELETE FROM EVALUADORPARTALCANCE WHERE PARTICIPACIONID IN
       (SELECT PARTICIPACIONID FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%'')',

    -- Anexos del evaluador de prueba
    'DELETE FROM EVALUADORPRUEBA WHERE EVALUADORID IN
       (SELECT e.EVALUADORID FROM EVALUADOR e JOIN PERSONA p ON p.PERSONAID = e.PERSONAID
         WHERE p.PERSONAIDENTIFICACION LIKE ''9000%'')',
    'DELETE FROM EVALUADORDOCUMENTO WHERE EVALUADORID IN
       (SELECT e.EVALUADORID FROM EVALUADOR e JOIN PERSONA p ON p.PERSONAID = e.PERSONAID
         WHERE p.PERSONAIDENTIFICACION LIKE ''9000%'')',
    'DELETE FROM EVALUADORESTUDIO WHERE EVALUADORID IN
       (SELECT e.EVALUADORID FROM EVALUADOR e JOIN PERSONA p ON p.PERSONAID = e.PERSONAID
         WHERE p.PERSONAIDENTIFICACION LIKE ''9000%'')',
    'DELETE FROM EVALUADOREXPERIENCIA WHERE EVALUADORID IN
       (SELECT e.EVALUADORID FROM EVALUADOR e JOIN PERSONA p ON p.PERSONAID = e.PERSONAID
         WHERE p.PERSONAIDENTIFICACION LIKE ''9000%'')',
    'DELETE FROM EVALUADORTIC WHERE EVALUADORID IN
       (SELECT e.EVALUADORID FROM EVALUADOR e JOIN PERSONA p ON p.PERSONAID = e.PERSONAID
         WHERE p.PERSONAIDENTIFICACION LIKE ''9000%'')',

    'DELETE FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE ''PRUEBA_%''',

    -- Instrumento de las convocatorias de prueba
    'DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID IN
       (SELECT RETROFORMULARIOID FROM RETROFORMULARIO WHERE CONVOCATORIAID IN
          (SELECT CONVOCATORIAID FROM EVALUADORCONVOCATORIA WHERE NOMBRE LIKE ''PRUEBA_%''))',
    'DELETE FROM RETROFORMULARIO WHERE CONVOCATORIAID IN
       (SELECT CONVOCATORIAID FROM EVALUADORCONVOCATORIA WHERE NOMBRE LIKE ''PRUEBA_%'')',
    'DELETE FROM CONVOCATORIADOCUMENTO WHERE CONVOCATORIAID IN
       (SELECT CONVOCATORIAID FROM EVALUADORCONVOCATORIA WHERE NOMBRE LIKE ''PRUEBA_%'')',
    'DELETE FROM EVALUADORCONVOCATORIA WHERE NOMBRE LIKE ''PRUEBA_%''',

    -- Identidad de prueba
    'DELETE FROM USUARIOPERFIL WHERE USUARIOID IN
       (SELECT USUARIOID FROM USUARIO WHERE USUARIOEMAIL LIKE ''%@prueba-%.local'')',
    'DELETE FROM EVALUADOR WHERE PERSONAID IN
       (SELECT PERSONAID FROM PERSONA WHERE PERSONAIDENTIFICACION LIKE ''9000%'')',
    'DELETE FROM PERSONA WHERE PERSONAIDENTIFICACION LIKE ''9000%''',
    'DELETE FROM USUARIO WHERE USUARIOEMAIL LIKE ''%@prueba-%.local'''
  );
  v_total NUMBER := 0;
BEGIN
  FOR i IN 1 .. v_sqls.COUNT LOOP
    EXECUTE IMMEDIATE v_sqls(i);
    IF SQL%ROWCOUNT > 0 THEN
      v_total := v_total + SQL%ROWCOUNT;
      DBMS_OUTPUT.PUT_LINE(LPAD(SQL%ROWCOUNT, 5) || '  ' ||
        REGEXP_SUBSTR(v_sqls(i), '(DELETE FROM|UPDATE) [A-Z]+', 1, 1));
    END IF;
  END LOOP;
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('── Total de filas eliminadas: ' || v_total);
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

DECLARE
  v_p NUMBER; v_c NUMBER; v_ce NUMBER; v_pa NUMBER; v_u NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_p  FROM PERSONA WHERE PERSONAIDENTIFICACION LIKE '9000%';
  SELECT COUNT(*) INTO v_c  FROM EVALUADORCONVOCATORIA WHERE NOMBRE LIKE 'PRUEBA_%';
  SELECT COUNT(*) INTO v_ce FROM EVALUADORCERTIFICADO WHERE ANIO IN (2027, 2028);
  SELECT COUNT(*) INTO v_pa FROM EVALUADORPARTICIPACION WHERE OBSERVACIONES LIKE 'PRUEBA_%';
  SELECT COUNT(*) INTO v_u  FROM USUARIO WHERE USUARIOEMAIL LIKE '%@prueba-%.local';

  DBMS_OUTPUT.PUT_LINE('── Verificación ───────────────────');
  DBMS_OUTPUT.PUT_LINE('Personas de prueba   : ' || v_p);
  DBMS_OUTPUT.PUT_LINE('Convocatorias        : ' || v_c);
  DBMS_OUTPUT.PUT_LINE('Certificados 2027/28 : ' || v_ce);
  DBMS_OUTPUT.PUT_LINE('Participaciones      : ' || v_pa);
  DBMS_OUTPUT.PUT_LINE('Usuarios             : ' || v_u);
  DBMS_OUTPUT.PUT_LINE('(todos deben ser 0)');

  IF v_p + v_c + v_ce + v_pa + v_u > 0 THEN
    RAISE_APPLICATION_ERROR(-20030, 'Quedaron datos de prueba sin purgar.');
  END IF;
END;
/

-- Las filas de EVALUADORLOG NO se borran: el log es inmutable por diseño y
-- registra que estas operaciones ocurrieron. Borrarlas sería exactamente lo
-- que esa tabla existe para impedir.
