<script setup>
import { ref, onMounted, computed } from 'vue';
import { configApi } from '@/api/configApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

const areas = ref([]);
onMounted(async () => { areas.value = (await configApi.areas.list()).data; });
const opcArea = computed(() => areas.value.map(a => ({ value: a.area_id, label: `${a.area_codigo} — ${a.area_nombre}` })));

const columnas = [
  { key: 'fuente_id', label: 'ID' },
  { key: 'fuente_codigo', label: 'Código' },
  { key: 'fuente_nombre', label: 'Nombre' },
  { key: 'fuente_area_id', label: 'Área', render: (it) => areas.value.find(a => a.area_id === it.fuente_area_id)?.area_codigo || '—' },
  { key: 'fuente_es_masiva', label: 'Masiva', render: (it) => it.fuente_es_masiva ? '✓' : '' },
  { key: 'fuente_orden', label: 'Orden' }
];

const campos = computed(() => [
  { key: 'fuente_area_id', label: 'Área', type: 'select', options: opcArea.value, required: true },
  { key: 'fuente_codigo',  label: 'Código', type: 'text', required: true, uppercase: true },
  { key: 'fuente_nombre',  label: 'Nombre', type: 'text', required: true },
  { key: 'fuente_es_masiva', label: 'Es una fuente masiva (lista CSV)', type: 'switch' },
  { key: 'fuente_orden', label: 'Orden', type: 'number' },
  { key: 'fuente_activa', label: 'Activa', type: 'switch' }
]);
</script>

<template>
  <CrudCatalogo
    titulo="Fuentes de Prospecto"
    :api-resource="configApi.fuentes"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="fuente_activa"
    fila-id-key="fuente_id"
  />
</template>
