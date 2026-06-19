<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';
import { configApi } from '@/api/configApi';
import { useApiError } from '@/composables/useApiError';
import AreaBadge from '@/components/common/AreaBadge.vue';

const router = useRouter();
const auth   = useAuthStore();
const config = useConfigStore();
const { notify } = useApiError();

const areas = ref([]);
const loading = ref(true);

const areasVisibles = computed(() => {
  if (auth.esSuperAdmin) return areas.value;
  // Multi-área: muestra las que el usuario tiene acceso (principal + extras)
  const ids = new Set(auth.areasAccesibles.map(a => a.area_id));
  return areas.value.filter(a => ids.has(a.area_id));
});

onMounted(async () => {
  try {
    const r = await configApi.areas.list();
    areas.value = r.data;
  } catch (e) {
    notify(e);
  } finally {
    loading.value = false;
  }
});

const RUTAS_AREA = {
  'PRENEC':   { name: 'prenec-panel' },     // Fase 1 funcional
  'PREV-EMP': { name: 'emp-panel' },        // Fase 2 funcional
  'PREV-PAP': { name: 'pap-panel' },        // Fase 3 funcional
  'SVC':      { name: 'svc-panel' }         // Fase 4 funcional (call center)
};

async function elegir(area) {
  auth.setAreaActiva(area.area_id);
  try { await config.loadBootstrap(area.area_id); } catch (e) { notify(e); }
  router.push(RUTAS_AREA[area.area_codigo] || { name: 'mi-perfil' });
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <header class="mb-8">
      <h1 class="font-serif text-3xl text-brown-deep">Bienvenido/a, {{ auth.usuario?.usr_nombre }}</h1>
      <p class="text-text2 mt-1">Selecciona el área en la que vas a trabajar.</p>
    </header>

    <div v-if="loading" class="text-text3">Cargando áreas...</div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <button
        v-for="area in areasVisibles" :key="area.area_id"
        @click="elegir(area)"
        class="sv-card p-6 text-left hover:shadow-sv-pop transition-shadow group"
      >
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-sv flex items-center justify-center text-3xl"
               :style="`background-color: ${area.area_color_hex}22; color: ${area.area_color_hex}`">
            {{ area.area_icono || '📁' }}
          </div>
          <div class="flex-1">
            <h2 class="font-serif text-xl text-brown-deep group-hover:text-gold transition-colors">{{ area.area_nombre }}</h2>
            <p class="text-sm text-text3 mt-1">{{ area.area_descripcion }}</p>
            <div class="mt-3">
              <AreaBadge :codigo="area.area_codigo" :nombre="area.area_codigo" :color-hex="area.area_color_hex" size="sm" />
            </div>
          </div>
        </div>
      </button>
    </div>

    <section v-if="auth.esSuperAdmin || auth.esAdminArea" class="mt-12">
      <h3 class="font-serif text-xl text-brown-deep mb-4">Acceso rápido</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <RouterLink :to="{ name: 'admin-areas' }"     class="sv-card p-4 text-center hover:shadow-sv-pop transition-shadow">⚙️ Parametrización</RouterLink>
        <RouterLink :to="{ name: 'admin-usuarios' }" class="sv-card p-4 text-center hover:shadow-sv-pop transition-shadow">👥 Usuarios</RouterLink>
        <RouterLink :to="{ name: 'admin-productos' }" class="sv-card p-4 text-center hover:shadow-sv-pop transition-shadow">📦 Productos</RouterLink>
        <RouterLink :to="{ name: 'admin-pipeline' }"  class="sv-card p-4 text-center hover:shadow-sv-pop transition-shadow">🔄 Pipelines</RouterLink>
      </div>
    </section>
  </div>
</template>
