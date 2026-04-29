-- v14_proyecto_versiones.sql
-- ──────────────────────────────────────────────────────────────────────────
-- Sistema de control de versiones del proyecto.
--
-- Cada vez que el proponente confirma el proyecto (PROYECTOESTADO 0/2 → 1)
-- se crea un registro en PROYECTOVERSION con un snapshot JSON completo del
-- proyecto en ese instante (datos de empresa, contactos, AFs con todo su
-- detalle, presupuesto, GO, transferencia, etc.). El snapshot es inmutable
-- y queda referenciado por un código único legible que se imprime en el
-- reporte y sirve para verificar contra SECOP.
--
-- Si después el proyecto se desconfirma (1 → 2), se edita y se vuelve a
-- confirmar, se crea otra versión (V2, V3, ...). Las versiones anteriores
-- nunca se borran y conservan su snapshot original.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE PROYECTOVERSION (
  PROYECTOVERSIONID    NUMBER          NOT NULL,
  PROYECTOID           NUMBER          NOT NULL,
  VERSIONNUMERO        NUMBER          NOT NULL,
  VERSIONCODIGO        VARCHAR2(60)    NOT NULL,
  VERSIONFECHA         TIMESTAMP       DEFAULT SYSDATE NOT NULL,
  VERSIONUSUARIO       VARCHAR2(200),
  VERSIONSNAPSHOT      CLOB            NOT NULL,
  VERSIONHASH          VARCHAR2(64),
  VERSIONESTADOAL      NUMBER          DEFAULT 1,
  VERSIONCOMENTARIO    VARCHAR2(2000),
  CONSTRAINT PK_PROYECTOVERSION PRIMARY KEY (PROYECTOVERSIONID),
  CONSTRAINT FK_PROYECTOVERSION_PROYECTO
    FOREIGN KEY (PROYECTOID) REFERENCES PROYECTO(PROYECTOID),
  CONSTRAINT UQ_PROYECTOVERSION_NUM
    UNIQUE (PROYECTOID, VERSIONNUMERO),
  CONSTRAINT UQ_PROYECTOVERSION_COD
    UNIQUE (VERSIONCODIGO)
);

CREATE INDEX IX_PROYECTOVERSION_PROY     ON PROYECTOVERSION (PROYECTOID);
CREATE INDEX IX_PROYECTOVERSION_FECHA    ON PROYECTOVERSION (VERSIONFECHA DESC);

CREATE SEQUENCE PROYECTOVERSION_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

COMMIT;
