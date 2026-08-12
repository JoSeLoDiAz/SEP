import axios from 'axios'

// en producción Nginx redirige /api/* al backend NestJS
const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000'),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})

api.interceptors.request.use((config) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('sep_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // con FormData el Content-Type lo pone el navegador: solo él sabe el boundary
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  // Math.max: axios ya fusionó el timeout de la instancia, asignar pisaría uno mayor
  const llevaArchivo = typeof FormData !== 'undefined' && config.data instanceof FormData
  const traeArchivo = config.responseType === 'blob'
  if (llevaArchivo || traeArchivo) {
    config.timeout = Math.max(config.timeout ?? 0, 10 * 60_000)
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    // sliding session: el backend devuelve un JWT renovado en cada request
    const newToken = response.headers?.['x-new-token']
    if (newToken && typeof window !== 'undefined' && typeof newToken === 'string') {
      localStorage.setItem('sep_token', newToken)
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // en /auth/* no redirigir: la propia página muestra el error
      const url: string = error.config?.url ?? ''
      const esEndpointAuth = /\/auth\//.test(url)
      if (!esEndpointAuth && typeof window !== 'undefined') {
        localStorage.removeItem('sep_token')
        localStorage.removeItem('sep_usuario')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
