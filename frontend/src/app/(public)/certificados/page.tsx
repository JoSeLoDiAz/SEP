import { Award } from 'lucide-react'
import { CertificadosForm } from '@/components/public/certificados/certificados-form'

export const metadata = {
  title: 'Descarga de Certificados',
  description: 'Descarga tu certificado de participación en los eventos del GGPC SENA.',
}

export default function CertificadosPage() {
  return (
    <div className="flex flex-col">
      {/* Barra de título — estilo GeneXus original */}
      <div
        className="w-full flex items-center gap-3 px-6 py-4 text-white font-semibold text-lg shadow-md"
        style={{ backgroundColor: '#00304D' }}
      >
        <Award size={22} className="flex-shrink-0" />
        Descarga de Certificados - SEP
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        <CertificadosForm />
      </div>
    </div>
  )
}
