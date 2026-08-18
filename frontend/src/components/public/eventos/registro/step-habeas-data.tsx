import { ShieldCheck, XCircle } from 'lucide-react'

interface Props {
  eventoNombre: string
  onAceptar: () => void
  onRechazar: () => void
}

export function StepHabeasData({ eventoNombre, onAceptar, onRechazar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Barra título */}
      <div
        className="flex items-center gap-3 px-6 py-4 text-white font-semibold text-lg rounded-lg shadow"
        style={{ backgroundColor: '#00304D' }}
      >
        <ShieldCheck size={22} className="flex-shrink-0" />
        LEY DE TRATAMIENTO DE DATOS — HABEAS DATA
      </div>

      <p className="text-sm text-neutral-500 italic">
        Inscripción al evento: <strong className="text-cerulean-500">{eventoNombre}</strong>
      </p>

      {/* Texto legal */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6 text-sm text-neutral-700 text-justify leading-relaxed space-y-4">
        <p>
          De conformidad con lo dispuesto en la Ley 1581 de 2012, su Decreto Reglamentario 1377 de 2013
          y el Acuerdo No. 009 de 2016, <strong>AUTORIZO</strong> de manera libre, previa, expresa,
          voluntaria y debidamente informada, a que el Servicio Nacional de Aprendizaje – SENA recolecte,
          recaude, almacene, use, circule, suprima, procese, compile, intercambie, dé tratamiento,
          actualice y disponga de los datos que han sido suministrados y que se han incorporado en distintas
          bases o bancos de datos de todo tipo en el marco de las convocatorias que adelanta el Grupo de
          Gestión para la Productividad y la Competitividad.
        </p>
        <p>
          En este sentido, el SENA queda autorizado de manera expresa e inequívoca para mantener y manejar
          toda mi información personal y profesional para los fines que se encuentra legal y
          reglamentariamente facultado; para darlos a conocer a los gremios, empresas, personas naturales,
          entre otros que suscriban Convenios Especiales de Cooperación en el marco de las Convocatorias
          que adelanta el Grupo de Gestión para la Productividad y la Competitividad.
        </p>
        <p>
          Sin perjuicio de lo anterior, los referidos datos no podrán ser distribuidos, comercializados,
          compartidos, suministrados o intercambiados con terceros, y en general, realizar actividades en
          las cuales se vea comprometida la confidencialidad y protección de la información recolectada,
          y podré en cualquier momento solicitar que la información sea modificada, actualizada o retirada
          de las bases de datos del SENA.
        </p>
        <p>
          Así mismo, se me indicó que para mayor información podré consultar en cualquier momento el
          Acuerdo No. 009 de 2016,{' '}
          <em>"Por el cual se aprueba la Política de tratamiento de datos personales en el Servicio
          Nacional de Aprendizaje SENA"</em>{' '}
          que se encuentra en la página de la Entidad:{' '}
          <a
            href="https://normograma.sena.edu.co/compilacion/docs/acuerdo_sena_0009_2016.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:underline"
          >
            Acuerdo 009 del 2016 — Tratamiento de Datos Personales — SENA
          </a>
          , la Ley 1581 de 2012 y el Decreto 1377 de 2013.
        </p>
      </div>

      {/* Botones */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={onAceptar}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-sm"
        >
          <ShieldCheck size={18} />
          Aceptar
        </button>
        <button
          onClick={onRechazar}
          className="flex items-center gap-2 bg-white border border-red-300 text-red-500 hover:bg-red-50 font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          <XCircle size={18} />
          No Acepto
        </button>
      </div>
    </div>
  )
}
