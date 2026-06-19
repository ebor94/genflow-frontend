/**
 * useConfigStore — caché del bootstrap (catálogos sv_cfg_*) por área.
 * Se llama tras login y al cambiar de área activa.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configApi } from '@/api/configApi';
import { useAuthStore } from './useAuthStore';

export const useConfigStore = defineStore('svConfig', () => {
  const cache   = ref(new Map()); // areaId → bootstrap payload
  const loading = ref(false);
  const error   = ref(null);

  const auth = useAuthStore();

  const actual = computed(() => {
    const id = auth.areaActivaId;
    return id ? cache.value.get(id) : null;
  });

  async function loadBootstrap(areaId) {
    if (!areaId) return null;
    if (cache.value.has(areaId)) return cache.value.get(areaId);
    loading.value = true;
    error.value   = null;
    try {
      const r = await configApi.bootstrap(areaId);
      const next = new Map(cache.value);
      next.set(areaId, r.data);
      cache.value = next;
      return r.data;
    } catch (e) {
      error.value = e?.response?.data?.message || e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function invalidate(areaId = null) {
    if (areaId === null) {
      cache.value = new Map();
    } else {
      const next = new Map(cache.value);
      next.delete(areaId);
      cache.value = next;
    }
  }

  function clear() { cache.value = new Map(); }

  return { cache, actual, loading, error, loadBootstrap, invalidate, clear };
});
