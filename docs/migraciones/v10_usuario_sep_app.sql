-- ══════════════════════════════════════════════════════════════════
--   v10 — Crear usuario SEP_APP (least privilege para el backend)
--          + logon trigger para bloquear uso interactivo
--          + auditoría de sesiones
--
--   IMPORTANTE: ejecutar conectado como SYSTEM (necesita CREATE USER,
--   ADMINISTER DATABASE TRIGGER y AUDIT SYSTEM).
--
--   Antes de ejecutar:
--     1. Reemplaza <CLAVE_APP> en la línea 22 por una contraseña fuerte
--        (mínimo 16 caracteres, mezclar mayúsculas/números/símbolos)
--     2. NO commitees el script con la contraseña real
--     3. Pásala a los devs por canal seguro (Bitwarden / pendrive)
--
--   Modelo de seguridad después de v10:
--     • SEPLOCAL  → owner del schema (solo Josse, migraciones)
--     • SEP_APP   → backend Node.js (INSERT/UPDATE/DELETE/SELECT, sin DDL)
--     • SEP_LECTOR → SQL Developer de los devs (solo SELECT)
--     • SYSTEM    → DBA (solo Josse, mantenimiento)
-- ══════════════════════════════════════════════════════════════════

-- ─── 1. Crear SEP_APP (idempotente) ───────────────────────────────
BEGIN
  EXECUTE IMMEDIATE 'DROP USER SEP_APP CASCADE';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE USER SEP_APP IDENTIFIED BY "<CLAVE_APP>"
  DEFAULT TABLESPACE USERS
  TEMPORARY TABLESPACE TEMP
  QUOTA UNLIMITED ON USERS;

GRANT CREATE SESSION TO SEP_APP;

-- ─── 2. DML en TODAS las tablas de SEPLOCAL ───────────────────────
BEGIN
  FOR t IN (SELECT table_name FROM dba_tables WHERE owner = 'SEPLOCAL') LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE, DELETE ON SEPLOCAL.'
                      || t.table_name || ' TO SEP_APP';
  END LOOP;
END;
/

-- ─── 3. SELECT en vistas ──────────────────────────────────────────
BEGIN
  FOR v IN (SELECT view_name FROM dba_views WHERE owner = 'SEPLOCAL') LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON SEPLOCAL.' || v.view_name || ' TO SEP_APP';
  END LOOP;
END;
/

-- ─── 4. SELECT en secuencias (necesario para INSERT con NEXTVAL) ──
BEGIN
  FOR s IN (SELECT sequence_name FROM dba_sequences WHERE sequence_owner = 'SEPLOCAL') LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON SEPLOCAL.' || s.sequence_name || ' TO SEP_APP';
  END LOOP;
END;
/

-- ─── 5. EXECUTE en procedimientos / funciones / packages ──────────
BEGIN
  FOR p IN (SELECT object_name, object_type FROM dba_objects
            WHERE owner = 'SEPLOCAL'
              AND object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'GRANT EXECUTE ON SEPLOCAL.' || p.object_name || ' TO SEP_APP';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/

-- ─── 6. Sinónimos privados (el backend escribe `USUARIO`, no `SEPLOCAL.USUARIO`) ──
BEGIN
  FOR o IN (SELECT object_name FROM dba_objects
            WHERE owner = 'SEPLOCAL'
              AND object_type IN ('TABLE', 'VIEW', 'SEQUENCE', 'PROCEDURE', 'FUNCTION', 'PACKAGE')) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'CREATE OR REPLACE SYNONYM SEP_APP.'
                        || o.object_name || ' FOR SEPLOCAL.' || o.object_name;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/

-- ─── 7. Logon trigger — bloquear uso interactivo de SEP_APP ───────
--   Solo permite conexión si el programa cliente es "node" o "nest".
--   No afecta a SYS/SYSTEM ni a otros usuarios.
CREATE OR REPLACE TRIGGER restringir_sep_app
AFTER LOGON ON DATABASE
DECLARE
  v_user    VARCHAR2(30)  := SYS_CONTEXT('USERENV', 'SESSION_USER');
  v_program VARCHAR2(128) := LOWER(NVL(SYS_CONTEXT('USERENV', 'PROGRAM'), ''));
BEGIN
  IF v_user = 'SEP_APP'
     AND v_program NOT LIKE '%node%'
     AND v_program NOT LIKE '%nest%'
  THEN
    RAISE_APPLICATION_ERROR(
      -20001,
      'SEP_APP solo se conecta desde el backend Node. Para consultas usa SEP_LECTOR.'
    );
  END IF;
END;
/

-- ─── 8. Auditar todas las sesiones de SEP_APP ─────────────────────
AUDIT SESSION BY SEP_APP;

-- ─── 9. Verificación ──────────────────────────────────────────────
PROMPT
PROMPT === Privilegios de SEP_APP (resumen) ===
SELECT privilege, COUNT(*) AS objetos FROM dba_tab_privs
 WHERE grantee = 'SEP_APP'
 GROUP BY privilege ORDER BY privilege;

PROMPT
PROMPT === Sinónimos creados ===
SELECT COUNT(*) AS total_sinonimos FROM dba_synonyms WHERE owner = 'SEP_APP';

PROMPT
PROMPT === Trigger creado ===
SELECT trigger_name, status FROM dba_triggers
 WHERE trigger_name = 'RESTRINGIR_SEP_APP';

PROMPT
PROMPT === Resultado esperado ===
PROMPT   - DELETE/INSERT/SELECT/UPDATE en ~180 tablas
PROMPT   - EXECUTE en procedimientos/funciones
PROMPT   - SEP_APP NO puede DROP/ALTER/CREATE TABLE
PROMPT   - SEP_APP solo conecta desde node/nest (cualquier otro programa: ORA-20001)
PROMPT   - Auditoría activada (consultar dba_audit_session WHERE username='SEP_APP')

PROMPT
PROMPT === Próximos pasos ===
PROMPT   1. Cambiar la contraseña con: ALTER USER SEP_APP IDENTIFIED BY "<nueva>";
PROMPT   2. Actualizar backend/.env de cada dev: ORACLE_USER=SEP_APP
PROMPT   3. Reiniciar el backend
PROMPT   4. Revisar auditoría semanal:
PROMPT      SELECT username, userhost, terminal, os_username, timestamp, returncode
PROMPT        FROM dba_audit_session WHERE username='SEP_APP' ORDER BY timestamp DESC;
