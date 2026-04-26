-- ══════════════════════════════════════════════════════════════════
--   v9 — Crear usuario SEP_LECTOR (solo lectura) para los devs
--   Ejecutar como SEPLOCAL en la BD del servidor centralizado.
-- ══════════════════════════════════════════════════════════════════

-- 1. Borrar si ya existe (idempotente)
BEGIN
  EXECUTE IMMEDIATE 'DROP USER SEP_LECTOR CASCADE';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 2. Crear usuario con la contraseña inicial
CREATE USER SEP_LECTOR IDENTIFIED BY "S3p2026__"
  DEFAULT TABLESPACE USERS
  TEMPORARY TABLESPACE TEMP
  QUOTA 0 ON USERS;

-- 3. Permitir login (sin más privilegios de sistema)
GRANT CREATE SESSION TO SEP_LECTOR;
GRANT SELECT_CATALOG_ROLE TO SEP_LECTOR;

-- 4. SELECT en TODAS las tablas del schema SEPLOCAL
BEGIN
  FOR t IN (SELECT table_name FROM user_tables) LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON ' || t.table_name || ' TO SEP_LECTOR';
  END LOOP;
END;
/

-- 5. SELECT en TODAS las vistas del schema SEPLOCAL
BEGIN
  FOR v IN (SELECT view_name FROM user_views) LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON ' || v.view_name || ' TO SEP_LECTOR';
  END LOOP;
END;
/

-- 6. Sinónimos privados — para que escriban USUARIO en vez de SEPLOCAL.USUARIO
BEGIN
  FOR t IN (SELECT table_name FROM user_tables) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'CREATE SYNONYM SEP_LECTOR.' || t.table_name || ' FOR SEPLOCAL.' || t.table_name;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/

-- 7. Verificación: lista lo que SEP_LECTOR puede ver
PROMPT === Privilegios concedidos a SEP_LECTOR ===
SELECT privilege, table_name FROM dba_tab_privs
 WHERE grantee = 'SEP_LECTOR' AND ROWNUM <= 10;

PROMPT
PROMPT === Resultado esperado ===
PROMPT   - SEP_LECTOR puede SELECT en todo
PROMPT   - SEP_LECTOR NO puede INSERT/UPDATE/DELETE/CREATE/ALTER/DROP
PROMPT   - Si intenta DELETE: ORA-01031 insufficient privileges
PROMPT
PROMPT === Próximo paso ===
PROMPT   Cambiar la contraseña en producción:
PROMPT   ALTER USER SEP_LECTOR IDENTIFIED BY "<nueva_clave>";
