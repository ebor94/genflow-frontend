<script setup>
import { ref, onMounted, computed } from 'vue';
import { configApi } from '@/api/configApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

const areas = ref([]);
onMounted(async () => {
  const r = await configApi.areas.list();
  areas.value = r.data;
});

const opcionesArea = computed(() => areas.value.map(a => ({ value: a.area_id, label: `${a.area_codigo} — ${a.area_nombre}` })));

const columnas = [
  { key: 'grupo_id', label: 'ID' },
  { key: 'grupo_codigo', label: 'Código' },
  { key: 'grupo_nombre', label: 'Nombre' },
  { key: 'grupo_area_id', label: 'Área', render: (it) => {
    const a = areas.value.find(x => x.area_id === it.grupo_area_id);
    return a ? a.area_codigo : '—';
  }},
  { key: 'grupo_tipo_venta', label: 'Tipo venta' },
  { key: 'grupo_meta_default', label: 'Meta default' }
];

const campos = computed(() => [
  { key: 'grupo_area_id', label: 'Área', type: 'select', options: opcionesArea.value, required: true },
  { key: 'grupo_codigo',  label: 'Código', type: 'text', required: true, uppercase: true },
  { key: 'grupo_nombre',  label: 'Nombre', type: 'text', required: true },
  { key: 'grupo_tipo_venta', label: 'Tipo de venta', type: 'select', options: [
    { value: 'individual', label: 'Individual' },
    { value: 'b2b',        label: 'B2B' },
    { value: 'masivo',     label: 'Masivo' },
    { value: 'postventa',  label: 'Postventa' }
  ]},
  { key: 'grupo_meta_default', label: 'Meta default mensual', type: 'number' },
  { key: 'grupo_activo', label: 'Activo', type: 'switch' }
]);
</script>

<template>
  <CrudCatalogo
    titulo="Grupos de Trabajo"
    :api-resource="configApi.grupos"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="grupo_activo"
    fila-id-key="grupo_id"
  />
</template>
