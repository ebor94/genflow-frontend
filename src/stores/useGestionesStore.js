/**
 * useGestionesStore — historial por prospecto con lazy load (lotes de 20).
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { gestionesApi } from '@/api/gestionesApi';

export const useGestionesStore = defineStore('svGestiones', () => {
  // Map<prospId, { items, page, total, hasMore, loading }>
  const historial = ref(new Map());
  const resumenDia = ref(null);

  function _set(prospId, data) {
    const next = new Map(historial.value);
    next.set(prospId, data);
    historial.value = next;
  }

  async function fetchHistorial(prospId, { reset = false, limit = 20 } = {}) {
    const current = historial.value.get(prospId);
    if (reset || !current) {
      _set(prospId, { items: [], page: 0, total: 0, hasMore: true, loading: true });
    }
    const c = historial.value.get(prospId);
    const nextPage = c.page + 1;
    const r = await gestionesApi.historial(prospId, { page: nextPage, limit });
    _set(prospId, {
      items:   reset ? r.data.items : [...c.items, ...r.data.items],
      page:    r.data.page,
      total:   r.data.total,
      hasMore: r.data.hasMore,
      loading: false
    });
    return historial.value.get(prospId);
  }

  async function registrar(payload) {
    const r = await gestionesApi.create(payload);
    // Limpiar historial cacheado del prospecto y recargar primera página
    if (payload.gest_prosp_id) {
      await fetchHistorial(payload.gest_prosp_id, { reset: true });
    }
    return r.data;
  }

  async function fetchResumenDia(asesorId = null, fecha = null) {
    const r = await gestionesApi.resumenDia({ asesor_id: asesorId, fecha });
    resumenDia.value = r.data;
    return r.data;
  }

  function clear() {
    historial.value = new Map();
    resumenDia.value = null;
  }

  return { historial, resumenDia, fetchHistorial, registrar, fetchResumenDia, clear };
});
