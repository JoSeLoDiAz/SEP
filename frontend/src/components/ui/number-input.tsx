'use client'

import { useState, useCallback } from 'react'

function fmt(n: number) {
  if (!n && n !== 0) return ''
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}

function parse(s: string): number {
  return Number(s.replace(/\./g, '').replace(/,/g, '')) || 0
}

interface NumberInputProps {
  value: number
  onChange: (val: number) => void
  className?: string
  min?: number
  disabled?: boolean
  placeholder?: string
}

export function NumberInput({ value, onChange, className, min, disabled, placeholder }: NumberInputProps) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')

  const handleFocus = useCallback(() => {
    setRaw(value === 0 ? '' : String(value))
    setFocused(true)
  }, [value])

  const handleBlur = useCallback(() => {
    setFocused(false)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^\d]/g, '')
    setRaw(v)
    const n = Number(v) || 0
    onChange(min !== undefined ? Math.max(min, n) : n)
  }, [onChange, min])

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      disabled={disabled}
      placeholder={placeholder}
      value={focused ? raw : (value ? fmt(value) : '')}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  )
}
