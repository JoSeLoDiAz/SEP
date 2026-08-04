-- v42_proyecto_manual_por_proponente.sql
-- ──────────────────────────────────────────────────────────────────────────
-- El proponente por sí solo debe bastar para registrar un proyecto evaluado.
--
-- El caso: no todo proyecto evaluado está cargado en el SEP. La Cámara de
-- Comercio de Cartagena, por ejemplo, no existe en la tabla de empresas, y los
-- proyectos anteriores al módulo nunca se importaron. Esas evaluaciones sí
-- ocurrieron y hay que poder dejarlas registradas.
--
-- La restricción CK_PARTPROY_REF exige PROYECTOID, GUARDADOID o
-- NOMBREPROYECTO. Se escribió antes de que existiera el registro a mano y no
-- contempla la razón social, que es justamente como se identifica un proyecto
-- en este módulo: PROYECTONOMBRE viene vacío en la práctica y la pantalla
-- muestra siempre el proponente.
--
-- Qué hace: agrega RAZONSOCIAL a las alternativas. Solo AMPLÍA lo que se
-- acepta; ninguna fila existente deja de ser válida.
--
-- Si esta migración se corre tarde no se rompe nada: hasta entonces, el
-- backend responde pidiendo que se escriba también el nombre o código del
-- proyecto, y con eso se puede guardar igual.
--
-- Idempotente. Ejecutar como SEPLOCAL en SQL Developer (lleva DDL).
-- ──────────────────────────────────────────────────────────────────────────

SET SERVEROUTPUT ON;

DECLARE
  v_existe NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_existe FROM USER_CONSTRAINTS
   WHERE TABLE_NAME = 'EVALUADORPARTPROYECTO' AND CONSTRAINT_NAME = 'CK_PARTPROY_REF';

  IF v_existe > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE EVALUADORPARTPROYECTO DROP CONSTRAINT CK_PARTPROY_REF';
    DBMS_OUTPUT.PUT_LINE('Restriccion anterior eliminada.');
  END IF;

  EXECUTE IMMEDIATE
    'ALTER TABLE EVALUADORPARTPROYECTO ADD CONSTRAINT CK_PARTPROY_REF CHECK (' ||
    'PROYECTOID IS NOT NULL OR GUARDADOID IS NOT NULL OR ' ||
    'NOMBREPROYECTO IS NOT NULL OR RAZONSOCIAL IS NOT NULL)';
  DBMS_OUTPUT.PUT_LINE('Restriccion recreada, ahora acepta tambien RAZONSOCIAL.');
END;
/


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ Verificación                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- Se comprueba el HECHO —que una fila con solo el proponente entra— y no que
-- el bloque de arriba no haya lanzado excepción. La fila de prueba se borra.

DECLARE
  v_id   NUMBER;
  v_part NUMBER;
  v_cond VARCHAR2(4000);
BEGIN
  SELECT SEARCH_CONDITION_VC INTO v_cond FROM USER_CONSTRAINTS
   WHERE TABLE_NAME = 'EVALUADORPARTPROYECTO' AND CONSTRAINT_NAME = 'CK_PARTPROY_REF';
  DBMS_OUTPUT.PUT_LINE('Condicion actual: ' || v_cond);

  IF UPPER(v_cond) NOT LIKE '%RAZONSOCIAL%' THEN
    RAISE_APPLICATION_ERROR(-20042, 'La restriccion no quedo con RAZONSOCIAL.');
  END IF;

  -- Prueba real contra una participación cualquiera, y se deshace.
  SELECT MIN(PARTICIPACIONID) INTO v_part FROM EVALUADORPARTICIPACION;
  IF v_part IS NULL THEN
    DBMS_OUTPUT.PUT_LINE('(no hay participaciones para probar la insercion)');
  ELSE
    SELECT EVALUADORPARTPROYECTO_SEQ.NEXTVAL INTO v_id FROM dual;
    INSERT INTO EVALUADORPARTPROYECTO
      (PARTPROYECTOID, PARTICIPACIONID, RAZONSOCIAL, USUARIOCREACION)
    VALUES (v_id, v_part, 'PRUEBA DE LA MIGRACION V42', 'v42');
    DBMS_OUTPUT.PUT_LINE('Insercion con solo el proponente: OK');
    ROLLBACK;
    DBMS_OUTPUT.PUT_LINE('Fila de prueba deshecha.');
  END IF;

  DBMS_OUTPUT.PUT_LINE('-- Listo: se puede registrar un proyecto con solo el proponente.');
END;
/
