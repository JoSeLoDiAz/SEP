import axios from 'axios'

/**
 * Cliente Axios base para la API de SEP.
 * En producción, las peticiones a /api/* las redirige Nginx hacia el backend NestJS.
 * En desarrollo local (pnpm dev), apunta directamente al backend en el puerto 4000.
 */
const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000'),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})

// ── Interceptor de request: adjuntar JWT si existe ──
api.interceptors.request.use((config) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('sep_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Al subir un archivo hay que SOLTAR el Content-Type, no ponerlo.
  //
  // El `application/json` de arriba es un valor por defecto de la instancia y
  // se pega a todas las peticiones, incluidas las de FormData. Ahí el
  // navegador tiene que escribir él mismo el encabezado, porque solo él sabe
  // el `boundary` que separa las partes; con el nuestro encima, el backend
  // recibe un cuerpo que no puede partir y responde "adjunta el archivo",
  // aunque el archivo iba.
  //
  // Cada subida venía acordándose de sobrescribirlo a mano. Ponerlo aquí
  // quita esa trampa: la que se olvide ya no se rompe.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// ── Interceptor de response: sliding session + manejo de 401 ──
api.interceptors.response.use(
  (response) => {
    // Sliding session: el backend devuelve un JWT renovado en cada request
    // autenticada exitosa. Lo persistimos para que la próxima request lo use.
    const newToken = response.headers?.['x-new-token']
    if (newToken && typeof window !== 'undefined' && typeof newToken === 'string') {
      localStorage.setItem('sep_token', newToken)
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Endpoints públicos de /auth/* (login, registro, recuperar/restablecer
      // contraseña): no redirigir — la página de origen muestra el error
      // localmente. Redirigir aquí recargaba el login y mataba el banner.
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
