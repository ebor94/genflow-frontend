<script setup>
import { computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';
import AreaBadge from '@/components/common/AreaBadge.vue';

const props = defineProps({
  codigo: { type: String, required: true },
  titulo: { type: String, required: true },
  fase:   { type: String, default: 'Fase 1' },
  descripcion: { type: String, default: '' }
});

const auth = useAuthStore();
const config = useConfigStore();

const area = computed(() => auth.usuario?.area || null);
const bootstrap = computed(() => config.actual);

onMounted(async () => {
  if (auth.areaActivaId && !bootstrap.value) {
    try { await config.loadBootstrap(auth.areaActivaId); } catch {}
  }
});
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-12">
    <header class="text-center mb-8">
      <div v-if="area" class="flex justify-center mb-3">
        <AreaBadge :codigo="area.area_codigo" :nombre="area.area_nombre" :icono="area.area_icono" :color-hex="area.area_color_hex" size="lg" />
      </div>
      <h1 class="font-serif text-4xl text-brown-deep">{{ titulo }}</h1>
      <p v-if="descripcion" class="text-text2 mt-2">{{ descripcion }}</p>
    </header>

    <section class="sv-card p-8 text-center">
      <div class="text-6xl mb-4">🚧</div>
      <h2 class="font-serif text-2xl text-brown-deep">Módulo en construcción</h2>
      <p class="text-text2 mt-2 max-w-prose mx-auto">
        Esta área está disponible en <strong>{{ fase }}</strong>. La parametrización (productos, estados, fuentes) ya está cargada y se puede administrar desde
        <RouterLink :to="{ name: 'admin-areas' }" class="text-gold">Admin</RouterLink>.
      </p>

      <div v-if="bootstrap" class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div class="sv-card p-4 border border-text3/15">
          <div class="text-3xl font-serif text-gold">{{ bootstrap.productos?.length || 0 }}</div>
          <div class="text-sm text-text3 mt-1">Productos configurados</div>
        </div>
        <div class="sv-card p-4 border border-text3/15">
          <div class="text-3xl font-serif text-gold">{{ bootstrap.estados?.length || 0 }}</div>
          <div class="text-sm text-text3 mt-1">Estados de pipeline</div>
        </div>
        <div class="sv-card p-4 border border-text3/15">
          <div class="text-3xl font-serif text-gold">{{ bootstrap.fuentes?.length || 0 }}</div>
          <div class="text-sm text-text3 mt-1">Fuentes de prospecto</div>
        </div>
      </div>
    </section>
  </div>
</template>
