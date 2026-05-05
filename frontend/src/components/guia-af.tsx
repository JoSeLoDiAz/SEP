'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen, ChevronRight, ClipboardList, FileText, Flag,
  GraduationCap, HelpCircle, MapPin, PencilLine, Receipt,
  Sparkles, X,
} from 'lucide-react'

type SeccionId = 'detalle' | 'unidades' | 'cobertura' | 'rubros'

interface Seccion {
  id: SeccionId
  titulo: string
  subtitulo: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

const SECCIONES: Seccion[] = [
  { id: 'detalle',   titulo: '¿Cómo lleno el detalle de la AF?', subtitulo: 'Información de la Acción de Formación', icon: PencilLine },
  { id: 'unidades',  titulo: '¿Qué son las Unidades Temáticas?', subtitulo: 'UTs, perfiles, actividades y horas',     icon: BookOpen },
  { id: 'cobertura', titulo: '¿Cómo registro la cobertura?',     subtitulo: 'Departamentos, ciudades y modalidades',  icon: MapPin },
  { id: 'rubros',    titulo: '¿Cómo registro los rubros?',       subtitulo: 'Presupuesto, cofinanciación y contrapartida', icon: Receipt },
]

const TITLE_COLOR = '#00304D'

export function GuiaAF({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [render, setRender] = useState(false)
  const [visible, setVisible] = useState(false)
  const [seccion, setSeccion] = useState<SeccionId>('detalle')
  const contenidoRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (contenidoRef.current) contenidoRef.current.scrollTop = 0
  }, [seccion])

  useEffect(() => {
    if (open) {
      setRender(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      const t = setTimeout(() => setRender(false), 260)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = original }
    }
  }, [open])

  if (!render) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
      style={{
        backgroundColor: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        transition: 'background-color 260ms ease',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.96)',
          transition: 'opacity 260ms ease, transform 260ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-neutral-200" style={{ backgroundColor: TITLE_COLOR }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <GraduationCap size={20} className="text-white" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Guía de la AF</p>
              <h2 className="text-white font-bold text-base sm:text-lg truncate">Cómo llenar la Acción de Formación</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0"
            aria-label="Cerrar guía"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: sidebar + contenido */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">

          {/* Sidebar */}
          <aside className="sm:w-72 sm:shrink-0 sm:border-r border-b sm:border-b-0 border-neutral-200 bg-neutral-50 overflow-y-auto">
            <nav className="p-3 flex sm:flex-col gap-2 overflow-x-auto sm:overflow-x-visible">
              {SECCIONES.map(s => {
                const activo = seccion === s.id
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    onClick={() => setSeccion(s.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition w-full shrink-0 sm:shrink ${
                      activo
                        ? 'bg-white shadow-sm border border-neutral-200'
                        : 'hover:bg-white/70 border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        activo ? 'text-white' : 'bg-white text-neutral-500 border border-neutral-200'
                      }`}
                      style={activo ? { backgroundColor: TITLE_COLOR } : undefined}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-bold leading-tight ${activo ? 'text-neutral-900' : 'text-neutral-700'}`}>
                        {s.titulo}
                      </p>
                      <p className="text-[10.5px] text-neutral-500 leading-tight mt-0.5 hidden sm:block">{s.subtitulo}</p>
                    </div>
                    <ChevronRight size={14} className={`hidden sm:block shrink-0 ${activo ? 'text-neutral-400' : 'text-neutral-300'}`} />
                  </button>
                )
              })}
            </nav>
            <div className="p-4 hidden sm:block">
              <div className="rounded-xl border border-neutral-200 bg-white p-3 text-[11px] text-neutral-500 leading-relaxed">
                <p className="font-semibold text-neutral-700 mb-1 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                  Tip rápido
                </p>
                <p>Cada apartado tiene su propio botón <strong>Guardar</strong>. Llena lo que tengas claro y vuelve después por el resto.</p>
              </div>
            </div>
          </aside>

          {/* Contenido */}
          <section ref={contenidoRef} className="flex-1 overflow-y-auto bg-white">
            <div className="p-5 sm:p-7 max-w-3xl">
              {seccion === 'detalle'   && <SeccionDetalle />}
              {seccion === 'unidades'  && <SeccionUnidades />}
              {seccion === 'cobertura' && <SeccionCobertura />}
              {seccion === 'rubros'    && <SeccionRubros />}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3">
          <p className="text-[11px] text-neutral-500">
            Puedes abrir esta guía en cualquier momento desde el botón <strong>Ayuda</strong> de la AF.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white rounded-xl transition hover:opacity-90"
            style={{ backgroundColor: TITLE_COLOR }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers visuales ─────────────────────────────────────────────────────────

function H1({ icon: Icon, children, sub }: { icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; children: React.ReactNode; sub?: string }) {
  return (
    <header className="mb-5 pb-4 border-b border-neutral-200">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: TITLE_COLOR }}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-bold text-neutral-900 leading-tight">{children}</h3>
          {sub && <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{sub}</p>}
        </div>
      </div>
    </header>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-bold uppercase tracking-wide mt-6 mb-2" style={{ color: TITLE_COLOR }}>
      {children}
    </h4>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-700 leading-relaxed mb-3">{children}</p>
}

function Pasos({ items }: { items: Array<{ titulo: string; texto: string }> }) {
  return (
    <ol className="flex flex-col gap-3 my-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: TITLE_COLOR }}>
            {i + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-neutral-800">{it.titulo}</p>
            <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">{it.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Aviso({ tipo, titulo, children }: { tipo: 'info' | 'tip' | 'warn'; titulo: string; children: React.ReactNode }) {
  const cfg = {
    info: { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',  title: 'text-blue-900',  Icon: ClipboardList },
    tip:  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'text-amber-600', title: 'text-amber-900', Icon: Sparkles },
    warn: { bg: 'bg-red-50',    border: 'border-red-200',    icon: 'text-red-600',   title: 'text-red-900',   Icon: Flag },
  }[tipo]
  const Icon = cfg.Icon
  return (
    <div className={`my-3 rounded-xl border ${cfg.border} ${cfg.bg} p-3 flex gap-3`}>
      <Icon size={16} className={`${cfg.icon} mt-0.5 shrink-0`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] font-bold uppercase tracking-wide ${cfg.title}`}>{titulo}</p>
        <div className="text-[13px] text-neutral-700 mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

// ── Sección 1: Detalle AF ────────────────────────────────────────────────────

function SeccionDetalle() {
  return (
    <article>
      <H1 icon={PencilLine} sub="La información de la AF describe qué se va a formar, a quién, en qué modalidad y por qué.">
        ¿Cómo lleno el detalle de la AF?
      </H1>

      <P>
        El detalle de cada Acción de Formación se llena por bloques. No tienes que terminarlos en un solo intento:
        cada bloque se guarda con su botón <strong>Guardar</strong> y puedes volver más adelante por el resto.
      </P>

      <H2>Bloques principales</H2>
      <Pasos items={[
        { titulo: 'Información de la AF',
          texto: 'Nombre claro y corto, problema o necesidad detectada (la vinculas a una de las que registraste en Necesidades), justificación, causas, efectos y objetivo. Estos textos sustentan por qué esta AF responde a una necesidad real.' },
        { titulo: 'Tipo de evento y modalidad',
          texto: 'El evento (Conferencia, Diplomado, Taller, etc.) y la modalidad (Presencial, PAT, Virtual, Híbrida) determinan reglas distintas en horas, rubros y cobertura. Si más adelante cambias evento o modalidad y la AF ya tiene rubros, el sistema te pedirá eliminarlos primero — porque los topes y porcentajes cambian.' },
        { titulo: 'Perfil de los beneficiarios',
          texto: 'Quiénes son las personas que reciben la formación: cargos, áreas funcionales, niveles ocupacionales, ocupaciones CUOC y sectores productivos. Sirve para que el SENA verifique pertinencia.' },
        { titulo: 'Alineación territorial y retos nacionales',
          texto: 'Marca con qué retos nacionales y articulación territorial se alinea la AF. Cada uno permite un texto corto que justifica el aporte.' },
        { titulo: 'Ambiente, material y recursos didácticos',
          texto: 'Tipo de ambiente (aula, taller, virtual, etc.), material de apoyo y recursos didácticos. Son obligatorios para que la AF se considere completa.' },
        { titulo: 'Grupos y cobertura territorial',
          texto: 'Cuántos grupos vas a abrir y en qué departamentos/ciudades. La suma de beneficiarios de las coberturas de un grupo debe coincidir EXACTO con los beneficiarios esperados por grupo.' },
      ]} />

      <Aviso tipo="tip" titulo="Llena las Necesidades primero">
        El campo &quot;problema o necesidad detectada&quot; sale del módulo <strong>Necesidades</strong>. Si aún no lo has llenado,
        la AF no podrá vincularse a una necesidad y no quedará completa.
      </Aviso>

      <Aviso tipo="warn" titulo="Cambiar evento o modalidad borra rubros">
        Si la AF ya tiene rubros y cambias el tipo de evento, la modalidad o el número de grupos, el sistema te
        pide eliminar los rubros antes — los topes, beneficiarios y horas dependen de esos campos.
      </Aviso>
    </article>
  )
}

// ── Sección 2: Unidades Temáticas ────────────────────────────────────────────

function SeccionUnidades() {
  return (
    <article>
      <H1 icon={BookOpen} sub="Las UT son los temas que se enseñan dentro de la AF; cada una tiene perfil de capacitador, actividades y horas.">
        ¿Qué son las Unidades Temáticas?
      </H1>

      <P>
        Una <strong>Unidad Temática (UT)</strong> es cada tema o módulo que va a contener la AF. Una AF puede
        tener una o varias UTs. Cada UT define qué va a comprender, cuántas horas dura, qué actividades de
        aprendizaje incluye y qué perfil debe tener el capacitador que la dicta.
      </P>

      <H2>Qué llenas en cada UT</H2>
      <Pasos items={[
        { titulo: 'Nombre y tipo de UT',
          texto: 'Nombre claro de la UT y la(s) competencia(s) que se desarrollan. Si la UT corresponde a articulación territorial, márcala con ese tipo para que quede registrada como tal.' },
        { titulo: 'Contenido y actividades',
          texto: 'Contenido de la UT y las actividades de aprendizaje (con su justificación). Las actividades se eligen del catálogo y describen cómo se trabajará el tema con los beneficiarios.' },
        { titulo: 'Horas prácticas y teóricas',
          texto: 'Las horas se separan según la modalidad de la AF (presencial, virtual, PAT o híbrida). El sistema valida que las horas registradas en las UT coincidan con las horas totales que declaraste en la AF.' },
        { titulo: 'Perfil del capacitador',
          texto: 'Qué experiencia, formación y horas debe tener el capacitador para dictar esta UT. Lo eliges del catálogo de rubros (R01) que viene predefinido según evento y modalidad.' },
      ]} />

      <Aviso tipo="info" titulo="¿Cuántas UT debo registrar?">
        Depende del tipo de evento. Una conferencia puede tener una sola UT; un diplomado o taller tienen varias.
        Lo importante es que las horas totales de las UT coincidan con las horas de la AF, y que respetes los
        <strong> porcentajes mínimos de horas prácticas</strong> establecidos en el pliego de condiciones —
        cumplir esos mínimos evita que la AF sea rechazada al evaluar la propuesta.
      </Aviso>

      <Aviso tipo="warn" titulo="Sin UTs la AF está incompleta">
        Una AF sin Unidades Temáticas no puede confirmarse. El sistema te lo recordará al intentar marcar la
        versión como FINAL.
      </Aviso>
    </article>
  )
}

// ── Sección 3: Cobertura ─────────────────────────────────────────────────────

function SeccionCobertura() {
  return (
    <article>
      <H1 icon={MapPin} sub="La cobertura indica dónde se va a desarrollar la formación y a cuántos beneficiarios llegas en cada lugar.">
        ¿Cómo registro la cobertura?
      </H1>

      <P>
        La <strong>cobertura</strong> es donde declaras los lugares en los que se va a dictar la formación y cuántos
        beneficiarios reciben capacitación en cada uno. La forma de registrarla cambia según la <strong>modalidad </strong>
        de la AF, porque cada modalidad tiene reglas distintas.
      </P>

      <H2>Cómo se registra según la modalidad</H2>
      <Pasos items={[
        { titulo: 'Presencial',
          texto: 'Registras los departamentos y ciudades donde se dictará la formación de manera física. La suma de beneficiarios de las coberturas debe coincidir EXACTO con los beneficiarios esperados por grupo.' },
        { titulo: 'PAT (Presencial Asistida por Tecnología)',
          texto: 'Se registra así: departamentos donde se ubica el grupo. Pueden ser varios departamentos según lo necesario.' },
        { titulo: 'Virtual',
          texto: 'Registras la cobertura territorial de los beneficiarios (de qué departamentos reciben la formación).' },
        { titulo: 'Híbrida',
          texto: 'Tiene un registro doble: por un lado declaras la cobertura presencial (lugar físico donde se realiza la parte presencial) y por otro la cobertura virtual (territorios de los beneficiarios que toman la parte virtual). Las dos partes se llenan en pestañas separadas.' },
      ]} />

      <Aviso tipo="warn" titulo="La suma de beneficiarios debe cuadrar">
        El sistema valida que la suma de beneficiarios de todas las coberturas de un grupo sea EXACTAMENTE igual a
        los beneficiarios esperados por grupo. Si no cuadra, no podrás guardar.
      </Aviso>

      <Aviso tipo="info" titulo="En híbrida revisa las dos pestañas">
        En modalidad híbrida es común olvidar llenar una de las dos coberturas (presencial o virtual). Verifica
        ambas pestañas antes de marcar la versión como FINAL — el sistema te lo recordará si falta alguna.
      </Aviso>
    </article>
  )
}

// ── Sección 4: Rubros ────────────────────────────────────────────────────────

function SeccionRubros() {
  return (
    <article>
      <H1 icon={Receipt} sub="Los rubros son los costos de la AF. El proponente los formula de manera abierta según lo que requiera, dentro de los topes vigentes.">
        ¿Cómo registro los rubros?
      </H1>

      <P>
        Los rubros son los <strong>costos asociados a cada AF</strong>. El proponente los formula de manera abierta
        según lo que requiera o considere necesario para ejecutar la AF, dentro de los rubros financiables y los
        topes que aplican para la vigencia.
      </P>

      <H2>Cómo se llena cada rubro</H2>
      <Pasos items={[
        { titulo: 'Selecciona el rubro del catálogo',
          texto: 'El catálogo solo te muestra los rubros válidos para el evento y modalidad de la AF. Si no ves un rubro que esperabas, revisa que el evento y modalidad estén correctos.' },
        { titulo: 'Llena los campos requeridos',
          texto: 'Justificación, número de horas, cantidad, beneficiarios, número de grupos, valor máximo y valor por beneficiario. Algunos campos solo aplican a ciertos rubros — los demás aparecen deshabilitados.' },
        { titulo: 'Cofinanciación SENA y contrapartida',
          texto: 'Tú ingresas el valor de cofinanciación SENA (lo que aporta el SENA) y el valor de la contrapartida (lo que aporta el proponente). El sistema calcula automáticamente el porcentaje de cada uno y la suma total, y valida que los porcentajes estén dentro de los topes definidos.' },
      ]} />

      <Aviso tipo="tip" titulo="Si te pasas del tope, el sistema te avisa">
        Cuando registras un rubro, el sistema valida los topes y te muestra el aviso en rojo si te excedes.
        No te deja guardar hasta que ajustes.
      </Aviso>

      <Aviso tipo="warn" titulo="Cambiar rubros afecta los totales">
        Cada vez que agregas, modificas o eliminas un rubro, los totales de la AF y del proyecto se recalculan
        automáticamente. Verifica que los valores sigan correctos después de cada cambio.
      </Aviso>

      <Aviso tipo="info" titulo="Lee el pliego y la resolución de rubros financiables">
        Antes de formular los rubros, revisa el <strong>pliego de la convocatoria</strong> y la <strong>resolución
        de rubros financiables</strong> que aplica para la vigencia. Allí están los topes, porcentajes y reglas
        particulares que el sistema no puede deducir solo.
      </Aviso>
    </article>
  )
}

// ── Botón flotante reusable ──────────────────────────────────────────────────

export function GuiaAFBoton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 transition ${className ?? ''}`}
        title="Abrir guía de la Acción de Formación"
      >
        <HelpCircle size={13} strokeWidth={2.2} />
        Ayuda
      </button>
      <GuiaAF open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// silenciar warning de import no usado en algunos casos
void FileText
