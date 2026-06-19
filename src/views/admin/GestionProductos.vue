<script setup>
import { ref, onMounted, computed } from 'vue';
import { configApi } from '@/api/configApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

const areas = ref([]);
onMounted(async () => { areas.value = (await configApi.areas.list()).data; });

const opcionesArea = computed(() => areas.value.map(a => ({ value: a.area_id, label: `${a.area_codigo} — ${a.area_nombre}` })));

const columnas = [
  { key: 'prod_id', label: 'ID' },
  { key: 'prod_codigo', label: 'Código' },
  { key: 'prod_nombre', label: 'Nombre' },
  { key: 'prod_area_id', label: 'Área', render: (it) => areas.value.find(a => a.area_id === it.prod_area_id)?.area_codigo || '—' },
  { key: 'prod_categoria', label: 'Categoría' },
  { key: 'prod_precio_base', label: 'Precio' },
  { key: 'prod_orden_display', label: 'Orden' }
];

const campos = computed(() => [
  { key: 'prod_area_id',     label: 'Área', type: 'select', options: opcionesArea.value, required: true },
  { key: 'prod_codigo',      label: 'Código', type: 'text', required: true, uppercase: true },
  { key: 'prod_nombre',      label: 'Nombre', type: 'text', required: true },
  { key: 'prod_descripcion', label: 'Descripción', type: 'textarea' },
  { key: 'prod_categoria',   label: 'Categoría', type: 'text' },
  { key: 'prod_precio_base', label: 'Precio base (COP)', type: 'number' },
  { key: 'prod_requiere_empresa', label: 'Requiere empresa (B2B)', type: 'switch' },
  { key: 'prod_orden_display', label: 'Orden de visualización', type: 'number' },
  { key: 'prod_activo',      label: 'Activo', type: 'switch' }
]);
</script>

<template>
  <CrudCatalogo
    titulo="Catálogo de Productos"
    :api-resource="configApi.productos"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="prod_activo"
    fila-id-key="prod_id"
  />
</template>
