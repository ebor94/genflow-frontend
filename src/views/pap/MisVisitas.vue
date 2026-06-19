<script setup>
/**
 * MisVisitas.vue — variante de MisClientes con filtros específicos PAP.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import { usuariosApi } from '@/api/usuariosApi';
import { fmtRelativo } from '@/utils/format';
import { AREAS, GRUPOS } from '@/utils/areasIds';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import FilterChips from '@/components/common/FilterChips.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import NuevaGestionPapModal from '@/components/crm/NuevaGestionPapModal.vue';
import ReasignarProspectoModal from '@/components/crm/ReasignarProspectoModal.vue';

const router = useRouter();
const auth = useAuthStore();
const store = useProspectosStore();
const { notify } = useApiError();
const { formato } = useTelefono();

const q = ref('');
const filtro = ref('');
const asesorFiltro = ref('');
const showGestion = ref(false);
const showReasignar = ref(false);
const prospectoActivo = ref(null);

function abrirReasignar(p) {
  prospectoActivo.value = p;
  showReasignar.value = true;
}

function abrirGestion(p) {
  // No permitir registrar nueva visita sobre un cliente ya afiliado
  if (p.estado?.estado_es_ganado) return;
  prospectoActivo.value = p;
  showGestion.value = true;
}
async function onGestionRegistrada() {
  showGestion.value = false;
  await cargar();
}
let debounce = null;

/**
 * Filtros PAP: en su mayoría son filtros por código de estado del prospecto,
 * no por fecha de próxima gestión (que rara vez se setea en PAP).
 * - `volver`     → estado VOLVER (sandra huertas en la demo)
 * - `afiliados`  → estado AFILIADO
 * - `interesados`→ estado INTERESADO
 * - `nuevos`     → sin estado de gestión definido (estado inicial VISITADO o null)
 */
const filtros = [
  { value: '',             label: 'Todos' },
  { value: 'volver',       label: '🔁 Volver' },
  { value: 'afiliados',    label: '✅ Afiliados' },
  { value: 'interesados',  label: '⭐ Interesados' },
  { value: 'nuevos',       label: '🆕 Nuevos' }
];

/** Mapeo del chip al payload que entiende el backend. */
function payloadFiltro(f) {
  switch (f) {
    case 'volver':      return { estado_codigo: 'VOLVER' };
    case 'afiliados':   return { estado_codigo: 'AFILIADO' };
    case 'interesados': return { estado_codigo: 'INTERESADO' };
    case 'nuevos':      return { filtro_rapido: 'sin_gestion' };
    default:            return {};
  }
}

const puedeVerEquipo = computed(() => auth.rolNivel <= 3 || auth.rolCodigo === 'GERENTE_GENERAL');
const asesoresPap = ref([]);
const opcAsesores = computed(() => [
  { value: '', label: '👥 Todo el equipo PAP' },
  ...asesoresPap.value.map(u => ({ value: String(u.usr_id), label: `${u.usr_nombre} ${u.usr_apellido || ''}`.trim() }))
]);

async function cargarAsesores() {
  if (!puedeVerEquipo.value) return;
  try {
    const r = await usuariosApi.list({ grupo_id: GRUPOS.PAP, activo: 1, limit: 100 });
    asesoresPap.value = (r.data?.items || r.data || []).filter(u => u.rol?.rol_codigo === 'ASESOR');
  } catch (e) { /* silencioso */ }
}

const tituloVista = computed(() => {
  if (!puedeVerEquipo.value) return 'Mis visitas';
  if (!asesorFiltro.value) return 'Visitas del equipo PAP';
  const a = asesoresPap.value.find(u => String(u.usr_id) === asesorFiltro.value);
  return a ? `Visitas de ${a.usr_nombre} ${a.usr_apellido || ''}` : 'Visitas';
});

async function cargar() {
  try {
    const params = {
      area_id:  AREAS.PREV_PAP,
      grupo_id: GRUPOS.PAP,
      q: q.value || undefined,
      page: 1, limit: 100,
      ...payloadFiltro(filtro.value)
    };
    if (asesorFiltro.value) params.asesor_id = asesorFiltro.value;
    await store.fetchList(params);
  } catch (e) { notify(e); }
}

onMounted(async () => { await cargarAsesores(); await cargar(); });
watch([filtro, asesorFiltro], cargar);
watch(q, () => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(cargar, 300);
});
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <h1 class="font-serif text-3xl text-brown-deep mb-4">{{ tituloVista }}</h1>

    <div class="space-y-3 mb-4">
      <BaseSelect v-if="puedeVerEquipo"
                  v-model="asesorFiltro"
                  :options="opcAsesores"
                  label="Asesor" />
      <BaseInput v-model="q" placeholder="🔎 Buscar por nombre, teléfono..." />
      <FilterChips v-model="filtro" :options="filtros" />
    </div>

    <div v-if="puedeVerEquipo" class="text-xs text-text3 mb-2">
      Mostrando {{ store.items.length }} visitas · scope: {{ asesorFiltro ? 'un asesor' : 'todo el equipo PAP' }}
    </div>

    <div v-if="store.loading" class="text-center py-12 text-text3">Cargando...</div>
    <EmptyState v-else-if="!store.items.length" titulo="Sin visitas" mensaje="Registra una visita desde el panel." icono="🚶" />

    <ul v-else class="sv-card divide-y divide-text3/10">
      <li v-for="p in store.items" :key="p.prosp_id"
          class="px-4 py-3 flex items-center gap-3 hover:bg-cream/40 cursor-pointer transition-colors"
          @click="abrirGestion(p)">
        <div class="w-10 h-10 rounded-full bg-area-pap/15 text-area-pap font-bold flex items-center justify-center text-sm shrink-0">
          {{ (p.persona?.persona_nombre || '?').charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-text1 truncate">
            {{ p.persona?.persona_nombre }} {{ p.persona?.persona_apellido || '' }}
          </div>
          <div class="text-xs text-text3 flex gap-2 items-center mt-0.5 flex-wrap">
            <a :href="`tel:${p.persona?.persona_telefono_principal}`"
               @click.stop class="hover:text-area-emp underline-offset-2 hover:underline">
              {{ formato(p.persona?.persona_telefono_principal) }}
            </a>
            <span v-if="p.prosp_zona_pap">· 📍 {{ p.prosp_zona_pap }}</span>
            <StatusPill v-if="p.estado" :label="p.estado.estado_nombre" :color-hex="p.estado.estado_color_hex || '#2A6E47'" />
          </div>
          <div v-if="p.prosp_prox_gestion_fecha" class="text-[10px] text-warning font-semibold mt-1">
            🔁 Volver: {{ fmtRelativo(p.prosp_prox_gestion_fecha) }}
          </div>
        </div>
        <!-- Si el prospecto ya está afiliado (estado final-ganado), no se muestra "+ Visitar" -->
        <button v-if="!p.estado?.estado_es_ganado"
                type="button"
                class="shrink-0 px-3 py-2 rounded-sv bg-area-pap text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                @click.stop="abrirGestion(p)"
                title="Registrar nueva visita">
          + Visitar
        </button>
        <span v-else
              class="shrink-0 px-3 py-2 rounded-sv bg-sage/15 text-sage text-xs font-semibold"
              title="Cliente ya afiliado">
          ✓ Cerrado
        </span>
        <button v-if="auth.puedeReasignar"
                type="button"
                class="shrink-0 px-2 py-2 rounded-sv border border-text3/30 text-text2 text-xs hover:bg-cream"
                @click.stop="abrirReasignar(p)"
                title="Reasignar a otro asesor">
          🔄
        </button>
      </li>
    </ul>

    <NuevaGestionPapModal :open="showGestion" :prospecto="prospectoActivo"
                          @close="showGestion = false"
                          @registrada="onGestionRegistrada" />
    <ReasignarProspectoModal :open="showReasignar" :prospecto="prospectoActivo"
                              @close="showReasignar = false"
                              @reasignado="cargar" />
  </div>
</template>
