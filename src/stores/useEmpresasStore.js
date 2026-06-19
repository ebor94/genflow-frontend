import { defineStore } from 'pinia';
import { ref } from 'vue';
import { empresasApi } from '@/api/empresasApi';

export const useEmpresasStore = defineStore('svEmpresas', () => {
  const items = ref([]);
  const total = ref(0);
  const activa = ref(null);
  const loading = ref(false);

  async function fetchList(filtros = {}) {
    loading.value = true;
    try {
      const r = await empresasApi.list(filtros);
      items.value = r.data.items;
      total.value = r.data.total;
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchOne(id) {
    loading.value = true;
    try {
      const r = await empresasApi.get(id);
      activa.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  async function crear(data) {
    const r = await empresasApi.create(data);
    return r.data;
  }

  async function actualizar(id, data) {
    const r = await empresasApi.update(id, data);
    if (activa.value && activa.value.empresa_id === id) activa.value = { ...activa.value, ...r.data.dataValues || r.data };
    return r.data;
  }

  function reset() { items.value = []; total.value = 0; activa.value = null; }

  return { items, total, activa, loading, fetchList, fetchOne, crear, actualizar, reset };
});
