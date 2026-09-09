-- Migración: Módulos Contactos y Análisis Empresarial

-- 1. MENU — Insertar ítems de Contactos y Análisis Empresarial

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

-- 2. MENU — Actualizar orden de ítems existentes para hacer espacio

-- Mis Necesidades: orden 5
UPDATE MENU SET MENUXORDEN = 5
WHERE MENUXURL = 'NecesidadesFormacion.aspx' AND MENUXTIPO = 'EMPRESA';

-- Mis Proyectos: orden 6
UPDATE MENU SET MENUXORDEN = 6
WHERE MENUXURL = 'ProyectosEmpresa.aspx' AND MENUXTIPO = 'EMPRESA';

-- 3. PERFILMENU — Asignar los nuevos menús al perfil de empresa

-- 3. EMPRESA — Agregar columnas para Cadena Productiva e Interacciones

ALTER TABLE EMPRESA ADD EMPRESAESLABONES    NCLOB;
ALTER TABLE EMPRESA ADD EMPRESAINTERACCIONES NCLOB;
