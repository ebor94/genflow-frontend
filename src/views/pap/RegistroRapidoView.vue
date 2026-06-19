<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import RegistroRapidoModal from '@/components/crm/RegistroRapidoModal.vue';

const router = useRouter();
const open = ref(true);

function onClose() { open.value = false; router.push({ name: 'pap-panel' }); }
function onRegistrada() { /* el modal hace reset y queda abierto en modo "guardar y siguiente" */ }
</script>

<template>
  <RegistroRapidoModal :open="open" @close="onClose" @registrada="onRegistrada" />
</template>
