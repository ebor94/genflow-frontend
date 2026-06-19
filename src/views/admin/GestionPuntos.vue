<script setup>
import { configApi } from '@/api/configApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

const columnas = [
  { key: 'punto_id', label: 'ID' },
  { key: 'punto_codigo', label: 'Código' },
  { key: 'punto_nombre', label: 'Nombre' },
  { key: 'punto_direccion', label: 'Dirección' },
  { key: 'punto_ciudad', label: 'Ciudad' },
  { key: 'punto_telefono', label: 'Teléfono' }
];

const campos = [
  { key: 'punto_codigo',    label: 'Código', type: 'text', required: true, uppercase: true },
  { key: 'punto_nombre',    label: 'Nombre', type: 'text', required: true },
  { key: 'punto_direccion', label: 'Dirección', type: 'text' },
  { key: 'punto_ciudad',    label: 'Ciudad', type: 'text' },
  { key: 'punto_telefono',  label: 'Teléfono', type: 'text' },
  { key: 'punto_activo',    label: 'Activo', type: 'switch' }
];
</script>

<template>
  <CrudCatalogo
    titulo="Puntos de Atención"
    :api-resource="configApi.puntos"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="punto_activo"
    fila-id-key="punto_id"
  />
</template>
