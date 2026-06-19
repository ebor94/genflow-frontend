<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useApiError } from '@/composables/useApiError';

import CallScreen from '@/components/crm/CallScreen.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

const route  = useRoute();
const router = useRouter();
const store  = useProspectosStore();
const { notify } = useApiError();

const showCall = ref(false);
const showRegistrar = ref(false);
const duracionFinal = ref(0);
const notasFinales  = ref('');

onMounted(async () => {
  try {
    await store.fetchOne(parseInt(route.params.id));
    showCall.value = true;
  } catch (e) { notify(e); router.back(); }
});

function onTerminar({ duracion_seg, notas }) {
  duracionFinal.value = duracion_seg;
  notasFinales.value  = notas;
  showCall.value = false;
  showRegistrar.value = true;
}

function cerrar() {
  router.replace({ name: 'prenec-ficha', params: { id: route.params.id } });
}
</script>

<template>
  <div>
    <CallScreen :open="showCall" :prospecto="store.activo" @close="cerrar" @terminar="onTerminar" />
    <RegistrarGestion
      :open="showRegistrar"
      :prospecto="store.activo"
      @close="cerrar"
      @registrada="cerrar"
    />
  </div>
</template>
