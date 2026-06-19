<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import NuevaEmpresa from '@/components/crm/NuevaEmpresa.vue';

const router = useRouter();
const open = ref(true);

function onCreada(r) {
  open.value = false;
  router.push({ name: 'emp-ficha', params: { id: r.empresa_id } });
}

function onClose() {
  open.value = false;
  router.back();
}
</script>

<template>
  <NuevaEmpresa :open="open" @creada="onCreada" @close="onClose" />
</template>
