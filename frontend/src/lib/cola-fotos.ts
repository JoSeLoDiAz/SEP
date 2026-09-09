// fila de descarga de fotos: el backend atiende pocas peticiones a la vez
const MAX_A_LA_VEZ = 3

interface Pendiente {
  ejecutar: () => Promise<unknown>
  cancelada: () => boolean
}

const fila: Pendiente[] = []
let enCurso = 0

function siguiente(): void {
  while (enCurso < MAX_A_LA_VEZ && fila.length > 0) {
    const p = fila.shift()!
    if (p.cancelada()) continue
    enCurso++
    void p.ejecutar().finally(() => {
      enCurso--
      siguiente()
    })
  }
}

export function encolarFoto(ejecutar: () => Promise<unknown>, cancelada: () => boolean): void {
  fila.push({ ejecutar, cancelada })
  siguiente()
}
