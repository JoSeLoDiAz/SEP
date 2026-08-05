-- Documentos: se retira "Experiencia laboral profesional" y queda solo
-- "Experiencia laboral en proyectos", que además pedirá el año.
--
-- La profesional ya se registra en Perfil -> Experiencia, con cargo, entidad,
-- fechas y soporte, y es la única que sale en la ficha PDF. Tenerla también
-- como documento suelto era la misma información en dos sitios, y en el sitio
-- que no se imprime.
--
-- Se DESACTIVA, no se borra: los documentos ya cargados con ese tipo siguen
-- viéndose y descargándose con su nombre. Lo que desaparece es la opción de
-- seguir cargando por ahí.
--
-- Idempotente. Corre como SEP_APP.

SET SERVEROUTPUT ON;

DECLARE
  v_docs NUMBER;
  v_n    NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_docs
    FROM EVALUADORDOCUMENTO d
    JOIN TIPODOCUMENTOEVAL t ON t.TIPODOCUMENTOEVALID = d.TIPODOCUMENTOEVALID
   WHERE TRIM(t.CODIGO) = 'EXPERIENCIA_PROFESIONAL';
  DBMS_OUTPUT.PUT_LINE('Documentos ya cargados con ese tipo: ' || v_docs || ' (siguen visibles)');

  UPDATE TIPODOCUMENTOEVAL SET ACTIVO = 0
   WHERE TRIM(CODIGO) = 'EXPERIENCIA_PROFESIONAL' AND ACTIVO = 1;
  DBMS_OUTPUT.PUT_LINE(SQL%ROWCOUNT || '  tipo desactivado');

  COMMIT;

  -- Verificación: que ya no se ofrezca, y que la de proyectos siga activa.
  SELECT COUNT(*) INTO v_n FROM TIPODOCUMENTOEVAL
   WHERE TRIM(CODIGO) = 'EXPERIENCIA_PROFESIONAL' AND ACTIVO = 1;
  IF v_n > 0 THEN
    RAISE_APPLICATION_ERROR(-20048, 'La experiencia profesional sigue activa.');
  END IF;

  SELECT COUNT(*) INTO v_n FROM TIPODOCUMENTOEVAL
   WHERE TRIM(CODIGO) = 'EXPERIENCIA_PROYECTOS' AND ACTIVO = 1;
  IF v_n = 0 THEN
    RAISE_APPLICATION_ERROR(-20048, 'La experiencia en proyectos quedo inactiva.');
  END IF;

  DBMS_OUTPUT.PUT_LINE('-- Tipos que se ofrecen ahora --');
  FOR c IN (SELECT TRIM(NOMBRE) n FROM TIPODOCUMENTOEVAL WHERE ACTIVO = 1 ORDER BY ORDEN) LOOP
    DBMS_OUTPUT.PUT_LINE('  ' || c.n);
  END LOOP;
END;
/
