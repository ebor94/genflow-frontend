<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import AppHeader from '@/components/layout/AppHeader.vue';
import BottomNav from '@/components/layout/BottomNav.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import BusquedaGlobalModal from '@/components/crm/BusquedaGlobalModal.vue';

const route = useRoute();
const auth = useAuthStore();

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
</script>

<template>
  <div class="min-h-screen flex flex-col bg-cream text-text1 font-sans">
    <AppHeader v-if="!hideShell && auth.isAuthenticated" @abrir-busqueda="showBusqueda = true" />
    <main class="flex-1 w-full">
      <RouterView />
    </main>
    <BottomNav v-if="!hideShell && auth.isAuthenticated" class="md:hidden" />
    <ToastContainer />
    <BusquedaGlobalModal :open="showBusqueda" @close="showBusqueda = false" />
  </div>
</template>
