<script setup>
/**
 * NuevaGestionPapModal.vue — modal rápido para registrar una nueva gestión
 * sobre un prospecto PAP ya existente. Usa botones grandes táctiles para
 * el resultado y captura GPS en background.
 *
 * Mapeo automático resultado → nuevo estado del prospecto:
 *   AFILIADO_HOY  → AFILIADO
 *   INTERESADO    → INTERESADO
 *   VOLVER        → VOLVER (puede pedir fecha de retorno)
 *   NO_INTERESADO → NO_INTERES
 *   SIN_RESPUESTA → VISITADO
 */
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { useGeolocation } from '@/composables/useGeolocation';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open:      { type: Boolean, required: true },
  prospecto: { type: Object,  default: null }
});
const emit = defineEmits(['close', 'registrada']);

const config    = useConfigStore();
const gestiones = useGestionesStore();
const toast     = useToastStore();
const { notify } = useApiError();
const { coords, getCurrent, obteniendo: geoLoading } = useGeolocation();

const GRUPO_PAP = 3;
const MAPEO_RESULTADO_ESTADO = {
  AFILIADO_HOY:  'AFILIADO',
  INTERESADO:    'INTERESADO',
  VOLVER:        'VOLVER',
  NO_INTERESADO: 'NO_INTERES',
  SIN_RESPUESTA: 'VISITADO'
};

const ORDEN_BOTONES = ['AFILIADO_HOY', 'INTERESADO', 'VOLVER', 'NO_INTERESADO', 'SIN_RESPUESTA'];

const COLOR_RESULTADO = {
  AFILIADO_HOY:  'bg-sage hover:bg-sage/90 text-white',
  INTERESADO:    'bg-warning hover:bg-warning/90 text-white',
  VOLVER:        'bg-area-emp hover:bg-area-emp/90 text-white',
  NO_INTERESADO: 'bg-danger hover:bg-danger/90 text-white',
  SIN_RESPUESTA: 'bg-text3 hover:bg-text3/90 text-white'
};

const resultadoSel = ref(null);   // resultado_codigo seleccionado
const comentario   = ref('');
const proxFecha    = ref('');
const saving       = ref(false);

// Resultados PAP del configStore (catálogo cargado en bootstrap)
const resultadosPap = computed(() =>
  (config.actual?.resultados || []).filter(r => r.resultado_grupo_id === GRUPO_PAP && r.resultado_activo)
);
const estadosPap = computed(() =>
  (config.actual?.estados || []).filter(e => e.estado_grupo_id === GRUPO_PAP && e.estado_activo)
);

// Helpers para obtener el id por código (los catálogos vienen del bootstrap)
function resultadoIdPorCodigo(codigo) {
  return resultadosPap.value.find(r => r.resultado_codigo === codigo)?.resultado_id;
}
function estadoIdPorCodigo(codigo) {
  return estadosPap.value.find(e => e.estado_codigo === codigo)?.estado_id;
}

// Botones a renderizar (intersección entre el orden deseado y los códigos disponibles)
const botones = computed(() =>
  ORDEN_BOTONES
    .map(codigo => resultadosPap.value.find(r => r.resultado_codigo === codigo))
    .filter(Boolean)
);

const requiereFecha = computed(() => resultadoSel.value === 'VOLVER');

watch(() => props.open, async (v) => {
  if (v) {
    resultadoSel.value = null;
    comentario.value = '';
    proxFecha.value = '';
    // Capturar GPS en background al abrir (no bloquea UI)
    getCurrent().catch(() => {});
  }
});

function seleccionar(codigo) {
  resultadoSel.value = codigo;
}

async function guardar() {
  if (!resultadoSel.value) {
    toast.warning('Selecciona un resultado'); return;
  }
  const codigoResultado = resultadoSel.value;
  const codigoEstado = MAPEO_RESULTADO_ESTADO[codigoResultado];

  const rId = resultadoIdPorCodigo(codigoResultado);
  const eId = estadoIdPorCodigo(codigoEstado);
  if (!rId || !eId) {
    toast.error('Catálogos PAP incompletos. Recarga la página.'); return;
  }

  if (requiereFecha.value && !proxFecha.value) {
    toast.warning('Indica la fecha para volver a visitar'); return;
  }

  saving.value = true;
  try {
    // Intentar GPS una vez más si aún no se obtuvo
    if (!coords.value) await getCurrent().catch(() => {});

    const payload = {
      gest_prosp_id:        props.prospecto.prosp_id,
      gest_resultado_id:    rId,
      gest_estado_nuevo_id: eId,
      gest_canal:           'presencial',
      gest_comentario:      comentario.value || null,
      gest_ubicacion_lat:   coords.value?.lat || null,
      gest_ubicacion_lng:   coords.value?.lng || null,
      gest_prox_fecha:      requiereFecha.value ? proxFecha.value : null
    };
    const g = await gestiones.registrar(payload);
    toast.success('Gestión registrada');
    emit('registrada', g);
    emit('close');
  } catch (e) {
    notify(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="Nueva visita / gestión" max-width="max-w-md" @close="emit('close')">
    <div v-if="prospecto?.persona" class="space-y-4">
      <!-- Header del prospecto -->
      <div class="bg-cream/60 rounded-sv p-3">
        <div class="text-xs text-text3">Visitando a</div>
        <div class="font-semibold text-text1">
          {{ prospecto.persona.persona_nombre }} {{ prospecto.persona.persona_apellido || '' }}
        </div>
        <div class="text-xs text-text2 mt-0.5">
          📞 {{ prospecto.persona.persona_telefono_principal }}
        </div>
        <div v-if="prospecto.prosp_zona_pap" class="text-xs text-text3 mt-0.5">
          📍 {{ prospecto.prosp_zona_pap }}
        </div>
        <div class="text-xs mt-1.5 flex items-center gap-2">
          <span v-if="geoLoading" class="text-text3">⌛ Obteniendo GPS...</span>
          <span v-else-if="coords" class="text-sage">✓ GPS: {{ coords.lat.toFixed(5) }}, {{ coords.lng.toFixed(5) }}</span>
          <span v-else class="text-warning">⚠️ Sin GPS</span>
        </div>
      </div>

      <!-- Resultado: botones grandes táctiles -->
      <div>
        <label class="sv-label mb-2">¿Cuál fue el resultado?</label>
        <div class="grid grid-cols-1 gap-2">
          <button v-for="r in botones" :key="r.resultado_id"
                  type="button"
                  @click="seleccionar(r.resultado_codigo)"
                  class="w-full py-3 px-4 rounded-sv font-semibold text-sm text-left transition-all border-2"
                  :class="resultadoSel === r.resultado_codigo
                    ? COLOR_RESULTADO[r.resultado_codigo] + ' border-transparent shadow-sv-pop scale-[0.99]'
                    : 'bg-white border-text3/20 text-text2 hover:border-text3/40'">
            <span class="text-xl mr-2">{{ r.resultado_icono }}</span>
            {{ r.resultado_nombre }}
          </button>
        </div>
      </div>

      <!-- Fecha próxima solo si VOLVER -->
      <div v-if="requiereFecha" class="sv-card border border-area-emp/30 bg-area-emp/5 p-3">
        <div class="text-xs text-area-emp font-semibold mb-2">📅 ¿Cuándo volver?</div>
        <BaseInput v-model="proxFecha" type="date" required />
      </div>

      <!-- Comentario opcional -->
      <BaseTextarea v-model="comentario" label="Comentario (opcional)" rows="2"
                    placeholder="Notas para próxima visita..." />
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="saving" :disabled="!resultadoSel" @click="guardar">
        Registrar visita
      </BaseButton>
    </template>
  </BaseModal>
</template>
