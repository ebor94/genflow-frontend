<script setup>
/**
 * PanelFideliz.vue — vista principal del agente de Fidelización.
 * Muestra los próximos cumples / fechas especiales con ventana configurable
 * y permite registrar un envío directamente desde cada tarjeta.
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';

import EmptyState from '@/components/common/EmptyState.vue';
import CumpleCard from '@/components/fideliz/CumpleCard.vue';
import RegistrarEnvioModal from '@/components/fideliz/RegistrarEnvioModal.vue';

const router = useRouter();
const store  = useFidelizacionStore();
const { notify } = useApiError();
const { linkTel } = useTelefono();

const ventana       = ref(3);
const showEnvio     = ref(false);
const eventoActivo  = ref(null);
const opcionesDias  = [1, 3, 7, 15, 30];

async function recargar() {
  try {
    await store.fetchProximos(ventana.value);
  } catch (e) { notify(e); }
}

function registrar(ev) {
  eventoActivo.value = ev;
  showEnvio.value = true;
}

function llamar(ev) {
  const tel = ev.persona?.persona_telefono_principal;
  if (tel) window.location.href = linkTel(tel);
}

onMounted(recargar);
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <!-- Header morado-suave -->
    <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="font-serif text-2xl text-brown-deep">💝 Fidelización Empresas</h1>
          <p class="text-sm text-text2 mt-1">Próximos cumpleaños y fechas especiales para gestionar.</p>
        </div>
        <div class="flex gap-3">
          <button class="text-sm text-text2 underline hover:text-text1"
                  @click="router.push({ name: 'fideliz-calendario' })">
            📅 Calendario
          </button>
          <button class="text-sm text-text2 underline hover:text-text1"
                  @click="router.push({ name: 'fideliz-empresas' })">
            🏢 Empresas con historial
          </button>
        </div>
      </div>

      <!-- Selector de ventana -->
      <div class="mt-4 flex items-center gap-2 flex-wrap">
        <span class="text-xs text-text3">Mostrar próximos:</span>
        <button v-for="d in opcionesDias" :key="d"
                @click="ventana = d; recargar()"
                class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                :class="ventana === d
                  ? 'bg-[#be185d] text-white'
                  : 'bg-cream border border-text3/30 text-text2 hover:bg-text3/10'">
          {{ d }} {{ d === 1 ? 'día' : 'días' }}
        </button>
      </div>
    </header>

    <!-- Lista -->
    <div v-if="store.loading" class="text-text3 text-center py-12">Cargando próximos cumpleaños...</div>
    <EmptyState v-else-if="!store.proximos.length"
                titulo="Sin eventos próximos"
                descripcion="No hay cumpleaños ni fechas especiales en la ventana seleccionada." />
    <div v-else class="space-y-3">
      <CumpleCard v-for="(ev, i) in store.proximos" :key="`${ev.persona_id}-${ev.tipo}-${ev.evento_anio}-${i}`"
                  :evento="ev"
                  @registrar="registrar"
                  @llamar="llamar" />
    </div>

    <RegistrarEnvioModal :open="showEnvio" :evento="eventoActivo"
                         @close="showEnvio = false"
                         @registrado="recargar" />
  </div>
</template>
