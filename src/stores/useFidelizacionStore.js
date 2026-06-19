import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fidelizacionApi } from '@/api/fidelizacionApi';

export const useFidelizacionStore = defineStore('svFidelizacion', () => {
  // Lista de empresas con fidelización (header de la sección Empresas)
  const empresasConFideliz = ref([]);
  // Historial por empresa (Map empresaId -> { envios, stats })
  const historialPorEmpresa = ref(new Map());
  // Contactos por empresa (Map empresaId -> contactos[])
  const contactosPorEmpresa = ref(new Map());
  // Próximos cumpleaños (con ventana)
  const proximos      = ref([]);
  const ventanaDias   = ref(3);
  // Calendario de mes (Map 'YYYY-MM' -> eventos[])
  const calendarios   = ref(new Map());
  // Envíos por persona (Map personaId -> envios[])
  const enviosPorPersona = ref(new Map());
  // Contacto activo
  const contactoActivo = ref(null);
  // Métricas
  const metricas       = ref(null);

  const loading = ref(false);

  // Lista global de TODOS los contactos
  const todosContactos = ref([]);
  async function fetchTodosContactos(q = null) {
    loading.value = true;
    try {
      const r = await fidelizacionApi.listTodosContactos(q);
      todosContactos.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchEmpresasConFideliz() {
    loading.value = true;
    try {
      const r = await fidelizacionApi.listEmpresasConFideliz();
      empresasConFideliz.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchHistorialEmpresa(empresaId) {
    loading.value = true;
    try {
      const r = await fidelizacionApi.historialEmpresa(empresaId);
      historialPorEmpresa.value.set(empresaId, r.data);
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchContactosEmpresa(empresaId) {
    loading.value = true;
    try {
      const r = await fidelizacionApi.listContactosEmpresa(empresaId);
      contactosPorEmpresa.value.set(empresaId, r.data);
      return r.data;
    } finally { loading.value = false; }
  }

  async function crearContacto(empresaId, data) {
    const r = await fidelizacionApi.crearContacto(empresaId, data);
    // invalidar cache
    contactosPorEmpresa.value.delete(empresaId);
    return r.data;
  }

  async function actualizarContacto(cfId, data) {
    const r = await fidelizacionApi.actualizarContacto(cfId, data);
    // invalidar cache (cualquier empresa)
    contactosPorEmpresa.value.clear();
    return r.data;
  }

  async function eliminarContacto(cfId) {
    await fidelizacionApi.eliminarContacto(cfId);
    contactosPorEmpresa.value.clear();
  }

  async function fetchContacto(cfId) {
    loading.value = true;
    try {
      const r = await fidelizacionApi.getContacto(cfId);
      contactoActivo.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  async function agregarFecha(cfId, data) {
    const r = await fidelizacionApi.agregarFecha(cfId, data);
    contactosPorEmpresa.value.clear();
    if (contactoActivo.value?.cf_id === cfId) await fetchContacto(cfId);
    return r.data;
  }

  async function eliminarFecha(feId) {
    await fidelizacionApi.eliminarFecha(feId);
    contactosPorEmpresa.value.clear();
    if (contactoActivo.value) await fetchContacto(contactoActivo.value.cf_id);
  }

  async function fetchProximos(dias = ventanaDias.value) {
    loading.value = true;
    try {
      ventanaDias.value = dias;
      const r = await fidelizacionApi.proximosCumples(dias);
      proximos.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchCalendario(anio, mes) {
    loading.value = true;
    try {
      const r = await fidelizacionApi.calendario(anio, mes);
      const key = `${anio}-${String(mes).padStart(2, '0')}`;
      calendarios.value.set(key, r.data);
      return r.data;
    } finally { loading.value = false; }
  }

  async function fetchEnviosPersona(personaId) {
    loading.value = true;
    try {
      const r = await fidelizacionApi.listEnvios(personaId);
      enviosPorPersona.value.set(personaId, r.data);
      return r.data;
    } finally { loading.value = false; }
  }

  async function registrarEnvio(payload) {
    const r = await fidelizacionApi.registrarEnvio(payload);
    // invalidar caches
    enviosPorPersona.value.delete(payload.persona_id);
    proximos.value = proximos.value.filter(
      e => !(e.persona_id === payload.persona_id
             && e.tipo === payload.evento_tipo
             && e.evento_anio === payload.evento_anio)
    );
    return r.data;
  }

  async function actualizarEnvio(envId, payload) {
    const r = await fidelizacionApi.actualizarEnvio(envId, payload);
    return r.data;
  }

  async function subirEvidencia(envId, file) {
    const r = await fidelizacionApi.subirEvidencia(envId, file);
    return r.data;
  }

  async function fetchMetricas(params = {}) {
    loading.value = true;
    try {
      const r = await fidelizacionApi.metricas(params);
      metricas.value = r.data;
      return r.data;
    } finally { loading.value = false; }
  }

  function reset() {
    contactosPorEmpresa.value = new Map();
    proximos.value = [];
    calendarios.value = new Map();
    enviosPorPersona.value = new Map();
    contactoActivo.value = null;
    metricas.value = null;
    empresasConFideliz.value = [];
    historialPorEmpresa.value = new Map();
  }

  return {
    empresasConFideliz, historialPorEmpresa, todosContactos,
    contactosPorEmpresa, proximos, ventanaDias, calendarios, enviosPorPersona,
    contactoActivo, metricas, loading,
    fetchTodosContactos,
    fetchEmpresasConFideliz, fetchHistorialEmpresa,
    fetchContactosEmpresa, crearContacto, actualizarContacto, eliminarContacto,
    fetchContacto, agregarFecha, eliminarFecha,
    fetchProximos, fetchCalendario,
    fetchEnviosPersona, registrarEnvio, actualizarEnvio, subirEvidencia,
    fetchMetricas, reset
  };
});
