-- reiniciar_banco_evaluadores.sql
-- ──────────────────────────────────────────────────────────────────────────
-- DEJA EL MÓDULO DE EVALUADORES EN CERO. No es una migración: es un borrado
-- completo para volver a empezar una prueba desde la primera pantalla.
--
--   ⚠  ESTO SE CORRE EN LA BASE LOCAL DE DESARROLLO.
--      En producción borraría certificados que ya circularon. No lo corra allá.
--
-- ¿Por qué como SEPLOCAL y no desde la aplicación?
--   SEP_APP tiene sobre EVALUADORCERTIFICADO y EVALUADORLOG solo SELECT,
--   INSERT y UPDATE (v37) — a propósito: ni un certificado emitido ni una
--   línea de auditoría pueden desaparecer desde la aplicación. Como el
--   certificado tiene FK contra la participación, esa sola falta de permiso
--   arrastra al ciclo, al evaluador y a la convocatoria. Es el diseño
--   funcionando; la contrapartida es que reiniciar exige al dueño del esquema.
--
-- Qué borra:
--   · TODO el banco: evaluadores, hojas de vida, estudios, experiencia, TIC
--   · TODOS los ciclos: participaciones, documentos, pruebas, cursos,
--     aprobaciones, grupos, proyectos evaluados y certificados
--   · TODAS las convocatorias del banco con sus documentos
--   · TODA la retroalimentación: formularios, preguntas, asignaciones,
--     respuestas, sesiones y sugerencias
--   · Las cuentas de acceso cuyo ÚNICO perfil es el 9 (evaluador)
--
-- Qué NO borra, y por qué:
--   · PERSONA — se comprobó contra el diccionario que esas mismas personas
--     están referenciadas por AFGRUPOBENEFICIARIO, POSTULACION y UTHORAS.
--     Borrarlas rompería datos de otros módulos. Al volver a registrar, el
--     sistema las encuentra por documento y reutiliza la ficha: es el camino
--     normal y queda igual de limpio.
--   · Las cuentas multirol — si un usuario tiene el perfil 9 y además otro
--     (por ejemplo el 8), se le quita solo el de evaluador. Quitarle la cuenta
--     entera lo dejaría sin el acceso que usa para lo demás.
--   · Los catálogos (roles, procesos, tipos de documento, firmas): son
--     configuración, no datos de prueba.
--
-- Idempotente: correrlo dos veces no falla ni borra de más.
-- Ejecutar como SEPLOCAL en SQL Developer.
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

DECLARE
  TYPE t_txt IS TABLE OF VARCHAR2(4000);

  -- El orden es el de las claves foráneas: hijos antes que padres. Como se
  -- borra todo, no hacen falta subconsultas — y sin ellas no hay forma de
  -- que un filtro mal escrito deje basura a medias.
  v_sqls t_txt := t_txt(
    -- ── Retroalimentación ───────────────────────────────────────────────
    -- La asignación apunta a la respuesta: se suelta el vínculo antes de
    -- borrar la respuesta, o la FK lo impide.
    'UPDATE RETROASIGNACION SET RETRORESPUESTAID = NULL',
    'DELETE FROM RETRORESPUESTAITEM',
    'DELETE FROM RETRORESPUESTA',
    'DELETE FROM RETROASIGNACION',
    'DELETE FROM RETROSUGERENCIA',
    'DELETE FROM RETROSESION',
    'DELETE FROM RETROPREGUNTA',
    'DELETE FROM RETROFORMULARIO',

    -- ── Lo que cuelga del ciclo ─────────────────────────────────────────
    'DELETE FROM EVALUADORCERTIFICADO',
    'DELETE FROM EVALUADORPARTPROYECTO',
    'DELETE FROM EVALUADORPARTGRUPO',
    'DELETE FROM EVALUADORPARTALCANCE',
    'DELETE FROM EVALUADORCAPACITACION',
    'DELETE FROM EVALUADORAPROBACION',

    -- Estas dos apuntan al evaluador Y a la participación: van antes que
    -- ambos, no basta con ponerlas antes de uno.
    'DELETE FROM EVALUADORPRUEBA',
    'DELETE FROM EVALUADORDOCUMENTO',

    'DELETE FROM EVALUADORPARTICIPACION',

    -- ── Convocatorias del banco ─────────────────────────────────────────
    'DELETE FROM CONVOCATORIADOCUMENTO',
    'DELETE FROM EVALUADORCONVOCATORIA',

    -- ── Hoja de vida y evaluador ────────────────────────────────────────
    'DELETE FROM EVALUADORESTUDIO',
    'DELETE FROM EVALUADOREXPERIENCIA',
    'DELETE FROM EVALUADORTIC',
    'DELETE FROM EVALUADOR',

    -- ── Auditoría ───────────────────────────────────────────────────────
    -- Se borra SOLO porque esto es un reinicio de la base local. En
    -- producción esta línea no debe correrse nunca: la tabla existe
    -- justamente para que nadie pueda hacer desaparecer lo que pasó.
    'DELETE FROM EVALUADORLOG',

    -- ── Cuentas de acceso ───────────────────────────────────────────────
    -- Primero se le quita el perfil de evaluador a todo el que lo tenga.
    'DELETE FROM USUARIOPERFIL WHERE PERFILID = 9',
    -- Y solo se borra la cuenta si ya no le queda ningún otro perfil: así
    -- un multirol conserva su acceso.
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


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se comprueba el HECHO —que las tablas quedaron vacías—, no que el bloque
-- de arriba no haya lanzado excepción. Si algo quedó, esto falla y se ve.

DECLARE
  TYPE t_txt IS TABLE OF VARCHAR2(30);
  v_tablas t_txt := t_txt(
    'EVALUADOR', 'EVALUADORAPROBACION', 'EVALUADORCAPACITACION',
    'EVALUADORCERTIFICADO', 'EVALUADORCONVOCATORIA', 'EVALUADORDOCUMENTO',
    'EVALUADORESTUDIO', 'EVALUADOREXPERIENCIA', 'EVALUADORLOG',
    'EVALUADORPARTALCANCE', 'EVALUADORPARTGRUPO', 'EVALUADORPARTICIPACION',
    'EVALUADORPARTPROYECTO', 'EVALUADORPRUEBA', 'EVALUADORTIC',
    'CONVOCATORIADOCUMENTO',
    'RETROASIGNACION', 'RETROFORMULARIO', 'RETROPREGUNTA', 'RETRORESPUESTA',
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
