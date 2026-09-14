/**
 * Módulo Afiliación — re-exporta el store de toasts del CRM.
 * Misma API (success/error/warning/info/removeToast) y un único ToastContainer
 * montado en el shell del CRM, evitando un store 'toast' duplicado en Pinia.
 */
export { useToastStore } from '@/stores/useToastStore'
