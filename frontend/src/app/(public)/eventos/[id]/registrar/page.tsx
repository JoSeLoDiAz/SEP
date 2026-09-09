import { notFound } from 'next/navigation'
import { RegistroWizard } from '@/components/public/eventos/registro/registro-wizard'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const evento = await getEvento(id)
  return {
    title: evento?.nombreEvento ? `Registro: ${evento.nombreEvento}` : 'Registro a Evento',
  }
}

async function getEvento(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://sep_backend:4000'
    const res = await fetch(`${baseUrl}/eventos/${id}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function RegistrarPage({ params }: Props) {
  const { id } = await params
  const evento = await getEvento(id)

  if (!evento || !evento.eventoActivo || !evento.eventoVisible) {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Título */}
      <div
        className="flex items-center gap-3 px-6 py-4 text-white font-bold text-xl rounded-lg shadow"
        style={{ backgroundColor: '#00304D' }}
      >
        <span>📋</span>
        Inscripción a Evento
      </div>

      <p className="text-sm text-neutral-500">
        Evento:{' '}
        <strong className="text-neutral-700">{evento.eventoNombre}</strong>
      </p>

      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-6">
        <RegistroWizard
          eventoId={Number(id)}
          eventoNombre={evento.eventoNombre}
        />
      </div>
    </div>
  )
}
