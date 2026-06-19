<script setup>
import { ref, onMounted, computed } from 'vue';
import { configApi } from '@/api/configApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

const grupos = ref([]);
onMounted(async () => { grupos.value = (await configApi.grupos.list()).data; });
const opcGrupo = computed(() => grupos.value.map(g => ({ value: g.grupo_id, label: `${g.grupo_codigo} — ${g.grupo_nombre}` })));

const columnas = [
  { key: 'resultado_id', label: 'ID' },
  { key: 'resultado_codigo', label: 'Código' },
  { key: 'resultado_nombre', label: 'Nombre' },
  { key: 'resultado_icono', label: 'Icono' },
  { key: 'resultado_grupo_id', label: 'Grupo', render: (it) => grupos.value.find(g => g.grupo_id === it.resultado_grupo_id)?.grupo_codigo || '—' },
  { key: 'resultado_es_positivo', label: 'Positivo', render: (it) => it.resultado_es_positivo ? '✓' : '✗' },
  { key: 'resultado_orden', label: 'Orden' }
];

const campos = computed(() => [
  { key: 'resultado_grupo_id', label: 'Grupo', type: 'select', options: opcGrupo.value, required: true },
  { key: 'resultado_codigo',   label: 'Código', type: 'text', required: true, uppercase: true },
  { key: 'resultado_nombre',   label: 'Nombre', type: 'text', required: true },
  { key: 'resultado_icono',    label: 'Icono (emoji)', type: 'text' },
  { key: 'resultado_es_positivo', label: 'Es un resultado positivo (interesado, cierre, etc)', type: 'switch' },
  { key: 'resultado_requiere_fecha', label: 'Requiere agendar próxima gestión', type: 'switch' },
  { key: 'resultado_orden',    label: 'Orden', type: 'number' },
  { key: 'resultado_activo',   label: 'Activo', type: 'switch' }
]);
</script>

<template>
  <CrudCatalogo
    titulo="Resultados de Gestión"
    :api-resource="configApi.resultados"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="resultado_activo"
    fila-id-key="resultado_id"
  />
</template>
