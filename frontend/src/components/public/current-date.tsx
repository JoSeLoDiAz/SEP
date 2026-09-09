'use client'

import { useEffect, useState } from 'react'

export function CurrentDate() {
  const [fecha, setFecha] = useState('')

  useEffect(() => {
    setFecha(
      new Date().toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    )
  }, [])

  return <span className="text-neutral-500 text-xs">{fecha}</span>
}
