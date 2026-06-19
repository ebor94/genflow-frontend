<script setup>
import { ref, onMounted, computed } from 'vue';
import { configApi } from '@/api/configApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

const grupos = ref([]);
onMounted(async () => { grupos.value = (await configApi.grupos.list()).data; });
const opcGrupo = computed(() => grupos.value.map(g => ({ value: g.grupo_id, label: `${g.grupo_codigo} — ${g.grupo_nombre}` })));

const columnas = [
  { key: 'estado_id', label: 'ID' },
  { key: 'estado_codigo', label: 'Código' },
  { key: 'estado_nombre', label: 'Nombre' },
  { key: 'estado_grupo_id', label: 'Grupo', render: (it) => grupos.value.find(g => g.grupo_id === it.estado_grupo_id)?.grupo_codigo || '—' },
  { key: 'estado_orden', label: 'Orden' },
  { key: 'estado_color_hex', label: 'Color' },
  { key: 'estado_es_final', label: 'Final', render: (it) => it.estado_es_final ? '✓' : '' },
  { key: 'estado_es_ganado', label: 'Ganado', render: (it) => it.estado_es_ganado ? '✓' : '' }
];

const campos = computed(() => [
  { key: 'estado_grupo_id', label: 'Grupo', type: 'select', options: opcGrupo.value, required: true },
  { key: 'estado_codigo', label: 'Código', type: 'text', required: true, uppercase: true },
  { key: 'estado_nombre', label: 'Nombre', type: 'text', required: true },
  { key: 'estado_color_hex', label: 'Color', type: 'color' },
  { key: 'estado_orden', label: 'Orden en pipeline', type: 'number' },
  { key: 'estado_es_final', label: 'Estado final (no se puede mover desde aquí)', type: 'switch' },
  { key: 'estado_es_ganado', label: 'Es un cierre exitoso (ganado)', type: 'switch' },
  { key: 'estado_requiere_fecha', label: 'Requiere agendar próxima gestión', type: 'switch' },
  { key: 'estado_activo', label: 'Activo', type: 'switch' }
]);
</script>

<template>
  <CrudCatalogo
    titulo="Pipelines (Estados)"
    :api-resource="configApi.estados"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="estado_activo"
    fila-id-key="estado_id"
  />
</template>
