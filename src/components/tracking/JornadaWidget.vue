<script setup>
/**
 * JornadaWidget.vue — indicador y controles del tracking GPS.
 *
 * Comportamiento:
 *  - Inicia/finaliza automáticamente con la sesión (sin botón manual).
 *  - Muestra duración de la jornada y minutos sin reporte (gap si > 5 min).
 *  - Permite activar "Mantener pantalla activa" (Wake Lock) para evitar que
 *    el navegador suspenda el watchPosition al bloquear el teléfono.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTrackingStore } from '@/stores/useTrackingStore';

const auth = useAuthStore();
const tracking = useTrackingStore();
const menuAbierto = ref(false);

const AREAS_CON_TRACKING = ['PRENEC', 'PREV-EMP', 'PREV-PAP'];

const debeAparecer = computed(() => {
  if (!auth.isAuthenticated) return false;
  if (auth.rolCodigo !== 'ASESOR') return false;
  const area = auth.usuario?.area?.area_codigo;
  return AREAS_CON_TRACKING.includes(area);
});

function formatoDuracion(min) {
  if (min < 1) return 'iniciando';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const hayGap = computed(() => tracking.minSinPunto != null && tracking.minSinPunto >= 5);

async function autoIniciar() {
  if (!debeAparecer.value) return;
  if (tracking.estaActiva) return;
  try { await tracking.iniciar(); } catch (e) { /* silencioso */ }
}

// Cuando el navegador libera Wake Lock (ej. al cambiar de pestaña), reintentar al volver
function onVisibility() {
  if (document.visibilityState === 'visible') tracking.maybeReadquireWakeLock();
}

onMounted(async () => {
  tracking.restaurar();
  if (!tracking.estaActiva) await autoIniciar();
  document.addEventListener('visibilitychange', onVisibility);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
});

watch(() => auth.usuario?.usr_id, async (newId, oldId) => {
  if (newId && newId !== oldId) await autoIniciar();
});

function onClickFuera(ev) {
  if (!ev.target.closest('[data-tracking-widget]')) menuAbierto.value = false;
}
onMounted(() => document.addEventListener('click', onClickFuera));
onBeforeUnmount(() => document.removeEventListener('click', onClickFuera));
</script>

<template>
  <div v-if="debeAparecer && tracking.estaActiva" class="inline-flex items-center relative" data-tracking-widget>
    <button @click.stop="menuAbierto = !menuAbierto"
            class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-sv border transition-colors"
            :class="hayGap
              ? 'bg-warning/15 border-warning/30 hover:bg-warning/20'
              : 'bg-sage/15 border-sage/30 hover:bg-sage/25'"
            :title="hayGap
              ? `Sin reporte hace ${tracking.minSinPunto} min`
              : 'Tu ubicación se está registrando'">
      <span class="relative flex w-2 h-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              :class="hayGap ? 'bg-warning' : 'bg-sage'"></span>
        <span class="relative inline-flex rounded-full h-2 w-2"
              :class="hayGap ? 'bg-warning' : 'bg-sage'"></span>
      </span>
      <span class="text-xs font-semibold text-cream">
        {{ hayGap ? '🟡' : '🟢' }} GPS · {{ formatoDuracion(tracking.duracionMin) }}
      </span>
      <span v-if="tracking.bufferLocal.length" class="text-[10px] text-cream/50" :title="`${tracking.bufferLocal.length} puntos pendientes de envío`">
        +{{ tracking.bufferLocal.length }}
      </span>
      <svg class="w-3 h-3 text-cream/50" :class="{ 'rotate-180': menuAbierto }"
           viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
      </svg>
    </button>

    <!-- Popover -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0">
      <div v-if="menuAbierto"
           class="absolute right-0 top-full mt-1 w-72 bg-white text-text1 rounded-sv shadow-sv-pop border border-text3/15 py-3 px-4 z-50">
        <div class="text-xs text-text3 uppercase tracking-wider font-semibold mb-2">📍 Estado del tracking</div>

        <div class="space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-text2">Duración</span>
            <span class="font-semibold">{{ formatoDuracion(tracking.duracionMin) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text2">Último reporte</span>
            <span class="font-semibold" :class="hayGap ? 'text-warning' : 'text-text1'">
              {{ tracking.minSinPunto == null ? '—' : tracking.minSinPunto === 0 ? 'ahora mismo' : `hace ${tracking.minSinPunto} min` }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-text2">Pendientes</span>
            <span class="font-semibold">{{ tracking.bufferLocal.length }}</span>
          </div>
        </div>

        <div v-if="hayGap" class="mt-3 p-2 bg-warning/10 border border-warning/30 rounded-sv text-xs text-text2">
          ⚠️ El tracking se suspende cuando bloqueas la pantalla.
          Para evitarlo, activa "Mantener pantalla activa" abajo.
        </div>

        <!-- Toggle Wake Lock -->
        <label class="flex items-center justify-between mt-3 pt-3 border-t border-text3/10 cursor-pointer">
          <div>
            <div class="text-sm font-semibold text-text1">Mantener pantalla activa</div>
            <div class="text-xs text-text3">Evita que el GPS se pause al bloquear (consume más batería)</div>
          </div>
          <input type="checkbox"
                 :checked="tracking.wakeLockPref"
                 @change="tracking.toggleWakeLock()"
                 class="w-5 h-5 accent-gold cursor-pointer" />
        </label>

        <div v-if="tracking.wakeLockPref && !tracking.wakeLockActivo"
             class="mt-2 text-[11px] text-text3 italic">
          (Se reactivará al volver a la pestaña)
        </div>
      </div>
    </Transition>
  </div>
</template>
