<script setup>
/**
 * RegistroRapidoModal.vue — formulario PAP ultra-rápido (objetivo: < 30 s).
 *   - 4 inputs grandes + grid 2x2 de resultados + selector de plan (si Afiliado)
 *   - Geolocalización automática al abrir (no bloquea)
 *   - "Guardar y siguiente casa" resetea solo nombre+telefono manteniendo zona
 */
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePapStore } from '@/stores/usePapStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { useGeolocation } from '@/composables/useGeolocation';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({ open: { type: Boolean, required: true } });
const emit = defineEmits(['close', 'registrada']);

const config  = useConfigStore();
const auth    = useAuthStore();
const pap     = usePapStore();
const toast   = useToastStore();
const { notify } = useApiError();
const { coords, getCurrent, error: geoError, obteniendo } = useGeolocation();

const form = ref({
  nombre: '',
  telefono: '',
  direccion: '',
  zona_pap: '',
  resultado_codigo: 'AFILIADO_HOY',
  plan: null,
  comentario: '',
  prox_fecha: '',     // requerido solo si resultado_codigo === 'VOLVER'
  prox_hora:  '09:00'
});

// Fecha default sugerida cuando el asesor marca VOLVER: mañana
function fechaDefaultManana() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
const saving = ref(false);

const RESULTADOS = [
  { codigo: 'AFILIADO_HOY',  label: 'Afiliado hoy',  icon: '✅', color: 'sage'    },
  { codigo: 'INTERESADO',    label: 'Interesado',    icon: '💬', color: 'gold'    },
  { codigo: 'VOLVER',        label: 'Volver',        icon: '🔁', color: 'area-emp' },
  { codigo: 'NO_INTERESADO', label: 'No interesado', icon: '🚫', color: 'danger'  }
];

const planes = computed(() => (config.actual?.productos || [])
  .filter(p => p.prod_area_id === 3 && p.prod_activo)
  .sort((a, b) => a.prod_orden_display - b.prod_orden_display));

watch(() => props.open, async (v) => {
  if (v) {
    // Mantener zona si ya estaba seteada
    form.value = {
      nombre: '', telefono: '', direccion: '',
      zona_pap: pap.zonaActiva || '',
      resultado_codigo: 'AFILIADO_HOY',
      plan: null, comentario: '',
      prox_fecha: '', prox_hora: '09:00'
    };
    // Geoloc en background (no bloquea)
    getCurrent({ timeout: 8000 }).catch(() => {});
  }
});

async function guardarYsiguiente() {
  if (!form.value.nombre || !form.value.telefono) {
    toast.warning('Nombre y teléfono son obligatorios');
    return;
  }
  if (form.value.resultado_codigo === 'VOLVER' && !form.value.prox_fecha) {
    toast.warning('Indica cuándo debes volver a visitar');
    return;
  }
  await registrar(true);
}

async function guardar() {
  if (!form.value.nombre || !form.value.telefono) {
    toast.warning('Nombre y teléfono son obligatorios');
    return;
  }
  if (form.value.resultado_codigo === 'VOLVER' && !form.value.prox_fecha) {
    toast.warning('Indica cuándo debes volver a visitar');
    return;
  }
  await registrar(false);
}

// Auto-sugerir fecha mañana al cambiar a VOLVER si aún no se eligió ninguna
watch(() => form.value.resultado_codigo, (codigo) => {
  if (codigo === 'VOLVER' && !form.value.prox_fecha) {
    form.value.prox_fecha = fechaDefaultManana();
  }
});

async function sinRespuesta() {
  // Atajo: marcar como SIN_RESPUESTA con datos mínimos (nombre puede ser "Sin respuesta")
  form.value.nombre = form.value.nombre || 'Sin respuesta';
  form.value.telefono = form.value.telefono || `SR-${Date.now()}`;
  form.value.resultado_codigo = 'SIN_RESPUESTA';
  await registrar(true);
}

async function registrar(continuar = false) {
  saving.value = true;
  try {
    const payload = {
      nombre:    form.value.nombre.trim(),
      telefono:  form.value.telefono.trim(),
      direccion: form.value.direccion.trim() || null,
      zona_pap:  form.value.zona_pap.trim() || null,
      resultado_codigo: form.value.resultado_codigo,
      comentario: form.value.comentario.trim() || null,
      lat: coords.value?.lat || null,
      lng: coords.value?.lng || null,
      // Solo se envían cuando resultado es VOLVER; backend los ignora en otros casos
      prox_fecha: form.value.resultado_codigo === 'VOLVER' ? form.value.prox_fecha || null : null,
      prox_hora:  form.value.resultado_codigo === 'VOLVER' ? form.value.prox_hora  || null : null
    };
    const r = await pap.registrar(payload);

    if (form.value.zona_pap) pap.setZonaActiva(form.value.zona_pap);
    toast.success(`✓ Registrado: ${payload.resultado_codigo === 'AFILIADO_HOY' ? '¡Afiliado!' : r.resultado}`);
    emit('registrada', r);

    if (continuar) {
      // Reset mantener zona + dirección base
      form.value.nombre = '';
      form.value.telefono = '';
      form.value.direccion = '';
      form.value.resultado_codigo = 'AFILIADO_HOY';
      form.value.comentario = '';
      form.value.prox_fecha = '';
      form.value.prox_hora  = '09:00';
      // Refrescar coords
      getCurrent({ timeout: 5000 }).catch(() => {});
    } else {
      emit('close');
    }
  } catch (e) { notify(e); }
  finally { saving.value = false; }
}

function colorResultado(r) {
  return {
    AFILIADO_HOY:  'bg-sage text-white border-sage',
    INTERESADO:    'bg-gold text-white border-gold',
    VOLVER:        'bg-area-emp text-white border-area-emp',
    NO_INTERESADO: 'bg-danger text-white border-danger'
  }[r];
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 bg-cream overflow-y-auto">
      <header class="bg-area-pap text-white px-4 py-3 sticky top-0 z-10 shadow-sv-card">
        <div class="flex items-center justify-between max-w-md mx-auto">
          <button @click="emit('close')" class="text-cream/80 hover:text-white text-sm">← Cerrar</button>
          <h1 class="font-serif text-lg text-white">⚡ Registro rápido</h1>
          <div class="text-xs text-cream/80">
            <span v-if="coords" class="bg-white/15 px-2 py-0.5 rounded">📍 OK</span>
            <span v-else-if="obteniendo" class="bg-white/15 px-2 py-0.5 rounded animate-pulse">📍 ...</span>
            <span v-else-if="geoError" class="bg-white/15 px-2 py-0.5 rounded opacity-60">📍 —</span>
          </div>
        </div>
      </header>

      <main class="max-w-md mx-auto px-4 py-5 space-y-4 pb-32">
        <!-- Inputs grandes -->
        <BaseInput v-model="form.nombre"     label="Nombre" placeholder="Juan Pérez" required class="text-lg" />
        <BaseInput v-model="form.telefono"   label="Teléfono" inputmode="tel" placeholder="311 555 1234" required />
        <BaseInput v-model="form.direccion"  label="Dirección" placeholder="Cra 5 #12-30" />
        <BaseInput v-model="form.zona_pap"   label="Zona / Barrio" placeholder="La Libertad" />

        <!-- Grid 2x2 de resultados -->
        <div>
          <label class="sv-label">Resultado de la visita *</label>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="r in RESULTADOS" :key="r.codigo"
                    type="button"
                    @click="form.resultado_codigo = r.codigo"
                    class="px-4 py-5 rounded-sv border-2 font-bold text-base transition-all"
                    :class="form.resultado_codigo === r.codigo
                      ? colorResultado(r.codigo) + ' shadow-sv-pop'
                      : 'bg-white text-text2 border-text3/30 hover:border-area-pap'">
              <div class="text-3xl">{{ r.icon }}</div>
              <div class="mt-1 text-xs sm:text-sm">{{ r.label }}</div>
            </button>
          </div>
        </div>

        <!-- Fecha de retorno (si VOLVER) -->
        <div v-if="form.resultado_codigo === 'VOLVER'"
             class="sv-card border-2 border-area-emp/40 bg-area-emp/5 p-3 space-y-2">
          <label class="sv-label flex items-center gap-1">🗓️ ¿Cuándo debes volver? <span class="text-danger">*</span></label>
          <div class="grid grid-cols-2 gap-2">
            <BaseInput v-model="form.prox_fecha" type="date" label="Fecha" required />
            <BaseInput v-model="form.prox_hora"  type="time" label="Hora"  required />
          </div>
          <p class="text-xs text-text3">Se agendará automáticamente en tu calendario para esa fecha.</p>
        </div>

        <!-- Planes (si Afiliado o Interesado) -->
        <div v-if="['AFILIADO_HOY','INTERESADO'].includes(form.resultado_codigo) && planes.length">
          <label class="sv-label">Plan de interés</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="p in planes" :key="p.prod_id"
                    type="button"
                    @click="form.plan = form.plan === p.prod_id ? null : p.prod_id"
                    class="px-3 py-2 rounded-full text-xs font-semibold border transition-colors"
                    :class="form.plan === p.prod_id
                      ? 'bg-area-pap text-white border-area-pap'
                      : 'bg-white text-text2 border-text3/30'">
              {{ p.prod_nombre }}
            </button>
          </div>
        </div>

        <BaseInput v-model="form.comentario" label="Comentario (opcional)" placeholder="Notas..." />
      </main>

      <!-- Bottom actions sticky -->
      <footer class="fixed bottom-0 inset-x-0 bg-white border-t border-text3/15 px-4 py-3 z-20">
        <div class="max-w-md mx-auto space-y-2">
          <BaseButton variant="success" :loading="saving" @click="guardarYsiguiente"
                      class="w-full text-base py-4">
            ⚡ Guardar y siguiente casa
          </BaseButton>
          <div class="grid grid-cols-2 gap-2">
            <BaseButton variant="secondary" size="sm" @click="guardar" :loading="saving">💾 Guardar</BaseButton>
            <BaseButton variant="ghost"     size="sm" @click="sinRespuesta">🏠 Sin respuesta</BaseButton>
          </div>
        </div>
      </footer>
    </div>
  </Teleport>
</template>
