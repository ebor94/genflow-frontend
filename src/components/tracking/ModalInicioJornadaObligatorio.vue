<template>
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="jorObl-title"
  >
    <div class="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
      <header class="bg-gradient-to-br from-green-700 to-green-900 px-6 py-5 text-white">
        <h2 id="jorObl-title" class="text-lg font-bold leading-tight">
          {{ saludo }}, {{ auth.nombreCompleto }}
        </h2>
        <p class="text-green-100 text-sm mt-1">
          Antes de comenzar, indícanos cómo será tu día.
        </p>
        <p class="text-green-200 text-xs mt-1">{{ fechaHoy }}</p>
      </header>

      <div class="flex border-b border-gray-200 text-sm font-medium">
        <button
          type="button"
          data-testid="btn-tab-iniciar"
          class="flex-1 py-3"
          :class="tab === 'iniciar' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-700'"
          @click="tab = 'iniciar'"
        >Iniciar jornada</button>
        <button
          type="button"
          data-testid="btn-tab-ausencia"
          class="flex-1 py-3"
          :class="tab === 'ausencia' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-gray-700'"
          @click="tab = 'ausencia'"
        >No laboro hoy</button>
      </div>

      <!-- Tab: Iniciar jornada -->
      <section
        v-if="tab === 'iniciar'"
        data-testid="tab-iniciar"
        class="px-6 py-6 space-y-4"
      >
        <p class="text-sm text-gray-600">
          Al iniciar, el sistema empezará a registrar tu ubicación durante la jornada.
          Este dato es obligatorio por política de la empresa.
        </p>
        <div v-if="permisoGpsFallido" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No pudimos leer tu GPS. Verifica que le diste permiso al navegador y vuelve a intentar.
        </div>
        <button
          type="button"
          data-testid="btn-iniciar-jornada"
          :disabled="cargando"
          class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white font-semibold text-sm rounded-lg transition-colors"
          @click="iniciarJornada"
        >
          <span v-if="cargando" class="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
          {{ cargando ? 'Iniciando...' : 'Iniciar jornada ahora' }}
        </button>
      </section>

      <!-- Tab: No laboro hoy -->
      <section
        v-else
        data-testid="tab-ausencia"
        class="px-6 py-6 space-y-4"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
          <select
            v-model="ausencia.tipo"
            data-testid="select-tipo"
            class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
          >
            <option value="PERMISO">Permiso</option>
            <option value="INCAPACIDAD">Incapacidad</option>
            <option value="DIA_LIBRE">Día libre</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            v-model="ausencia.motivo"
            data-testid="input-motivo"
            rows="3"
            minlength="5"
            maxlength="500"
            placeholder="Explica brevemente (mínimo 5 caracteres)"
            class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm resize-none"
          ></textarea>
          <p class="text-xs text-gray-400 mt-1">{{ ausencia.motivo.length }} / 500</p>
        </div>
        <button
          type="button"
          data-testid="btn-confirmar-ausencia"
          :disabled="!ausenciaValida || cargando"
          class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-sm rounded-lg transition-colors"
          @click="confirmarAusencia"
        >
          <span v-if="cargando" class="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
          {{ cargando ? 'Guardando...' : 'Confirmar ausencia' }}
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTrackingStore } from '@/stores/useTrackingStore';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';
import { useToastStore } from '@/stores/useToastStore';

const auth     = useAuthStore();
const tracking = useTrackingStore();
const jornObl  = useJornadaObligatoriaStore();
const toast    = useToastStore();

const tab      = ref('iniciar');
const cargando = ref(false);
const permisoGpsFallido = ref(false);
const ausencia = reactive({ tipo: 'PERMISO', motivo: '' });

const ausenciaValida = computed(() => ausencia.motivo.trim().length >= 5);

const fechaHoy = new Date().toLocaleDateString('es-CO', {
  timeZone: 'America/Bogota', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
});

const saludo = (() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
})();

async function iniciarJornada() {
  cargando.value = true;
  permisoGpsFallido.value = false;
  try {
    await tracking.iniciar();
    jornObl.marcarJornadaIniciada();
    toast.success('Jornada iniciada. Tracking activo.');
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('geoloc')) {
      permisoGpsFallido.value = true;
    }
    toast.error('No se pudo iniciar la jornada. Verifica el permiso de ubicación.');
  } finally {
    cargando.value = false;
  }
}

async function confirmarAusencia() {
  if (!ausenciaValida.value) return;
  cargando.value = true;
  try {
    await jornObl.marcarAusencia({
      tipo:   ausencia.tipo,
      motivo: ausencia.motivo.trim()
    });
    toast.success('Ausencia registrada por hoy.');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo registrar la ausencia.');
  } finally {
    cargando.value = false;
  }
}

// Bloquear Escape y navegación con Tab fuera del modal
function onKeyDown(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
}
onMounted(() => {
  document.addEventListener('keydown', onKeyDown, true);
  document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown, true);
  document.body.style.overflow = '';
});
</script>
