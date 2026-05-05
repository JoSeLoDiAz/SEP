export interface SepUsuario {
  email: string
  nombre: string
  perfilId: number
  usuarioPerfilId?: number
}

export function getSepUsuario(): SepUsuario | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('sep_usuario')
    if (!raw) return null
    return JSON.parse(raw) as SepUsuario
  } catch {
    return null
  }
}

export function getSepToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sep_token')
}

export function clearSepAuth() {
  localStorage.removeItem('sep_token')
  localStorage.removeItem('sep_usuario')
}

// perfilId 7 = empresa/proponente; el resto son roles internos
export function isEmpresa(perfilId: number) {
  return perfilId === 7
}
// perfilId 1 = Administrador SENA
export function isAdmin(perfilId: number) {
  return perfilId === 1
}
