import axios from 'axios'
import { API_ROOT } from '@/api/axios'

// Cliente axios para endpoints públicos de afiliación (sin autenticación).
// Apunta a la RAÍZ del API (/api), no a /api/sv. No adjunta token ni redirige al login.
const publicApiClient = axios.create({
  baseURL: API_ROOT,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000
})

export default publicApiClient
