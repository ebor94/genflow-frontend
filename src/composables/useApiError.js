/**
 * useApiError — extrae mensajes uniformes desde error de axios.
 */
import { useToastStore } from '@/stores/useToastStore';

export function useApiError() {
  const toast = useToastStore();

  function extract(error) {
    const data = error?.response?.data;
    if (data?.message) return data.message;
    if (data?.errors?.length) return data.errors.map(e => e.message).join('; ');
    return error?.message || 'Error desconocido';
  }

  function notify(error) {
    toast.error(extract(error));
  }

  return { extract, notify };
}
