'use client'

import Link from 'next/link'
import { CheckCircle2, FolderKanban, Layers, PiggyBank } from 'lucide-react'

export type ProyectoTab = 'generalidades' | 'acciones' | 'presupuesto' | 'confirmar'

interface ProyectoTabsProps {
  proyectoId: number
  active: ProyectoTab
  /** Si true, no renderiza el tab "Confirmar Proyecto" (útil cuando la página
   *  ya lo expone como botón con modal local). */
  hideConfirmar?: boolean
  /** Sub-tabs adicionales (p. ej. Detalle AF, Rubros) que aparecen a la derecha. */
  extraTabs?: React.ReactNode
}

const baseCls = 'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition'
const idleCls = 'bg-white border border-neutral-200 text-[#00304D] hover:bg-[#00304D] hover:text-white'
const activeCls = 'bg-[#00304D] text-white'

/** Menú de tabs uniforme para todas las páginas del proyecto.
 *  Iconos asignados por concepto:
 *    Generalidades  → FolderKanban
 *    Acciones AF    → Layers
 *    Presupuesto    → PiggyBank
 *    Confirmar      → CheckCircle2
 */
export function ProyectoTabs({ proyectoId, active, hideConfirmar, extraTabs }: ProyectoTabsProps) {
  function tab(key: ProyectoTab, href: string, label: string, Icon: React.ComponentType<{ size?: number }>) {
    const cls = `${baseCls} ${active === key ? activeCls : idleCls}`
    if (active === key) {
      return <span className={cls}><Icon size={13} /> {label}</span>
    }
    return <Link href={href} className={cls}><Icon size={13} /> {label}</Link>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {tab('generalidades', `/panel/proyectos/${proyectoId}`,             'Generalidades',         FolderKanban)}
      {tab('acciones',      `/panel/proyectos/${proyectoId}/acciones`,    'Acciones de Formación', Layers)}
      {tab('presupuesto',   `/panel/proyectos/${proyectoId}/presupuesto`, 'Presupuesto del Proyecto', PiggyBank)}
      {!hideConfirmar && tab('confirmar', `/panel/proyectos/${proyectoId}?action=confirmar`, 'Confirmar Proyecto', CheckCircle2)}
      {extraTabs}
    </div>
  )
}
