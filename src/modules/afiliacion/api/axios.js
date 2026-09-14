/**
 * Módulo Afiliación — cliente HTTP autenticado.
 * Reutiliza el cliente raíz del CRM (base /api, token sv_* + refresh transparente),
 * de modo que el módulo comparte la MISMA sesión que el resto de GenFlow.
 */
export { apiRoot as default } from '@/api/axios'
