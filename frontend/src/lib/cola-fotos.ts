/**
 * Fila para cargar las fotos del banco de a pocas, y en el orden en que salen
 * las tarjetas.
 *
 * Antes cada tarjeta pedía su foto en cuanto se dibujaba, así que una página
 * del banco disparaba una veintena de descargas simultáneas. El servidor
 * atiende esas peticiones con un puñado de conexiones a la base, de modo que
 * la mayoría quedaba esperando turno de todas formas — pero peleando, no en
 * fila: se veían unas fotos sí y otras no, y no siempre las mismas.
 *
 * Con la fila el resultado es el mismo trabajo repartido de otra manera. Las
 * fotos aparecen de arriba abajo, que es como uno espera leerlas, y ninguna
 * depende de haberle ganado a las demás.
 *
 * No es de a una estricta: tres a la vez aprovechan la espera de la red sin
 * llegar a atropellarse. De a una, veinte tarjetas se sentirían lentas.
 */
const MAX_A_LA_VEZ = 3

interface Pendiente {
  ejecutar: () => Promise<unknown>
  /** Si la tarjeta ya se fue de pantalla, su turno se salta sin gastarlo. */
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

/** Encola una descarga. Se respeta el orden en que se encolaron. */
export function encolarFoto(ejecutar: () => Promise<unknown>, cancelada: () => boolean): void {
  fila.push({ ejecutar, cancelada })
  siguiente()
}
