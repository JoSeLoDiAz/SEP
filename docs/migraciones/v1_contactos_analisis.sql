-- =============================================================================
-- Migración: Módulos Contactos y Análisis Empresarial
-- Versión: 1.0
-- Fecha: 2026-04-19
-- Autor: JoSeLoDiAz
-- Descripción: Agrega los menús de Contactos y Análisis Empresarial al sistema,
--              y los campos de cadena productiva e interacciones a la tabla EMPRESA.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MENU — Insertar ítems de Contactos y Análisis Empresarial
--    NOTA: Verificar antes que el MENUXID máximo sea 261.
--          Si ya existen filas con 262 o 263, ajustar los valores.
--    Verificación previa: SELECT MAX(MENUXID) FROM MENU;
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO MENU (
  MENUXID, MENUXNOMBRE, MENUXURL, MENUXICONO,
  MENUXTIPO, MENUXETAPA, MENUXORDEN, MENUXPADRE
) VALUES (
  262,
  'Contactos',
  'ContactosEmpresa.aspx',
  'fa-address-book',
  'EMPRESA',
  'EMPRESA',
  3,
  0
);

INSERT INTO MENU (
  MENUXID, MENUXNOMBRE, MENUXURL, MENUXICONO,
  MENUXTIPO, MENUXETAPA, MENUXORDEN, MENUXPADRE
) VALUES (
  263,
  'Analisis',
  'AnalisisEmpresarial.aspx',
  'fa-chart-bar',
  'EMPRESA',
  'EMPRESA',
  4,
  0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MENU — Actualizar orden de ítems existentes para hacer espacio
--    (Mis Necesidades y Mis Proyectos quedan después de Contactos y Análisis)
-- ─────────────────────────────────────────────────────────────────────────────

-- Mis Necesidades: orden 5
UPDATE MENU SET MENUXORDEN = 5
WHERE MENUXURL = 'NecesidadesFormacion.aspx' AND MENUXTIPO = 'EMPRESA';

-- Mis Proyectos: orden 6
UPDATE MENU SET MENUXORDEN = 6
WHERE MENUXURL = 'ProyectosEmpresa.aspx' AND MENUXTIPO = 'EMPRESA';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PERFILMENU — Asignar los nuevos menús al perfil de empresa
--    Reemplazar :PERFIL_EMPRESA_ID con el ID real del perfil empresa
--    (en desarrollo local es 7 — verificar en producción)
--    Verificación: SELECT PERFILID, PERFILNOMBRE FROM PERFIL;
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. EMPRESA — Agregar columnas para Cadena Productiva e Interacciones
--    Estas columnas no existían originalmente en el modelo GeneXus.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE EMPRESA ADD EMPRESAESLABONES    NCLOB;
ALTER TABLE EMPRESA ADD EMPRESAINTERACCIONES NCLOB;
