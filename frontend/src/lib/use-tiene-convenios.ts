'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { getSepUsuario } from '@/lib/auth'

/** Hook compartido para detectar si la empresa logueada tiene al menos un
 *  convenio. Lo usan el sidebar y el topbar para cambiar la etiqueta del
 *  usuario de "Gremio / Empresa / Asociación" a "Conviniente".
 *
 *  Solo dispara la llamada cuando perfilId === 7 (perfil EMPRESA del legacy).
 *  Para otros perfiles devuelve `false` sin llamar al backend. */
export function useTieneConvenios(): { tieneConvenios: boolean; loading: boolean } {
  const [tieneConvenios, setTieneConvenios] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const usuario = getSepUsuario()
    if (usuario?.perfilId !== 7) {
      setLoading(false)
      return
    }
    let cancelled = false
    api.get<{ tieneConvenios: boolean; total: number }>('/convenios/mios/tiene')
      .then(r => { if (!cancelled) setTieneConvenios(!!r.data?.tieneConvenios) })
      .catch(() => { /* silencio: si falla, mantenemos el label por defecto */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { tieneConvenios, loading }
}
