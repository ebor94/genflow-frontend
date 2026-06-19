<script setup>
import { configApi } from '@/api/configApi';
import CrudCatalogo from '@/components/admin/CrudCatalogo.vue';

const columnas = [
  { key: 'area_id', label: 'ID' },
  { key: 'area_codigo', label: 'Código' },
  { key: 'area_nombre', label: 'Nombre' },
  { key: 'area_tipo_cliente', label: 'Tipo' },
  { key: 'area_color_hex', label: 'Color' },
  { key: 'area_icono', label: 'Icono' }
];

const campos = [
  { key: 'area_codigo',  label: 'Código',       type: 'text', required: true, uppercase: true, placeholder: 'PRENEC, PREV-EMP...' },
  { key: 'area_nombre',  label: 'Nombre',       type: 'text', required: true },
  { key: 'area_descripcion', label: 'Descripción', type: 'textarea' },
  { key: 'area_color_hex', label: 'Color (hex)', type: 'color' },
  { key: 'area_icono',   label: 'Icono (emoji)', type: 'text', placeholder: '🕊️' },
  { key: 'area_tipo_cliente', label: 'Tipo de cliente', type: 'select', options: [
    { value: 'individual', label: 'Individual' },
    { value: 'empresa',    label: 'Empresa' },
    { value: 'contrato',   label: 'Contrato (postventa)' }
  ]},
  { key: 'area_activa',  label: 'Activa', type: 'switch' }
];
</script>

<template>
  <CrudCatalogo
    titulo="Áreas de Negocio"
    :api-resource="configApi.areas"
    :columnas="columnas"
    :campos="campos"
    fila-activa-key="area_activa"
    fila-id-key="area_id"
  />
</template>
