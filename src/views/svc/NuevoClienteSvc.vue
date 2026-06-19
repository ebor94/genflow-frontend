<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';
import { AREAS, GRUPOS } from '@/utils/areasIds';

const router = useRouter();
const open = ref(true);

function onCreado(p) {
  open.value = false;
  router.push({ name: 'svc-ficha', params: { id: p.prosp_id } });
}
function onClose() { open.value = false; router.back(); }
</script>

<template>
  <!-- SVC = call center recuperación; todo nuevo prospecto entra como 'recuperacion' -->
  <NuevoProspecto
    :open="open"
    :area-id="AREAS.SVC"
    :grupo-id="GRUPOS.SVC_AGENTES"
    subproceso="recuperacion"
    @creado="onCreado"
    @close="onClose"
  />
</template>
