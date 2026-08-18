-- reiniciar_banco_evaluadores.sql
--   INSERT y UPDATE (v37) — a propósito: ni un certificado emitido ni una
--   línea de auditoría pueden desaparecer desde la aplicación. Como el

SET SERVEROUTPUT ON;

DECLARE
  TYPE t_txt IS TABLE OF VARCHAR2(4000);

  -- El orden es el de las claves foráneas: hijos antes que padres. Como se
  v_sqls t_txt := t_txt(
    -- Retroalimentación
    'UPDATE RETROASIGNACION SET RETRORESPUESTAID = NULL',
    'DELETE FROM RETRORESPUESTAITEM',
    'DELETE FROM RETRORESPUESTA',
    'DELETE FROM RETROASIGNACION',
    'DELETE FROM RETROSUGERENCIA',
    'DELETE FROM RETROSESION',
    -- La plantilla base (la que no tiene convocatoria) NO se toca: es
    'DELETE FROM RETROPREGUNTA WHERE RETROFORMULARIOID IN
       (SELECT RETROFORMULARIOID FROM RETROFORMULARIO WHERE CONVOCATORIAID IS NOT NULL)',
    'DELETE FROM RETROFORMULARIO WHERE CONVOCATORIAID IS NOT NULL',

    -- Lo que cuelga del ciclo
    'DELETE FROM EVALUADORCERTIFICADO',
    'DELETE FROM EVALUADORPARTPROYECTO',
    'DELETE FROM EVALUADORPARTGRUPO',
    'DELETE FROM EVALUADORPARTALCANCE',
    'DELETE FROM EVALUADORCAPACITACION',
    'DELETE FROM EVALUADORAPROBACION',

    -- Estas dos apuntan al evaluador Y a la participación: van antes que
    'DELETE FROM EVALUADORPRUEBA',
    'DELETE FROM EVALUADORDOCUMENTO',

    'DELETE FROM EVALUADORPARTICIPACION',

    -- Convocatorias del banco
    'DELETE FROM CONVOCATORIADOCUMENTO',
    'DELETE FROM EVALUADORCONVOCATORIA',

    -- Hoja de vida y evaluador
    'DELETE FROM EVALUADORESTUDIO',
    'DELETE FROM EVALUADOREXPERIENCIA',
    'DELETE FROM EVALUADORTIC',
    'DELETE FROM EVALUADOR',

    -- Auditoría
    'DELETE FROM EVALUADORLOG',

    -- Cuentas de acceso
    'DELETE FROM USUARIOPERFIL WHERE PERFILID = 9',
    -- Y solo se borra la cuenta si ya no le queda ningún otro perfil: así
    'DELETE FROM USUARIO u
      WHERE u.PERFILID = 9
        AND NOT EXISTS (SELECT 1 FROM USUARIOPERFIL up WHERE up.USUARIOID = u.USUARIOID)'
  );
  v_total NUMBER := 0;
BEGIN
  FOR i IN 1 .. v_sqls.COUNT LOOP
    EXECUTE IMMEDIATE v_sqls(i);
    IF SQL%ROWCOUNT > 0 THEN
      v_total := v_total + SQL%ROWCOUNT;
      DBMS_OUTPUT.PUT_LINE(LPAD(SQL%ROWCOUNT, 6) || '  ' ||
        REGEXP_SUBSTR(v_sqls(i), '(DELETE FROM|UPDATE) [A-Z]+', 1, 1));
    END IF;
  END LOOP;
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('── Total de filas eliminadas: ' || v_total);
END;
/

-- Verificación

DECLARE
  TYPE t_txt IS TABLE OF VARCHAR2(30);
  v_tablas t_txt := t_txt(
    'EVALUADOR', 'EVALUADORAPROBACION', 'EVALUADORCAPACITACION',
    'EVALUADORCERTIFICADO', 'EVALUADORCONVOCATORIA', 'EVALUADORDOCUMENTO',
    'EVALUADORESTUDIO', 'EVALUADOREXPERIENCIA', 'EVALUADORLOG',
    'EVALUADORPARTALCANCE', 'EVALUADORPARTGRUPO', 'EVALUADORPARTICIPACION',
    'EVALUADORPARTPROYECTO', 'EVALUADORPRUEBA', 'EVALUADORTIC',
    'CONVOCATORIADOCUMENTO',
    -- RETROFORMULARIO y RETROPREGUNTA no van aquí: deben quedar con la
    'RETROASIGNACION', 'RETRORESPUESTA',
    'RETRORESPUESTAITEM', 'RETROSESION', 'RETROSUGERENCIA'
  );
  v_n NUMBER;
  v_sucias NUMBER := 0;
  v_perfil NUMBER;
BEGIN
  DBMS_OUTPUT.PUT_LINE('── Verificación ───────────────────');
  FOR i IN 1 .. v_tablas.COUNT LOOP
    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM ' || v_tablas(i) INTO v_n;
    DBMS_OUTPUT.PUT_LINE(RPAD(v_tablas(i), 26) || LPAD(v_n, 6));
    IF v_n > 0 THEN v_sucias := v_sucias + 1; END IF;
  END LOOP;

  -- De la retroalimentación no debe quedar ninguna copia de convocatoria...
  SELECT COUNT(*) INTO v_n FROM RETROFORMULARIO WHERE CONVOCATORIAID IS NOT NULL;
  DBMS_OUTPUT.PUT_LINE(RPAD('RETROFORMULARIO (del año)', 26) || LPAD(v_n, 6));
  IF v_n > 0 THEN v_sucias := v_sucias + 1; END IF;

  -- ...y la plantilla base sí tiene que seguir ahí, o la matriz no abre.
  SELECT COUNT(*) INTO v_n FROM RETROFORMULARIO WHERE CONVOCATORIAID IS NULL AND ACTIVO = 1;
  DBMS_OUTPUT.PUT_LINE(RPAD('RETROFORMULARIO (plantilla)', 26) || LPAD(v_n, 6));
  IF v_n = 0 THEN
    RAISE_APPLICATION_ERROR(-20041,
      'Se perdio la plantilla base del instrumento. Correr v49_replantilla_retroalimentacion.sql.');
  END IF;

  SELECT COUNT(*) INTO v_perfil FROM USUARIOPERFIL WHERE PERFILID = 9;
  DBMS_OUTPUT.PUT_LINE(RPAD('USUARIOPERFIL (perfil 9)', 26) || LPAD(v_perfil, 6));
  IF v_perfil > 0 THEN v_sucias := v_sucias + 1; END IF;

  IF v_sucias > 0 THEN
    RAISE_APPLICATION_ERROR(-20040,
      'Quedaron ' || v_sucias || ' tabla(s) con filas. El reinicio no terminó.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('── Todo en cero. El banco quedó listo para empezar.');
END;
/
