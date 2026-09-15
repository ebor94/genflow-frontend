<script setup>
import { computed, onMounted, onUnmounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import BottomNav from '@/components/layout/BottomNav.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import BusquedaGlobalModal from '@/components/crm/BusquedaGlobalModal.vue';
import ModalInicioJornadaObligatorio from '@/components/tracking/ModalInicioJornadaObligatorio.vue';

const route = useRoute();
const auth = useAuthStore();
const jornObl = useJornadaObligatoriaStore();

const hideShell = computed(() => route.meta.publica || route.name === 'login');
const showBusqueda = ref(false);

function onKeydown(e) {
  // Cmd+K / Ctrl+K → buscador global
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (auth.isAuthenticated) showBusqueda.value = true;
  }
  if (e.key === 'Escape') showBusqueda.value = false;
}

onMounted(() => {
  auth.restore();
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

// SP-4: chequeo de jornada obligatoria al autenticarse / al volver a foreground
function onVisibilityChange() {
  if (document.visibilityState === 'visible' && auth.isAuthenticated) {
    jornObl.chequear({ force: true });
  }
}

watch(() => auth.isAuthenticated, (v) => {
  if (v) jornObl.chequear();
  else   jornObl.reset();
}, { immediate: true });

onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange));
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange));
</script>

<template>
  <div class="min-h-screen flex bg-cream text-text1 font-sans">
    <AppSidebar
      v-if="!hideShell && auth.isAuthenticated"
      :open-busqueda="() => showBusqueda = true"
    />
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader
        v-if="!hideShell && auth.isAuthenticated"
        class="lg:hidden"
        @abrir-busqueda="showBusqueda = true"
      />
      <main class="flex-1 w-full">
        <RouterView />
      </main>
      <BottomNav v-if="!hideShell && auth.isAuthenticated" class="lg:hidden" />
    </div>
    <ToastContainer />
    <BusquedaGlobalModal :open="showBusqueda" @close="showBusqueda = false" />
    <!-- SP-4: bloqueo obligatorio de inicio de jornada (nunca en rutas públicas) -->
    <ModalInicioJornadaObligatorio v-if="jornObl.debeBloquear && !hideShell" />
  </div>
</template>
