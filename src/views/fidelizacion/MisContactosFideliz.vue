<script setup>
/**
 * MisContactosFideliz.vue — lista searchable de TODOS los contactos de
 * fidelización (a través de todas las empresas con convenio).
 *
 * Permite registrar un envío ad-hoc directamente desde cada contacto
 * (caso: la gerencia llama y pide enviar un detalle a X).
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useApiError } from '@/composables/useApiError';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
dayjs.extend(relativeTime);
dayjs.locale('es');

import EmptyState from '@/components/common/EmptyState.vue';
import BaseInput  from '@/components/ui/BaseInput.vue';
import RegistrarEnvioModal from '@/components/fideliz/RegistrarEnvioModal.vue';

const router = useRouter();
const store  = useFidelizacionStore();
const { notify } = useApiError();

const q = ref('');
const showEnvio = ref(false);
const eventoActivo = ref(null);

const contactos = computed(() => {
  let list = store.todosContactos || [];
  if (q.value.trim()) {
    const t = q.value.toLowerCase();
    list = list.filter(c =>
      (c.persona?.persona_nombre || '').toLowerCase().includes(t)
      || (c.persona?.persona_apellido || '').toLowerCase().includes(t)
      || (c.empresa?.empresa_razon_social || '').toLowerCase().includes(t)
      || (c.cf_cargo || '').toLowerCase().includes(t)
    );
  }
  return list;
});

function fmtUltimo(fecha) {
  if (!fecha) return 'Sin envíos';
  return dayjs(fecha).fromNow();
}

/**
 * Construye un "evento ad-hoc" a partir de un contacto para que el agente
 * pueda registrar un envío sin esperar a una fecha especial específica.
 * El modal pedirá tipo + año.
 */
function registrarAdHoc(contacto) {
  eventoActivo.value = {
    persona_id: contacto.cf_persona_id,
    persona: contacto.persona,
    empresa: contacto.empresa,
    cargo:   contacto.cf_cargo,
    cf_id:   contacto.cf_id,
    // Datos ad-hoc — sin fecha_especial_id ni evento_anio aún (el modal los pedirá)
    tipo: 'otro',
    descripcion: 'Envío ad-hoc',
    fecha_evento: dayjs().format('YYYY-MM-DD'),
    evento_anio: dayjs().year(),
    fecha_especial_id: null,
    adHoc: true
  };
  showEnvio.value = true;
}

async function cargar() {
  try { await store.fetchTodosContactos(); } catch (e) { notify(e); }
}

onMounted(cargar);
// Recargar al cerrar el modal (para refrescar último_envío / envios_total)
watch(showEnvio, (v) => { if (!v) cargar(); });
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
      <h1 class="font-serif text-2xl text-brown-deep">👥 Mis contactos</h1>
      <p class="text-sm text-text2 mt-1">
        Todos los contactos registrados para fidelización. Puedes registrar un envío
        en cualquier momento (cumple, ocasión especial, solicitud de gerencia, etc.).
      </p>
    </header>

    <div class="sv-card p-4 mb-4">
      <BaseInput v-model="q" placeholder="Buscar por nombre, empresa o cargo..." />
    </div>

    <div v-if="store.loading" class="text-text3 text-center py-12">Cargando contactos...</div>
    <EmptyState v-else-if="!contactos.length"
                titulo="Sin contactos"
                descripcion="Aún no hay contactos de fidelización registrados. El asesor B2B los captura desde la ficha de empresa." />

    <article v-for="c in contactos" :key="c.cf_id"
             class="sv-card p-4 mb-3 flex items-center gap-3 hover:shadow-sv-pop transition-shadow">
      <div class="w-10 h-10 rounded-full bg-warning/15 text-warning font-bold flex items-center justify-center shrink-0">
        {{ (c.persona?.persona_nombre || '?').charAt(0).toUpperCase() }}
      </div>
      <div class="flex-1 min-w-0 cursor-pointer"
           @click="router.push({ name: 'fideliz-contacto', params: { cfId: c.cf_id } })">
        <div class="font-semibold text-text1 truncate">
          {{ c.persona?.persona_nombre }} {{ c.persona?.persona_apellido }}
          <span v-if="c.cf_es_titular" class="text-xs text-gold ml-2">⭐ Titular</span>
        </div>
        <div class="text-xs text-text2 truncate">
          {{ c.cf_cargo || '—' }} · {{ c.empresa?.empresa_razon_social }}
        </div>
        <div class="text-xs text-text3 mt-1 flex items-center gap-3">
          <span>📅 {{ c.persona?.fechasEspeciales?.length || 0 }} fechas</span>
          <span>📤 {{ c.envios_total }} envíos</span>
          <span>🕐 {{ fmtUltimo(c.ultimo_envio) }}</span>
        </div>
      </div>

      <button type="button"
              class="shrink-0 px-3 py-2 rounded-sv bg-gold text-white text-xs font-semibold hover:bg-gold-bright transition-colors flex items-center gap-1"
              @click.stop="registrarAdHoc(c)"
              title="Registrar envío ad-hoc">
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
        </svg>
        Registrar envío
      </button>
    </article>

    <RegistrarEnvioModal :open="showEnvio" :evento="eventoActivo"
                         @close="showEnvio = false"
                         @registrado="cargar" />
  </div>
</template>
