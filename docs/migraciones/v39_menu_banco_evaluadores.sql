-- v39_menu_banco_evaluadores.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Menú lateral para los perfiles del banco de evaluadores.
--
-- El problema: los perfiles 15 (GESTOR EVALUADORES) y 9 (EVALUADORGFCE) no
-- tenían NINGUNA fila en MENU. La barra lateral se arma con
-- `SELECT ... FROM MENU WHERE PERFILID = :perfil`, así que a la gestora le
-- salía solo "Convenios" —que el frontend agrega en duro— y no tenía cómo
-- llegar a convocatorias, catálogos ni retroalimentación. Entraba al banco
-- únicamente porque el panel la redirige allí, y de ahí no podía moverse.
--
-- Las URL nuevas se guardan como RUTA REAL (/panel/...) y no como un .aspx
-- inventado. El frontend ya resuelve directamente cualquier URL que empiece
-- por "/", de modo que agregar una opción al menú en adelante es sembrar una
-- fila: sin tocar código ni desplegar.
--
-- Idempotente: se puede correr varias veces. Ejecutar como SEPLOCAL.
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

DECLARE
  -- MENXPADRE = 0 significa "opción de primer nivel", que es lo único que
  -- consulta el backend hoy.
  TYPE t_item IS RECORD (
    perfil  NUMBER,
    descr   NVARCHAR2(40),
    posi    NUMBER,
    url     NVARCHAR2(100),
    icono   NVARCHAR2(50),
    tipo    NVARCHAR2(20)
  );
  TYPE t_items IS TABLE OF t_item;

  v_items t_items := t_items(
    -- ── Gestor de evaluadores (perfil 15) ────────────────────────────────
    t_item(15, N'Banco de Evaluadores', 1, N'/panel/evaluadores',
               N'fa-shield-check', N'EVALUADORES'),
    t_item(15, N'Convocatorias',        2, N'/panel/evaluadores/convocatorias',
               N'fa-bullhorn',     N'EVALUADORES'),
    t_item(15, N'Catálogos',            3, N'/panel/evaluadores/catalogos',
               N'fa-sliders',      N'EVALUADORES'),

    -- ── Evaluador (perfil 9) ─────────────────────────────────────────────
    -- Solo lo suyo: entra a diligenciar su retroalimentación. El banco es de
    -- la gestora, no de él.
    t_item(9,  N'Mi retroalimentación', 1, N'/panel/retroalimentacion',
               N'fa-sitemap',      N'EVALUADOR')
  );

  v_id      NUMBER;
  v_existe  NUMBER;
  v_nuevos  NUMBER := 0;
  v_iguales NUMBER := 0;
BEGIN
  FOR i IN 1 .. v_items.COUNT LOOP
    SELECT COUNT(*) INTO v_existe
      FROM MENU
     WHERE PERFILID = v_items(i).perfil
       AND TRIM(MENXURL) = TRIM(v_items(i).url);

    IF v_existe > 0 THEN
      -- Ya está: se refresca lo cosmético por si cambió el nombre o el ícono,
      -- pero no se duplica la fila.
      UPDATE MENU
         SET MENUXDESC  = v_items(i).descr,
             MENUXPOSI  = v_items(i).posi,
             MENUXICONO = v_items(i).icono,
             MENXEST    = 'A'
       WHERE PERFILID = v_items(i).perfil
         AND TRIM(MENXURL) = TRIM(v_items(i).url);
      v_iguales := v_iguales + 1;
    ELSE
      SELECT MENUXID.NEXTVAL INTO v_id FROM dual;
      INSERT INTO MENU
        (MENUXID, MENUXDESC, MENUXPOSI, MENXURL, MENXEST,
         MENXPADRE, MENUXICONO, MENUXTIPO, MENUXETAPA, PERFILID)
      VALUES
        (v_id, v_items(i).descr, v_items(i).posi, v_items(i).url, 'A',
         0, v_items(i).icono, v_items(i).tipo, v_items(i).tipo, v_items(i).perfil);
      v_nuevos := v_nuevos + 1;
    END IF;
  END LOOP;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('Opciones de menú creadas    : ' || v_nuevos);
  DBMS_OUTPUT.PUT_LINE('Opciones ya existentes      : ' || v_iguales || ' (actualizadas)');
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

DECLARE
  v_g NUMBER; v_e NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_g FROM MENU WHERE PERFILID = 15 AND MENXEST = 'A' AND MENXPADRE = 0;
  SELECT COUNT(*) INTO v_e FROM MENU WHERE PERFILID = 9  AND MENXEST = 'A' AND MENXPADRE = 0;

  DBMS_OUTPUT.PUT_LINE('── Verificación ───────────────────');
  DBMS_OUTPUT.PUT_LINE('Menú del gestor (perfil 15) : ' || v_g || '  (esperado 3)');
  DBMS_OUTPUT.PUT_LINE('Menú del evaluador (perfil 9): ' || v_e || '  (esperado 1)');

  IF v_g < 3 OR v_e < 1 THEN
    RAISE_APPLICATION_ERROR(-20039,
      'El menú no quedó sembrado. Revise que existan los perfiles 9 y 15 en PERFIL.');
  END IF;
END;
/

SELECT PERFILID, MENUXPOSI, TRIM(MENUXDESC) AS OPCION, TRIM(MENXURL) AS RUTA, TRIM(MENUXICONO) AS ICONO
  FROM MENU
 WHERE PERFILID IN (9, 15)
 ORDER BY PERFILID, MENUXPOSI;
