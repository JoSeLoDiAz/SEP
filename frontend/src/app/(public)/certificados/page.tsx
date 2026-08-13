import { Award } from 'lucide-react'
import { CabeceraPagina } from '@/components/public/cabecera-pagina'
import { CertificadosForm } from '@/components/public/certificados/certificados-form'

export const metadata = {
  title: 'Descarga de Certificados',
  description: 'Descarga tu certificado de participación en los eventos del GGPC SENA.',
}

export default function CertificadosPage() {
  return (
    <div className="flex flex-col">
      <CabeceraPagina
        icono={Award}
        titulo="Descarga de certificados"
        descripcion="Consulta y descarga tus certificados de participación en los eventos del GGPC, como beneficiario de una acción de formación o como evaluador del banco."
      />

      <div className="mx-auto w-full max-w-5xl px-6 pb-14 pt-2">
        <CertificadosForm />
      </div>
    </div>
  )
}
