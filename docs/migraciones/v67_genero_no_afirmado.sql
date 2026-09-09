-- v67 — quita el género que el sistema afirmó sin que nadie lo dijera.
--
-- El alta de evaluadores insertaba GENEROID = 3 quemado en el INSERT de PERSONA.
-- En el catálogo, 3 no es "sin dato": es NO BINARIO.
--
--   GENERO: 1 MASCULINO · 2 FEMENINO · 3 NO BINARIO
--
-- O sea que a todo el que se registró por esta pantalla el sistema le atribuyó
-- ese género. Son 14 personas reales, dadas de alta entre el 2026-07-06 y el
-- 2026-08-29. Ninguna lo declaró: es un valor por defecto mal escogido.
--
-- El código ya no lo hace (bindea NULL, que la columna admite). Falta decidir
-- qué hacer con las 14 filas que quedaron.
--
-- EJECUTADA el 2026-08-31: 14 filas. Pone GENEROID en NULL para esas 14, es
-- decir deja de afirmar algo que nadie dijo, sin afirmar otra cosa en su lugar.
-- La ficha del evaluador permite elegirlo después, cuando la persona lo indique.
--
-- Después: 29 masculino, 31 femenino, 14 sin dato. Ninguna otra columna de esas
-- personas se tocó, y PERSONA sigue con sus 292.176 filas.
-- Respaldo (fuera del repo): ../respaldos/respaldo-v67-genero.json
--
-- Ojo: PERSONA la comparten los 292.176 registros de todo el SEP. Este UPDATE
-- toca solo a las que son evaluador Y tienen GENEROID = 3 Y fueron registradas
-- por este módulo, para no barrer con datos que otro módulo sí haya capturado
-- de verdad. Hoy en toda la tabla solo 2 filas tienen GENEROID en NULL.
--
-- Antes de correrlo conviene sacar el respaldo (fuera del repo, que es público):
--   SELECT PERSONAID, GENEROID FROM PERSONA WHERE ...

SET SERVEROUTPUT ON;

DECLARE
  v_tocadas NUMBER;
BEGIN
  UPDATE PERSONA p
     SET p.GENEROID = NULL
   WHERE p.GENEROID = 3
     AND EXISTS (SELECT 1 FROM EVALUADOR e WHERE e.PERSONAID = p.PERSONAID);

  v_tocadas := SQL%ROWCOUNT;
  DBMS_OUTPUT.PUT_LINE('Personas a las que se les quito el genero atribuido: ' || v_tocadas);
  DBMS_OUTPUT.PUT_LINE('(se esperaban 14)');

  COMMIT;
END;
/
