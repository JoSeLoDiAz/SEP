// menú lateral: las filas de la tabla MENU convertidas en rutas next

import { isEmpresa } from './auth'

export interface MenuItem { desc: string; url: string; icono: string }

// mapa url genexus → ruta next

const URL_MAP: Record<string, string> = {
  'InicioEmpresa.aspx':        '/panel',
  'InicioUsuario.aspx':        '/panel',
  'DatosBasicosEmpresa.aspx':  '/panel/datos',
  'Necesidades.aspx':          '/panel/necesidades',
  'Proyectos.aspx':            '/panel/proyectos',
  'WPConvenios.aspx':          '/panel/convenios',
  // la fila "Mis Convenios" de la empresa: así, en minúsculas, la trae el Exadata
  'wpconvenios.aspx':          '/panel/convenios',
  'wptratamientodatos.aspx':   '/panel/beneficiarios',
  'ContactosEmpresa.aspx':     '/panel/contactos',
  'AnalisisEmpresarial.aspx':  '/panel/analisis',
  'Empresas.aspx':             '/panel/empresas',
  'Convenios.aspx':            '/panel/convenios',
  'Cronograma.aspx':           '/panel/cronograma',
  'Certificados.aspx':         '/panel/certificacion',
  'Desembolsos.aspx':          '/panel/desembolsos',
  'Evaluaciones.aspx':         '/panel/evaluaciones',
}

// el mapa solo cubre lo heredado; las pantallas nuevas guardan su ruta next en bd
export function rutaDe(url: string): string | null {
  const u = (url ?? '').trim()
  if (!u) return null
  return u.startsWith('/') ? u : (URL_MAP[u] ?? null)
}

const LABEL_OVERRIDE: Record<string, string> = {
  'Mis Proyectos': 'Proyectos',
  'Mis Necesidades': 'Necesidades',
  // la fila de la empresa en el Exadata; en el XE está inactiva (MENXEST = 'I') y getMenu no la trae: allí se inyecta con este nombre
  'Mis Convenios': 'Convenios',
}

const EXTRA_ITEMS: MenuItem[] = [
  { desc: 'Convenios', url: 'WPConvenios.aspx', icono: 'ScrollText' },
]

// respaldo con lo que sembró v1 para la empresa: en el Exadata la tabla MENU no tiene esas filas. Mismo nombre e
// ícono que en el XE, que las muestra después de los datos básicos
const MENU_EMPRESA_V1: MenuItem[] = [
  { desc: 'Contactos', url: 'ContactosEmpresa.aspx',    icono: 'nav-icon fas fa-address-book' },
  { desc: 'Analisis',  url: 'AnalisisEmpresarial.aspx', icono: 'nav-icon fas fa-chart-bar' },
]

// respaldo con lo que sembraron v39 (gestor) y v58 (evaluador): en el Exadata la tabla MENU no tiene esas filas
const MENU_GESTOR_EVALUADORES: MenuItem[] = [
  { desc: 'Banco de Evaluadores', url: '/panel/evaluadores',               icono: 'fa-shield-check' },
  { desc: 'Convocatorias',        url: '/panel/evaluadores/convocatorias', icono: 'fa-bullhorn' },
  { desc: 'Catálogos',            url: '/panel/evaluadores/catalogos',     icono: 'fa-sliders' },
]
const MENU_EVALUADOR: MenuItem[] = [
  { desc: 'Mi expediente',        url: '/panel/mi-expediente',     icono: 'fa-id-card' },
  { desc: 'Mi retroalimentación', url: '/panel/retroalimentacion', icono: 'fa-sitemap' },
]

/** Los dos perfiles del banco. El gestor no tiene el mismo id en las dos bases: sale de GET /perfiles/claves. */
export interface PerfilesBanco { evaluador: number; gestorEvaluadores: number }

/** `banco` null: el perfil no es del banco (la empresa, que así no espera las claves para tener menú). */
export function armarMenu(filas: MenuItem[], perfilId: number, banco: PerfilesBanco | null): MenuItem[] {
  const items = filas.map(item => ({
    ...item,
    desc: LABEL_OVERRIDE[item.desc] ?? item.desc,
  }))

  // perfiles del banco: su menú viene completo de la tabla MENU, no se les inyecta convenios
  if (banco && perfilId === banco.gestorEvaluadores) {
    return items.length > 0 ? items : MENU_GESTOR_EVALUADORES.map(it => ({ ...it }))
  }
  if (banco && perfilId === banco.evaluador) {
    return items.length > 0 ? items : MENU_EVALUADOR.map(it => ({ ...it }))
  }

  if (isEmpresa(perfilId)) {
    // cada una va detrás de la anterior, empezando por los datos básicos; sin esa fila, al final
    let despues = items.findIndex(it => rutaDe(it.url) === '/panel/datos')
    for (const extra of MENU_EMPRESA_V1) {
      const ya = items.findIndex(it => rutaDe(it.url) === rutaDe(extra.url))
      if (ya >= 0) despues = ya
      else if (despues < 0) items.push({ ...extra })
      else items.splice(++despues, 0, { ...extra })
    }
  }

  for (const extra of EXTRA_ITEMS) {
    // ya hay una fila que lleva a la misma pantalla ("Mis Convenios" en el Exadata)
    if (!items.some(it => rutaDe(it.url) === rutaDe(extra.url))) items.push({ ...extra })
  }
  return items
}
