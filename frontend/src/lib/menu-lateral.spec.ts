// el frontend no tiene jest: se corre con node --test sobre la salida de tsc (ver el resumen del cambio)
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { armarMenu, rutaDe, type MenuItem } from './menu-lateral'

// como en el Exadata: el gestor es el 103
const BANCO = { evaluador: 9, gestorEvaluadores: 103 }
const fila = (desc: string, url: string, icono = 'icon-home'): MenuItem => ({ desc, url, icono })

// las filas activas del perfil 7 (empresa) en cada base, en el orden de MENUXPOSI
const EMPRESA_EXADATA = [
  fila('Inicio', 'InicioEmpresa.aspx', 'nav-icon fas fa-home'),
  fila('Mis Datos', 'DatosBasicosEmpresa.aspx', 'nav-icon fas fa-address-card'),
  fila('Mis Necesidades', 'Necesidades.aspx', 'nav-icon fas fa-list'),
  fila('Mis Proyectos', 'Proyectos.aspx', 'nav-icon fas fa-folder'),
  fila('Mis Convenios', 'wpconvenios.aspx', 'nav-icon fas fa-book'),
]
const EMPRESA_XE = [
  fila('Inicio', 'InicioEmpresa.aspx', 'nav-icon fas fa-home'),
  fila('Datos', 'DatosBasicosEmpresa.aspx', 'nav-icon fas fa-address-card'),
  fila('Contactos', 'ContactosEmpresa.aspx', 'nav-icon fas fa-address-book'),
  fila('Analisis', 'AnalisisEmpresarial.aspx', 'nav-icon fas fa-chart-bar'),
  fila('Mis Necesidades', 'Necesidades.aspx', 'nav-icon fas fa-list'),
  fila('Mis Proyectos', 'Proyectos.aspx', 'nav-icon fas fa-folder'),
]

const rutas = (menu: MenuItem[]) => menu.map(m => [m.desc, rutaDe(m.url)])

describe('rutaDe', () => {
  it('compara exacto, mayúsculas incluidas', () => {
    assert.equal(rutaDe('WPConvenios.aspx'), '/panel/convenios')
    assert.equal(rutaDe(' InicioEmpresa.aspx '), '/panel')
    // la fila 'Gestión de Proyectos' del perfil 1 sigue sin pantalla, igual en las dos bases
    assert.equal(rutaDe('inicioempresa.aspx'), null)
    assert.equal(rutaDe('WPTRATAMIENTODATOS.ASPX'), null)
  })

  it('la fila "Mis Convenios" del Exadata, en minúsculas, tiene su propia entrada', () => {
    assert.equal(rutaDe('wpconvenios.aspx'), '/panel/convenios')
  })

  it('las rutas next pasan tal cual y lo que no está en el mapa queda sin ruta', () => {
    assert.equal(rutaDe('/panel/mi-expediente'), '/panel/mi-expediente')
    assert.equal(rutaDe('WPConveniosInterventoria.aspx'), null)
    assert.equal(rutaDe(''), null)
    assert.equal(rutaDe(null as unknown as string), null)
  })
})

describe('armarMenu', () => {
  it('empresa en el Exadata: las mismas opciones que en el XE, sin convenios repetido', () => {
    assert.deepEqual(rutas(armarMenu(EMPRESA_EXADATA, 7, null)), [
      ['Inicio', '/panel'],
      ['Mis Datos', '/panel/datos'],
      ['Contactos', '/panel/contactos'],
      ['Analisis', '/panel/analisis'],
      ['Necesidades', '/panel/necesidades'],
      ['Proyectos', '/panel/proyectos'],
      ['Convenios', '/panel/convenios'],
    ])
  })

  it('empresa en el XE: nada se repite y convenios se inyecta al final', () => {
    assert.deepEqual(rutas(armarMenu(EMPRESA_XE, 7, null)), [
      ['Inicio', '/panel'],
      ['Datos', '/panel/datos'],
      ['Contactos', '/panel/contactos'],
      ['Analisis', '/panel/analisis'],
      ['Necesidades', '/panel/necesidades'],
      ['Proyectos', '/panel/proyectos'],
      ['Convenios', '/panel/convenios'],
    ])
  })

  it('a la empresa le da igual tener las claves o no', () => {
    assert.deepEqual(armarMenu(EMPRESA_EXADATA, 7, BANCO), armarMenu(EMPRESA_EXADATA, 7, null))
  })

  it('empresa con Contactos pero sin Análisis: Análisis va detrás de Contactos', () => {
    const menu = armarMenu([
      fila('Inicio', 'InicioEmpresa.aspx'),
      fila('Datos', 'DatosBasicosEmpresa.aspx'),
      fila('Contactos', 'ContactosEmpresa.aspx'),
      fila('Mis Necesidades', 'Necesidades.aspx'),
    ], 7, null)
    assert.deepEqual(menu.map(m => m.desc), ['Inicio', 'Datos', 'Contactos', 'Analisis', 'Necesidades', 'Convenios'])
  })

  it('empresa sin la fila de datos básicos: Contactos y Análisis van al final, antes de convenios', () => {
    const menu = armarMenu([fila('Inicio', 'InicioEmpresa.aspx')], 7, null)
    assert.deepEqual(menu.map(m => m.desc), ['Inicio', 'Contactos', 'Analisis', 'Convenios'])
  })

  it('perfil 13: su fila "Convenios" no lleva a ninguna pantalla y la inyectada va al final, como antes', () => {
    const menu = armarMenu([
      fila('Convenios', 'WPConveniosInterventoria.aspx'),
      fila('Datos Básicos', 'DatosBasicosUsuario.aspx'),
    ], 13, BANCO)
    assert.deepEqual(rutas(menu), [
      ['Convenios', null],
      ['Datos Básicos', null],
      ['Convenios', '/panel/convenios'],
    ])
  })

  it('un perfil interno no recibe Contactos ni Análisis: solo convenios al final', () => {
    const menu = armarMenu([fila('Convenio', 'wpconveniosinterventoria.aspx')], 11, BANCO)
    assert.deepEqual(rutas(menu), [
      ['Convenio', null],
      ['Convenios', '/panel/convenios'],
    ])
  })

  it('gestor sin filas en MENU: el respaldo de v39', () => {
    const menu = armarMenu([], 103, BANCO)
    assert.deepEqual(menu, [
      { desc: 'Banco de Evaluadores', url: '/panel/evaluadores', icono: 'fa-shield-check' },
      { desc: 'Convocatorias', url: '/panel/evaluadores/convocatorias', icono: 'fa-bullhorn' },
      { desc: 'Catálogos', url: '/panel/evaluadores/catalogos', icono: 'fa-sliders' },
    ])
  })

  it('evaluador sin filas en MENU: el respaldo de v58', () => {
    const menu = armarMenu([], 9, BANCO)
    assert.deepEqual(menu, [
      { desc: 'Mi expediente', url: '/panel/mi-expediente', icono: 'fa-id-card' },
      { desc: 'Mi retroalimentación', url: '/panel/retroalimentacion', icono: 'fa-sitemap' },
    ])
  })

  it('perfiles del banco con filas en MENU: se usan tal cual y sin convenios', () => {
    const filas = [fila('Banco de Evaluadores', '/panel/evaluadores', 'fa-shield-check')]
    assert.deepEqual(armarMenu(filas, 15, { evaluador: 9, gestorEvaluadores: 15 }), filas)
    const delEvaluador = [fila('Mi expediente', '/panel/mi-expediente', 'fa-id-card')]
    assert.deepEqual(armarMenu(delEvaluador, 9, BANCO), delEvaluador)
  })

  it('el 15 no es del banco si la base dice que el gestor es el 103', () => {
    assert.deepEqual(armarMenu([], 15, BANCO).map(m => m.desc), ['Convenios'])
  })

  it('el respaldo sale en copias: cambiar un menú no cambia el siguiente', () => {
    const a = armarMenu([], 103, BANCO)
    a[0].desc = 'cambiado'
    assert.equal(armarMenu([], 103, BANCO)[0].desc, 'Banco de Evaluadores')
    const b = armarMenu([], 7, null)
    b[0].desc = 'cambiado'
    assert.equal(armarMenu([], 7, null)[0].desc, 'Contactos')
  })

  it('no cambia las filas que recibe', () => {
    const filas = EMPRESA_EXADATA.map(f => ({ ...f }))
    armarMenu(filas, 7, null)
    assert.deepEqual(filas, EMPRESA_EXADATA)
  })
})
