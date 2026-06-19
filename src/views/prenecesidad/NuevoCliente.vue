<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';

const router = useRouter();
const auth = useAuthStore();
const open = ref(true);

function onCreado(p) {
  open.value = false;
  router.push({ name: 'prenec-ficha', params: { id: p.prosp_id } });
}

function onClose() {
  open.value = false;
  router.back();
}
</script>

<template>
  <NuevoProspecto
    :open="open"
    :area-id="auth.usuario?.usr_area_id"
    :grupo-id="auth.usuario?.usr_grupo_id"
    @creado="onCreado"
    @close="onClose"
  />
</template>
