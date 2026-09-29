-- v58 — menú del perfil 9 (evaluador): agrega "Mi expediente". Idempotente; reversa al final.

SET SERVEROUTPUT ON

DECLARE
  TYPE t_item IS RECORD (
    perfil  NUMBER,
    descr   NVARCHAR2(100),
    posi    NUMBER,
    url     NVARCHAR2(200),
    icono   NVARCHAR2(50),
    tipo    NVARCHAR2(20)
  );
  TYPE t_items IS TABLE OF t_item;

  v_items t_items := t_items(
    t_item(9, N'Mi expediente',        1, N'/panel/mi-expediente',
              N'fa-id-card',      N'EVALUADOR'),
    t_item(9, N'Mi retroalimentación', 2, N'/panel/retroalimentacion',
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
  DBMS_OUTPUT.PUT_LINE('v58: ' || v_nuevos || ' nuevos, ' || v_iguales || ' actualizados');
END;
/

-- Comprobación
SET LINESIZE 200
COLUMN MENUXDESC FORMAT A28
COLUMN MENXURL   FORMAT A42
SELECT MENUXID, TRIM(MENUXDESC) AS MENUXDESC, MENUXPOSI,
       TRIM(MENXURL) AS MENXURL, MENXEST
  FROM MENU
 WHERE PERFILID = 9
 ORDER BY MENUXPOSI;

-- REVERSA
-- DELETE FROM MENU WHERE PERFILID = 9 AND TRIM(MENXURL) = '/panel/mi-expediente';
-- UPDATE MENU SET MENUXPOSI = 1
--  WHERE PERFILID = 9 AND TRIM(MENXURL) = '/panel/retroalimentacion';
-- COMMIT;
