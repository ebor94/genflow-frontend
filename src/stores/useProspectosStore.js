/**
 * useProspectosStore — listado, panel del día, prospecto activo, paginación.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { prospectosApi } from '@/api/prospectosApi';

export const useProspectosStore = defineStore('svProspectos', () => {
  const items = ref([]);
  const total = ref(0);
  const paginacion = ref({ page: 1, limit: 20 });
  const panelDia = ref({ urgentes: [], hoy: [], nuevos: [], completados_hoy: [], fecha: null });
  const agendaMes = ref([]);
  const activo = ref(null);
  const loading = ref(false);

  async function fetchList(filtros = {}) {
    loading.value = true;
    try {
      const r = await prospectosApi.list(filtros);
      items.value = r.data.items;
      total.value = r.data.total;
      paginacion.value = { page: r.data.page, limit: r.data.limit };
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchPanelDia(params = {}) {
    loading.value = true;
    try {
      const r = await prospectosApi.panelDia(params);
      panelDia.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchAgendaMes(anio, mes) {
    const r = await prospectosApi.agendaMes(anio, mes);
    agendaMes.value = r.data;
    return r.data;
  }

  async function fetchOne(id) {
    loading.value = true;
    try {
      const r = await prospectosApi.get(id);
      activo.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  async function crear(data) {
    const r = await prospectosApi.create(data);
    return r.data;
  }

  async function actualizar(id, data) {
    const r = await prospectosApi.update(id, data);
    if (activo.value && activo.value.prosp_id === id) activo.value = r.data;
    return r.data;
  }

  async function reasignar(id, nuevoAsesorId) {
    const r = await prospectosApi.reasignar(id, nuevoAsesorId);
    return r.data;
  }

  function reset() {
    items.value = []; total.value = 0; activo.value = null;
    panelDia.value = { urgentes: [], hoy: [], nuevos: [], completados_hoy: [], fecha: null };
  }

  return { items, total, paginacion, panelDia, agendaMes, activo, loading,
           fetchList, fetchPanelDia, fetchAgendaMes, fetchOne, crear, actualizar, reasignar, reset };
});
