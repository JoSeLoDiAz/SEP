'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2, ChevronRight, ClipboardList, FileCheck2, FileText, Flag,
  HelpCircle, History, Lock, PencilLine, ShieldCheck,
  Sparkles, Trophy, X, XCircle,
} from 'lucide-react'

type SeccionId = 'formulacion' | 'versiones' | 'evaluacion' | 'aprobado'

interface Seccion {
  id: SeccionId
  titulo: string
  subtitulo: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

const SECCIONES: Seccion[] = [
  { id: 'formulacion', titulo: '¿Cómo lleno el proyecto de formación?', subtitulo: 'Orden de registro recomendado', icon: PencilLine },
  { id: 'versiones',   titulo: '¿Cómo funciona el control de versiones?', subtitulo: 'Versiones del proyecto y versión FINAL', icon: History },
  { id: 'evaluacion',  titulo: '¿Cómo me evalúa SENA?',    subtitulo: 'Estados y qué significan',     icon: ShieldCheck },
  { id: 'aprobado',    titulo: '¿Y cuando me aprueben?',   subtitulo: 'Después de la aprobación',     icon: Trophy },
]

const TITLE_COLOR = '#00304D'

export function GuiaProponente({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [render, setRender] = useState(false)
  const [visible, setVisible] = useState(false)
  const [seccion, setSeccion] = useState<SeccionId>('formulacion')
  const contenidoRef = useRef<HTMLElement | null>(null)

  // Cada vez que el usuario cambia de sección, el contenido vuelve al inicio
  // del scroll para que la nueva sección se vea desde su título y no desde
  // donde quedó la anterior.
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

  // Bloquear scroll del body mientras la guía esté abierta
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
              <HelpCircle size={20} className="text-white" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Guía del Proponente</p>
              <h2 className="text-white font-bold text-base sm:text-lg truncate">Cómo funciona el sistema, en palabras simples</h2>
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
                  ¿Tienes dudas?
                </p>
                <p>Esta guía está pensada para responder, paso a paso, lo que un proponente necesita saber para llenar el proyecto y entregarlo al SENA.</p>
              </div>
            </div>
          </aside>

          {/* Contenido */}
          <section ref={contenidoRef} className="flex-1 overflow-y-auto bg-white">
            <div className="p-5 sm:p-7 max-w-3xl">
              {seccion === 'formulacion' && <SeccionFormulacion />}
              {seccion === 'versiones'   && <SeccionVersiones />}
              {seccion === 'evaluacion'  && <SeccionEvaluacion />}
              {seccion === 'aprobado'    && <SeccionAprobado />}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3">
          <p className="text-[11px] text-neutral-500">
            Puedes abrir esta guía en cualquier momento desde el botón <strong>Ayuda</strong> del proyecto.
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

// ── Secciones ──────────────────────────────────────────────────────────────

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

function EstadoCard({ color, icon: Icon, titulo, descripcion, accion }: {
  color: 'gray' | 'blue' | 'amber' | 'green' | 'red'
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  titulo: string
  descripcion: string
  accion: string
}) {
  const cfg = {
    gray:  { bg: 'bg-neutral-50',  border: 'border-neutral-200', dot: 'bg-neutral-400',  text: 'text-neutral-700' },
    blue:  { bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-500',     text: 'text-blue-800' },
    amber: { bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-500',    text: 'text-amber-800' },
    green: { bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500',  text: 'text-emerald-800' },
    red:   { bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500',      text: 'text-red-800' },
  }[color]
  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 flex gap-3`}>
      <div className={`w-9 h-9 rounded-lg ${cfg.dot} text-white flex items-center justify-center shrink-0`}>
        <Icon size={16} strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${cfg.text}`}>{titulo}</p>
        <p className="text-xs text-neutral-700 mt-1 leading-relaxed">{descripcion}</p>
        <p className={`text-[11px] font-semibold uppercase tracking-wide mt-2 ${cfg.text}`}>
          ¿Qué puedo hacer? <span className="text-neutral-700 font-normal normal-case tracking-normal">{accion}</span>
        </p>
      </div>
    </div>
  )
}

// ── Sección 1: Formulación ─────────────────────────────────────────────────

function SeccionFormulacion() {
  return (
    <article>
      <H1 icon={PencilLine} sub="El orden de registro recomendado para que el proyecto de formación te quede completo y sin errores.">
        ¿Cómo lleno el proyecto de formación?
      </H1>

      <P>
        Llenar un proyecto de formación en este sistema es como llenar un formulario por partes. El sistema va
        guardando lo que escribes en cada apartado; no tienes que terminar todo en un solo intento.
      </P>

      <H2>Orden de registro recomendado</H2>
      <Pasos items={[
        { titulo: 'Datos de la entidad proponente al día',
          texto: 'Antes de empezar el proyecto, asegúrate de tener actualizados los datos de tu entidad (razón social, NIT, dirección, datos del representante legal, etc.) en la sección "Mis Datos".' },
        { titulo: 'Registrar los datos de contactos',
          texto: 'Registra los contactos asociados a la entidad. Si al momento de crear el proyecto aún no los tienes claros, también puedes agregarlos desde la pantalla del proyecto.' },
        { titulo: 'Análisis de la entidad proponente',
          texto: 'En la sección "Análisis" registras el análisis de la entidad proponente: información que sustenta el contexto del proyecto.' },
        { titulo: 'Diagnóstico y necesidades de formación',
          texto: 'En la sección "Necesidades" registras el diagnóstico y las necesidades de formación encontradas. Cada necesidad luego se vincula a una o varias acciones de formación.' },
        { titulo: 'Crear el proyecto de formación',
          texto: 'Crea el proyecto con su convocatoria, objeto del proyecto, modalidad de participación y demás datos generales.' },
        { titulo: 'Acciones de Formación (AF)',
          texto: 'Por cada AF llenas: nombre, evento, modalidad, perfil de los beneficiarios, justificación de por qué la AF es especializada, perfil, alineación territorial, ambiente de formación, material y, lo más importante, las Unidades Temáticas (UT), los Rubros del presupuesto, entre otras.' },
        { titulo: 'Presupuesto del proyecto',
          texto: 'No tienes que sumar nada a mano: el sistema toma los rubros de cada AF y arma el presupuesto del proyecto solo. En la pestaña "Presupuesto" puedes verificar que los porcentajes de cofinanciación SENA y contrapartida estén correctos. Al final verás un botón Guardar Presupuesto que valida que los porcentajes de Gastos de Operación y Transferencia estén dentro de los topes sugeridos por la convocatoria.' },
        { titulo: 'Reporte / Confirmación',
          texto: 'Cuando ya tienes todo, ve a "Reporte / Confirmación del Proyecto". Allí puedes ver una vista completa del proyecto como quedaría en PDF, y desde esa misma página creas las versiones del proyecto (mira la siguiente sección de la guía).' },
      ]} />

      <H2>Lo que el sistema verifica por ti</H2>
      <P>
        Mientras llenas el proyecto de formación, el sistema te muestra avisos cuando algo no cumple con las reglas
        del <strong>pliego de condiciones de la convocatoria y vigencia</strong> (en este caso, Convocatoria de
        Formación Continua Especializada vigencia 2026). Hay dos tipos de avisos:
      </P>
      <ul className="text-sm text-neutral-700 leading-relaxed mb-3 list-disc pl-5 space-y-1">
        <li><strong>Bloqueos</strong> (en rojo): no te dejan guardar hasta que corrijas, porque romperían una regla obligatoria.</li>
        <li><strong>Recordatorios</strong> (en amarillo): te avisan que falta algo, pero te dejan continuar para que termines más adelante.</li>
      </ul>

      <Aviso tipo="tip" titulo="Recuerda guardar">
        Cada apartado que actualices tiene su propio botón <strong>Guardar</strong>. No olvides darle clic para que
        tus cambios queden registrados en el sistema.
      </Aviso>

      <Aviso tipo="info" titulo="¿Puedo dejar el proyecto a medias?">
        Sí. Puedes cerrar sesión y volver al día siguiente: lo que escribiste queda guardado. Solo cuando crees una
        versión <strong>FINAL</strong> el proyecto se bloquea para edición (lo explicamos en la siguiente sección).
        Eso sí, recuerda que debes darle al botón <strong>Guardar</strong> en cada apartado que actualices.
      </Aviso>
    </article>
  )
}

// ── Sección 2: Versiones ───────────────────────────────────────────────────

function SeccionVersiones() {
  return (
    <article>
      <H1 icon={History} sub="Las versiones son la forma de dejar registro de cómo va tu proyecto de formación.">
        ¿Cómo funciona el control de versiones?
      </H1>

      <P>
        Una <strong>versión</strong> es como una <strong>foto</strong> del proyecto en un momento exacto.
        Sirve para que quede guardado <em>exactamente</em> cómo estaba el proyecto en el momento que tú guardaste
        la versión: te sirve para auditar o mirar si hay cosas que pueden mejorar o ajustar, aunque después sigas
        haciendo cambios. Es como sacar una fotocopia y archivarla: una vez creada, la versión es <strong>inmutable</strong>.
        Pero puedes seguir realizando la formulación hasta que tengas una de las versiones creadas marcada como <strong>FINAL</strong>.
      </P>

      <H2>Hay dos clases de versiones</H2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={18} className="text-emerald-700" />
            <p className="text-sm font-bold text-emerald-900">Versión normal</p>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">
            Es como un <strong>borrador con fecha y hora</strong>. La puedes crear las veces que quieras
            mientras llenas el proyecto de formación. Sirve para tener un historial: si después cambias algo,
            las versiones anteriores siguen guardadas tal como estaban.
          </p>
          <p className="text-[11px] text-emerald-800 font-semibold mt-2">No entrega el proyecto al SENA. No bloquea nada.</p>
        </div>

        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={18} className="text-amber-700" />
            <p className="text-sm font-bold text-amber-900">Versión FINAL</p>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">
            Es la versión que <strong>entregas oficialmente al SENA</strong> según lo pida el proceso de la convocatoria.
            Solo puede haber una FINAL al tiempo. Cuando marcas una versión como FINAL, el proyecto queda
            <strong> bloqueado</strong>: ya no puedes seguir editando.
          </p>
          <p className="text-[11px] text-amber-800 font-semibold mt-2">Esta es la que el SENA va a evaluar.</p>
        </div>
      </div>

      <H2>¿Cuándo creo una versión normal?</H2>
      <P>
        Cada vez que termines un avance importante. Por ejemplo: cuando termines de llenar las generalidades,
        cuando agregues una nueva AF, o cuando ajustes el presupuesto. No hay un mínimo ni un máximo;
        hazlo cuando te dé tranquilidad tener un respaldo de cómo iba el proyecto en ese momento.
      </P>

      <H2>¿Cuándo creo la versión FINAL?</H2>
      <P>
        Cuando ya estés <strong>completamente seguro</strong> de que el proyecto está como lo quieres entregar al SENA.
        Antes de hacer FINAL revisa el reporte con calma, imprímelo en PDF si te ayuda, y verifica que no falten datos.
      </P>

      <Aviso tipo="warn" titulo="Marca una versión como FINAL y envía ese reporte">
        Recuerda que <strong>debes marcar una versión como FINAL</strong> y que el reporte que descargues de esa versión
        FINAL es el que debes enviar según lo pida el proceso de la convocatoria.
      </Aviso>

      <Aviso tipo="warn" titulo="Una vez marques FINAL, el proyecto se bloquea">
        Después de crear la versión FINAL no puedes seguir editando AF, rubros, ni presupuesto. Esto es a propósito,
        para que lo que entregaste al SENA quede congelado y no se modifique después.
      </Aviso>

      <H2>¿Y si me equivoqué después de marcar FINAL?</H2>
      <P>
        Mientras la convocatoria <strong>siga abierta</strong>, puedes <strong>quitar la marca FINAL</strong> a esa versión.
        El proyecto vuelve al estado <strong>Sin Confirmar</strong> y queda editable de nuevo. Cuando termines los ajustes,
        creas una nueva versión y la marcas como FINAL.
      </P>
      <P>
        Si la convocatoria <strong>ya cerró</strong>, ya no puedes quitar la marca FINAL: lo que entregaste es lo que el
        SENA va a evaluar.
      </P>

      <Aviso tipo="info" titulo="Cómo crear una versión">
        En la pestaña <strong>Reporte / Confirmación del Proyecto</strong> aparece un botón para crear versión.
        El sistema te pide un comentario corto (por ejemplo: "Versión inicial", "Ajuste de presupuesto", "Versión para enviar al SENA") y listo.
      </Aviso>
    </article>
  )
}

// ── Sección 3: Evaluación ──────────────────────────────────────────────────

function SeccionEvaluacion() {
  return (
    <article>
      <H1 icon={ShieldCheck} sub="Los estados por los que pasa el proyecto de formación y qué puedes hacer en cada uno.">
        ¿Cómo me evalúa SENA?
      </H1>

      <P>
        Tu proyecto de formación pasa por distintos <strong>estados</strong>. El estado lo ves siempre en la parte
        de arriba, al lado del nombre del proyecto. Aquí te explicamos cada uno con palabras simples.
      </P>

      <div className="flex flex-col gap-3 my-3">
        <EstadoCard color="gray"  icon={PencilLine}
          titulo="Sin Confirmar"
          descripcion="Es el estado inicial. Estás formulando el proyecto de formación: puedes editar todo, agregar AF, cambiar el presupuesto, etc. También vuelves a este estado si le quitas la marca FINAL a una versión para hacer ajustes."
          accion="Llenar el proyecto y crear versiones cuando quieras." />
        <EstadoCard color="blue" icon={Lock}
          titulo="Confirmado"
          descripcion="Marcaste una versión como FINAL. El proyecto queda bloqueado y queda esperando a que el SENA lo evalúe."
          accion="Esperar la evaluación del SENA. Si la convocatoria sigue abierta y necesitas corregir algo, puedes quitar la marca FINAL: el proyecto vuelve a estado Sin Confirmar y podrás seguir editando." />
        <EstadoCard color="green" icon={CheckCircle2}
          titulo="Aprobado"
          descripcion="El SENA aprobó tu proyecto de formación. Puede aprobar todas las AF o solo algunas; las que no apruebe quedan marcadas como rechazadas con su motivo."
          accion="Revisar en el reporte cuáles AF te quedaron aprobadas y cuáles fueron rechazadas. Esperar la firma del convenio." />
        <EstadoCard color="red"   icon={XCircle}
          titulo="Rechazado"
          descripcion="El SENA rechazó el proyecto completo. Aun en este caso, cada AF puede tener su propio concepto de aprobación o rechazo, que también puedes consultar."
          accion="Leer el motivo del rechazo en el bloque de Resultado de la evaluación y revisar el concepto de cada AF en el reporte." />
      </div>

      <H2>Lo que SENA puede hacer</H2>
      <ul className="text-sm text-neutral-700 leading-relaxed mb-3 list-disc pl-5 space-y-1">
        <li><strong>Aprobar todo el proyecto:</strong> todas las AF quedan aprobadas y el presupuesto del proyecto se mantiene como lo entregaste.</li>
        <li><strong>Aprobar solo algunas AF:</strong> el proyecto queda aprobado, pero algunas AF quedan rechazadas con su motivo. El presupuesto se ajusta automáticamente: las AF rechazadas <strong>no</strong> hacen parte del presupuesto final ni del plan operativo.</li>
        <li><strong>Rechazar todo el proyecto:</strong> el proyecto entero queda rechazado, con un motivo general. Aun así, cada AF tendrá su propio concepto (aprobada o rechazada) para que puedas verlo.</li>
      </ul>

      <Aviso tipo="tip" titulo="Cada AF tiene su propio concepto">
        Tanto si tu proyecto queda aprobado como si queda rechazado, <strong>cada AF tiene su propio concepto</strong>:
        aprobada o rechazada, con su motivo. Esto te permite saber con detalle cómo evaluó el SENA cada acción de formación.
      </Aviso>

      <Aviso tipo="info" titulo="¿Dónde veo el resultado?">
        En la pestaña <strong>Generalidades</strong> aparece un bloque con el resultado de la evaluación, pero
        <strong> solo cuando el SENA ya entregue oficialmente los resultados</strong>. Mientras el proceso de
        evaluación está en curso, no verás nada de ese proceso (ni adelantos ni resultados parciales). En el
        <strong> Reporte</strong>, una vez publicados los resultados, cada AF te muestra con un sello si fue aprobada
        o rechazada, y si fue rechazada, el motivo.
      </Aviso>

      <Aviso tipo="warn" titulo="¿Cuándo evalúa el SENA?">
        El SENA <strong>solo evalúa proyectos con versión FINAL creada</strong>. Si nunca marcas una versión como FINAL,
        el proyecto no entra a evaluación. Y recuerda: el reporte que descargues de la versión FINAL es el que
        <strong> debes enviar</strong> según lo pida el proceso de la convocatoria.
      </Aviso>
    </article>
  )
}

// ── Sección 4: Aprobado ────────────────────────────────────────────────────

function SeccionAprobado() {
  return (
    <article>
      <H1 icon={Trophy} sub="Qué pasa cuando el SENA aprueba tu proyecto de formación.">
        ¿Y cuando me aprueben?
      </H1>

      <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 my-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <FileCheck2 size={22} strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Resultado</p>
            <p className="text-base sm:text-lg font-bold text-emerald-900 leading-tight">
              El proyecto está listo para el proceso de ejecución una vez se firme el convenio.
            </p>
          </div>
        </div>
        <p className="text-sm text-neutral-700 leading-relaxed">
          Eso es todo. Cuando el SENA aprueba tu proyecto de formación, no hay más pasos en este módulo de
          formulación: el proyecto queda aprobado y, una vez se firme el convenio, comienza la ejecución
          (que pronto se podrá manejar también desde este sistema).
        </p>
      </div>

      <H2>Antes de la firma, revisa esto en el sistema</H2>
      <ul className="text-sm text-neutral-700 leading-relaxed mb-3 list-disc pl-5 space-y-1">
        <li>En <strong>Generalidades</strong> aparece un bloque con el resultado de la evaluación: cuántas AF se aprobaron y cuántas fueron rechazadas, con su concepto.</li>
        <li>En <strong>Acciones de Formación</strong> y en el <strong>Reporte</strong> cada AF tiene un sello que dice si está aprobada o rechazada. Si fue rechazada, abajo aparece el motivo.</li>
        <li>En <strong>Presupuesto del Proyecto</strong> ya verás los valores ajustados: el sistema descontó automáticamente las AF rechazadas (si las hay).</li>
      </ul>

      <Aviso tipo="tip" titulo="El proyecto queda como registro">
        Aunque ya esté aprobado, el proyecto se queda guardado en el sistema con todas sus versiones,
        las AF y el presupuesto, para consulta en cualquier momento.
      </Aviso>

      <H2>¿Qué viene después?</H2>
      <P>
        El siguiente paso es la <strong>firma del convenio</strong> entre la entidad proponente y el SENA.
        Ese trámite se hace por fuera de este sistema. Una vez firmado, el proyecto entra en
        <strong> ejecución</strong> y empiezan las acciones de formación con los beneficiarios.
      </P>

      <Aviso tipo="info" titulo="¿Algo no te queda claro?">
        Vuelve a esta guía las veces que necesites. La encuentras en el botón <strong>Ayuda</strong> que aparece
        en la barra superior del proyecto.
      </Aviso>
    </article>
  )
}

// ── Botón flotante reusable ────────────────────────────────────────────────

export function GuiaProponenteBoton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 transition ${className ?? ''}`}
        title="Abrir guía del proponente"
      >
        <HelpCircle size={13} strokeWidth={2.2} />
        Ayuda
      </button>
      <GuiaProponente open={open} onClose={() => setOpen(false)} />
    </>
  )
}
