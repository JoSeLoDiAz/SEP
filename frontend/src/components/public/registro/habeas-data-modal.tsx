'use client'

import { Modal } from '@/components/ui/modal'
import Image from 'next/image'

interface HabeasDataModalProps {
  open: boolean
  onClose: () => void
}

export function HabeasDataModal({ open, onClose }: HabeasDataModalProps) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="bg-[#00304D] px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <Image src="/images/sena-logo.svg" alt="SENA" width={40} height={40}
            className="brightness-0 invert object-contain" />
          <h2 className="text-white font-semibold text-base">
            Términos y Condiciones — Habeas Data
          </h2>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 text-sm text-neutral-700 leading-relaxed space-y-3">
            <p>
              De conformidad con lo dispuesto en la <strong>Ley 1581 de 2012</strong>, su Decreto
              Reglamentario 1377 de 2013 y el <strong>Acuerdo No. 009 de 2016</strong>, AUTORIZO de
              manera libre, previa, expresa, voluntaria y debidamente informada, a que el{' '}
              <strong>Servicio Nacional de Aprendizaje – SENA</strong> recolecte, recaude, almacene,
              use, circule, suprima, procese, compile, intercambie, dé tratamiento, actualice y
              disponga de los datos que han sido suministrados y que se han incorporado en distintas
              bases o bancos de datos de todo tipo en el marco de las convocatorias que adelanta el{' '}
              <strong>Grupo de Gestión para la Productividad y la Competitividad</strong>.
            </p>
            <p>
              En este sentido, el SENA queda autorizado de manera expresa e inequívoca para
              mantener y manejar toda mi información personal y profesional para los fines que se
              encuentra legal y reglamentariamente facultado; para darlos a conocer a los gremios,
              empresas, personas naturales, entre otros que suscriban Convenios Especiales de
              Cooperación en el marco de las Convocatorias que adelanta el Grupo de Gestión para la
              Productividad y la Competitividad.
            </p>
            <p>
              Sin perjuicio de lo anterior, los referidos datos no podrán ser distribuidos,
              comercializados, compartidos, suministrados o intercambiados con terceros, y en
              general, realizar actividades en las cuales se vea comprometida la confidencialidad y
              protección de la información recolectada, y podré en cualquier momento solicitar que
              la información sea modificada, actualizada o retirada de las bases de datos del SENA.
            </p>
            <p>
              Así mismo, se me indicó que para mayor información podré consultar en cualquier
              momento el{' '}
              <a
                href="https://normograma.sena.edu.co/compilacion/docs/acuerdo_sena_0009_2016.htm"
                target="_blank"
                rel="noreferrer"
                className="text-cerulean-500 underline hover:text-cerulean-700"
              >
                Acuerdo 009 del 2016 – Tratamiento de Datos Personales – SENA
              </a>
              , la Ley 1581 de 2012 y el Decreto 1377 de 2013.
            </p>
          </div>
        </div>

        {/* Pie */}
        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-lime-500 hover:bg-lime-600 text-white font-semibold text-sm rounded-xl transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  )
}
