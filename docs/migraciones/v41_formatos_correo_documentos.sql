-- v41_formatos_correo_documentos.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Los apartados que reciben un CORREO deben aceptar formatos de correo.
--
-- El problema: cada gestor guarda el correo con lo que tiene a mano, y el
-- sistema solo aceptaba un subconjunto distinto en cada sitio.
--
--   Correo de autorización (evaluador)   solo PDF          <- el peor caso
--   Invitación / ratificación (ciclo)    pdf, msg
--   Evidencia de la aprobación           pdf, msg, eml
--
-- El primero se llama literalmente "Correo de autorización" y no dejaba
-- adjuntar un correo: había que imprimirlo a PDF primero.
--
-- Qué toca esta migración:
--   La invitación y la ratificación suman eml, html, htm, mht y mhtml a lo
--   que ya aceptaban. Es lo único que vive en base de datos.
--
-- Lo demás va en el código (backend/src/evaluadores/formatos-correo.ts), a
-- propósito: agregar una columna a TIPODOCUMENTOEVAL es DDL, y el día del
-- despliegue el contenedor puede subir antes de que alguien corra el SQL.
-- Con la columna, ese hueco tumbaría la pestaña de Documentos entera. Así,
-- si esta migración se corre tarde, lo único que pasa es que la invitación
-- todavía no acepta .eml — degradado, no roto.
--
-- Formatos y de dónde salen:
--   .msg          Outlook de escritorio
--   .eml          Outlook web, Gmail, Thunderbird
--   .html / .htm  "Guardar como" del navegador
--   .mht / .mhtml "Guardar como página web (archivo único)" de Outlook
--   .pdf          impreso a PDF, que sigue siendo evidencia válida
--
-- Nota de seguridad: un correo guardado en .html es HTML ejecutable. El
-- backend fuerza esos archivos a DESCARGA y los sirve como binarios con
-- X-Content-Type-Options: nosniff, para que el navegador no los interprete
-- dentro del dominio del SEP. Sin eso, un correo preparado podría leer el
-- token de sesión de quien lo abriera.
--
-- Idempotente. Puede correrse como SEP_APP: no lleva DDL.
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

BEGIN
  UPDATE TIPODOCUMENTOCONV
     SET EXTENSIONESPERMITIDAS = 'pdf,msg,eml,html,htm,mht,mhtml'
   WHERE TRIM(CODIGO) IN ('INVITACION', 'RATIFICACION');
  DBMS_OUTPUT.PUT_LINE(SQL%ROWCOUNT || '  tipo(s) de documento de convocatoria actualizados');
  COMMIT;
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se comprueba el HECHO —que los apartados de correo aceptan .msg, .eml y
-- .html—, no que el UPDATE de arriba no haya lanzado excepción.

DECLARE
  v_falla NUMBER := 0;
BEGIN
  DBMS_OUTPUT.PUT_LINE('── Tipos de documento de la convocatoria ───');
  FOR c IN (SELECT TRIM(CODIGO) cod, TRIM(NOMBRE) nom,
                   TRIM(EXTENSIONESPERMITIDAS) ext
              FROM TIPODOCUMENTOCONV ORDER BY ORDEN) LOOP
    DBMS_OUTPUT.PUT_LINE(RPAD(c.cod, 32) || '[' || NVL(c.ext, '(nulo)') || ']');

    -- Solo los dos que son correos tienen que aceptar formatos de correo.
    -- Los listados de asistencia siguen siendo Excel y eso está bien.
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
