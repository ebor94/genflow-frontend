<script setup>
/**
 * Admin → Tipos de documento de empresa
 * CRUD del catálogo sv_cfg_tipos_documento que alimenta el tab Documentos
 * en la ficha de empresa (Cámara de Comercio, RUT, Cédula, etc.).
 */
import { computed } from 'vue';
import { empresasApi } from '@/api/empresasApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

// Adapter del API al contrato de CrudCatalogo: { list, create, update, toggle }
const apiResource = {
  list:   async () => {
    const r = await empresasApi.listarTipos(true); // incluye inactivos
    return { data: Array.isArray(r) ? r : (r?.data || r) };
  },
  create: (data) => empresasApi.crearTipo(data),
  update: (id, data) => empresasApi.actualizarTipo(id, data),
  // El catálogo no tiene endpoint toggle separado: usamos update con activo invertido
  toggle: async (id) => {
    const items = await empresasApi.listarTipos(true);
    const data = Array.isArray(items) ? items : (items?.data || []);
    const t = data.find(x => x.tipo_id === id);
    if (t) await empresasApi.actualizarTipo(id, { tipo_activo: !t.tipo_activo });
  }
};

const columnas = [
  { key: 'tipo_id', label: 'ID' },
  { key: 'tipo_codigo', label: 'Código' },
  { key: 'tipo_nombre', label: 'Nombre' },
  { key: 'tipo_descripcion', label: 'Descripción' },
  { key: 'tipo_obligatorio', label: 'Obligatorio', render: (it) => it.tipo_obligatorio ? '✓' : '' },
  { key: 'tipo_orden', label: 'Orden' }
];

const campos = computed(() => [
  { key: 'tipo_codigo',      label: 'Código',      type: 'text', required: true, uppercase: true,
    hint: 'Identificador único (e.g. PAZ_Y_SALVO, CERTIFICACION_BANCARIA)' },
  { key: 'tipo_nombre',      label: 'Nombre',      type: 'text', required: true },
  { key: 'tipo_descripcion', label: 'Descripción', type: 'text' },
  { key: 'tipo_obligatorio', label: 'Obligatorio para toda empresa', type: 'switch' },
  { key: 'tipo_orden',       label: 'Orden de aparición', type: 'number' },
  { key: 'tipo_activo',      label: 'Activo', type: 'switch' }
]);
</script>

<template>
  <CrudCatalogo
    titulo="Tipos de Documento de Empresa"
    :api-resource="apiResource"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="tipo_activo"
    fila-id-key="tipo_id"
  />
</template>
