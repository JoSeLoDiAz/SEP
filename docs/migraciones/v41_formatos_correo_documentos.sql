-- v41_formatos_correo_documentos.sql

SET SERVEROUTPUT ON;

BEGIN
  UPDATE TIPODOCUMENTOCONV
     SET EXTENSIONESPERMITIDAS = 'pdf,msg,eml,html,htm,mht,mhtml'
   WHERE TRIM(CODIGO) IN ('INVITACION', 'RATIFICACION');
  DBMS_OUTPUT.PUT_LINE(SQL%ROWCOUNT || '  tipo(s) de documento de convocatoria actualizados');
  COMMIT;
END;
/

-- Verificación

DECLARE
  v_falla NUMBER := 0;
BEGIN
  DBMS_OUTPUT.PUT_LINE('── Tipos de documento de la convocatoria ───');
  FOR c IN (SELECT TRIM(CODIGO) cod, TRIM(NOMBRE) nom,
                   TRIM(EXTENSIONESPERMITIDAS) ext
              FROM TIPODOCUMENTOCONV ORDER BY ORDEN) LOOP
    DBMS_OUTPUT.PUT_LINE(RPAD(c.cod, 32) || '[' || NVL(c.ext, '(nulo)') || ']');

    -- Solo los dos que son correos tienen que aceptar formatos de correo.
    IF c.cod IN ('INVITACION', 'RATIFICACION')
       AND NOT (c.ext LIKE '%msg%' AND c.ext LIKE '%eml%' AND c.ext LIKE '%html%') THEN
      v_falla := v_falla + 1;
    END IF;
  END LOOP;

  IF v_falla > 0 THEN
    RAISE_APPLICATION_ERROR(-20041,
      v_falla || ' tipo(s) de correo quedaron sin los formatos. Revise la salida.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('── Listo: la invitacion y la ratificacion aceptan .msg, .eml y .html.');
  DBMS_OUTPUT.PUT_LINE('   El correo de autorizacion y la evidencia los resuelve el backend.');
END;
/
