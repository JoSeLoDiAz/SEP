-- v16_proyecto_aprobado.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Aprobación oficial del proyecto por parte del SENA.
--
-- Cuando un administrador SENA aprueba un proyecto:
--   1) El sistema toma la versión marcada como FINAL en PROYECTOVERSION.
--   2) RESTAURA todas las tablas vivas del proyecto (ACCIONFORMACION,
--      AFRUBRO, AFGRUPO, AFGRUPOCOBERTURA, UNIDADTEMATICA, PERFILUT,
--      ACTIVIDADUT, AFAREAFUNCIONAL, AFNIVELOCUPACIONAL, OCUPACIONCOUCAF,
--      AFPSECTOR, AFPSUBSECTOR, AFSECTOR, AFSUBSECTOR, AFGESTIONCONOCIMIENTO,
--      MATERIALFORMACIONAF, RECURSOSDIDACTICOSAF, CONTACTOEMPRESA) desde el
--      snapshot JSON guardado.
--   3) Inserta un registro en esta tabla PROYECTOAPROBADO con el hash al
--      momento de la aprobación, para tener trazabilidad de qué versión
--      exacta fue aprobada (incluso si después se manipulan otros datos).
--   4) Marca el proyecto en estado 3 (Aprobado).
--
-- Las modificaciones posteriores (agregar grupos, ajustar coberturas, UTs)
-- las hace el administrador en estado 3 y se reflejan en las tablas vivas
-- en tiempo real. Las versiones históricas en PROYECTOVERSION quedan
-- inmutables como respaldo.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE PROYECTOAPROBADO (
  PROYECTOID            NUMBER          NOT NULL,
  PROYECTOVERSIONID     NUMBER          NOT NULL,
  VERSIONCODIGO         VARCHAR2(60)    NOT NULL,
  VERSIONHASH           VARCHAR2(64)    NOT NULL,
  FECHAAPROBACION       TIMESTAMP       DEFAULT SYSDATE NOT NULL,
  USUARIOAPROBO         VARCHAR2(200),
  COMENTARIOAPROBACION  VARCHAR2(2000),
  CONSTRAINT PK_PROYECTOAPROBADO PRIMARY KEY (PROYECTOID),
  CONSTRAINT FK_PROYECTOAPROBADO_PROY
    FOREIGN KEY (PROYECTOID)        REFERENCES PROYECTO(PROYECTOID),
  CONSTRAINT FK_PROYECTOAPROBADO_VER
    FOREIGN KEY (PROYECTOVERSIONID) REFERENCES PROYECTOVERSION(PROYECTOVERSIONID)
);

CREATE INDEX IX_PROYECTOAPROBADO_FECHA ON PROYECTOAPROBADO (FECHAAPROBACION DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- GRANTS y SINÓNIMOS — replicar el patrón de las demás tablas de SEPLOCAL
--
-- PROYECTOAPROBADO está en SEPLOCAL. Los usuarios SEP_APP (CRUD) y
-- SEP_LECTOR (solo lectura) la acceden vía sinónimos privados.
-- ──────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON PROYECTOAPROBADO TO SEP_APP;
GRANT SELECT                         ON PROYECTOAPROBADO TO SEP_LECTOR;

CREATE OR REPLACE SYNONYM SEP_APP.PROYECTOAPROBADO    FOR SEPLOCAL.PROYECTOAPROBADO;
CREATE OR REPLACE SYNONYM SEP_LECTOR.PROYECTOAPROBADO FOR SEPLOCAL.PROYECTOAPROBADO;

COMMIT;
