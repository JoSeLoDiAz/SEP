// Barra superior institucional GOV.CO — obligatoria en sistemas del Estado colombiano
// Azul oficial GOV.CO: #3366CC (el mismo de sena.edu.co)
export function GovBar() {
  return (
    <div className="w-full bg-[#3366CC] py-1.5 px-4 flex items-center justify-center">
      <div className="max-w-7xl w-full flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/govco.svg"
          alt="GOV.CO"
          className="h-5 w-auto object-contain"
        />
      </div>
    </div>
  )
}
