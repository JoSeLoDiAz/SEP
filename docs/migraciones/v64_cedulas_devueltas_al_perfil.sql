-- v64 — devuelve al perfil las cédulas que quedaron atadas a un año.
--
-- El selector "Cargar documento" del ciclo ofrecía todos los tipos, incluida la
-- cédula. Como CEDULA tiene ADMITEMULTIPLE = 0, subirla desde un año borraba la
-- que ya estaba en el perfil y dejaba la nueva con PARTICIPACIONID y
-- ANIOREFERENCIA: la persona la veía dentro de ese año y no en su card.
-- Alcanzó a pasar dos veces (documentos 42 y 230).
--
-- El archivo no se pierde: solo se sueltan las dos columnas. El código ya no
-- deja repetirlo (el selector no ofrece tipos de perfil y subirDocumento ignora
-- el año cuando el tipo es de instancia única y no pertenece al ciclo).

SET SERVEROUTPUT ON;

DECLARE
  v_tocados NUMBER;
BEGIN
  UPDATE EVALUADORDOCUMENTO d
     SET d.PARTICIPACIONID = NULL,
         d.ANIOREFERENCIA  = NULL
   WHERE (d.PARTICIPACIONID IS NOT NULL OR d.ANIOREFERENCIA IS NOT NULL)
     AND EXISTS (
           SELECT 1 FROM TIPODOCUMENTOEVAL t
            WHERE t.TIPODOCUMENTOEVALID = d.TIPODOCUMENTOEVALID
              AND t.ADMITEMULTIPLE = 0
              AND UPPER(TRIM(t.CODIGO)) NOT IN
                  ('AUTORIZACION', 'CONFIDENCIALIDAD', 'CERTIFICADO_PARTICIPACION'));

  v_tocados := SQL%ROWCOUNT;
  DBMS_OUTPUT.PUT_LINE('Documentos devueltos al perfil: ' || v_tocados);
  COMMIT;
END;
/
