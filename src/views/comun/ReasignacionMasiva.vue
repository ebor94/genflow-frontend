<script setup>
/**
 * ReasignacionMasiva.vue — vista del supervisor (Prenec o Previsión) para
 * mover TODOS los prospectos activos de un asesor a otro(s) cuando hay
 * vacaciones, incapacidad, retiro, etc.
 *
 * Flujo:
 *   1) Selecciona área (si tiene multi-área).
 *   2) Ve listado de asesores con cantidad de prospectos activos.
 *   3) Marca asesor ORIGEN (quien se ausenta).
 *   4) Marca uno o varios asesores DESTINO (distribución round-robin).
 *   5) Indica motivo, opcionalmente excluye estados finales.
 *   6) Confirma → backend reasigna y registra una gestión por cada prospecto.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { prospectosApi } from '@/api/prospectosApi';
import { usuariosApi } from '@/api/usuariosApi';

import EmptyState  from '@/components/common/EmptyState.vue';
import BaseInput   from '@/components/ui/BaseInput.vue';
import BaseSelect  from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton  from '@/components/ui/BaseButton.vue';
import BaseModal   from '@/components/ui/BaseModal.vue';

const auth   = useAuthStore();
const toast  = useToastStore();
const { notify } = useApiError();

// Áreas accesibles para el supervisor
const areasFiltrables = computed(() => {
  return (auth.areasAccesibles || []).filter(a => ['PRENEC','PREV-EMP','PREV-PAP'].includes(a.area_codigo));
});

const areaId = ref(null);
const cargaPorAsesor = ref([]);    // [{ asesor, total_activos }]
const usuariosArea  = ref([]);     // todos los asesores del área (incluye los que no tienen prospectos hoy)
const loading       = ref(false);

const origen        = ref(null);    // asesor_id
const destinos      = ref([]);      // [asesor_id]
const motivo        = ref('');
const soloNoFinales = ref(true);

const showConfirm = ref(false);
const resultado   = ref(null);

const opcionesAreas = computed(() =>
  areasFiltrables.value.map(a => ({ value: a.area_id, label: `${a.area_nombre} (${a.area_codigo})` }))
);

// Combinar carga + usuarios activos del área (asesores SIN prospectos también pueden ser destino)
const filasAsesores = computed(() => {
  const mapCarga = new Map(cargaPorAsesor.value.map(c => [c.asesor_id, c.total_activos]));
  const set = new Map();
  // Primero los que tienen prospectos
  cargaPorAsesor.value.forEach(c => {
    if (c.asesor) set.set(c.asesor.usr_id, { ...c.asesor, total_activos: c.total_activos });
  });
  // Luego los demás asesores activos del área
  usuariosArea.value.forEach(u => {
    if (!set.has(u.usr_id) && u.usr_activo) {
      set.set(u.usr_id, { ...u, total_activos: mapCarga.get(u.usr_id) || 0 });
    }
  });
  return [...set.values()];
});

async function cargar() {
  if (!areaId.value) return;
  loading.value = true;
  try {
    const [carga, usuarios] = await Promise.all([
      prospectosApi.porAsesor({ area_id: areaId.value }),
      usuariosApi.list({ area_id: areaId.value, limit: 200 })
    ]);
    cargaPorAsesor.value = carga.data;
    // usuarios devuelve { items, total }
    usuariosArea.value = (usuarios.data?.items || usuarios.data || []).filter(
      u => u.rol?.rol_codigo === 'ASESOR' || u.rol?.rol_codigo === 'AGENTE_SVC'
    );
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

watch(areaId, cargar);

onMounted(() => {
  // Por defecto, área activa
  areaId.value = auth.areaActivaId;
});

function toggleDestino(asesorId) {
  const i = destinos.value.indexOf(asesorId);
  if (i >= 0) destinos.value.splice(i, 1);
  else destinos.value.push(asesorId);
}

const origenAsesor = computed(() => filasAsesores.value.find(a => a.usr_id === origen.value));
const cantidadOrigen = computed(() => origenAsesor.value?.total_activos || 0);

const puedeReasignar = computed(() => origen.value && destinos.value.length && motivo.value.trim() && cantidadOrigen.value > 0);

async function confirmar() {
  if (!puedeReasignar.value) return;
  loading.value = true;
  try {
    const r = await prospectosApi.reasignacionMasiva({
      asesor_origen_id: origen.value,
      asesores_destino: destinos.value,
      solo_estados_no_finales: soloNoFinales.value,
      motivo: motivo.value.trim(),
      area_id: areaId.value
    });
    resultado.value = r.data;
    toast.success(`${r.data.reasignados} prospectos reasignados correctamente`);
    // Reset y recargar
    origen.value = null;
    destinos.value = [];
    motivo.value = '';
    await cargar();
  } catch (e) { notify(e); }
  finally { loading.value = false; showConfirm.value = false; }
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="sv-card p-5 mb-4 border-l-4 border-warning">
      <h1 class="font-serif text-2xl text-brown-deep">🔄 Reasignación masiva de prospectos</h1>
      <p class="text-sm text-text2 mt-1">
        Mueve todos los prospectos activos de un asesor a otro(s) cuando hay vacaciones,
        incapacidad, retiro u otra ausencia. Cada reasignación queda registrada como
        gestión inmutable en el prospecto.
      </p>
    </header>

    <!-- Selector de área -->
    <div class="sv-card p-4 mb-4">
      <BaseSelect v-model="areaId" label="Área a reasignar"
                  :options="opcionesAreas"
                  placeholder="Selecciona el área" />
    </div>

    <div v-if="!areaId" class="text-text3 text-center py-8">Selecciona un área para comenzar.</div>

    <template v-else>
      <!-- Lista de asesores -->
      <div class="sv-card p-0 mb-4 overflow-hidden">
        <div class="px-4 py-3 border-b border-text3/10 bg-cream/40">
          <h3 class="text-sm font-semibold text-text1">Asesores del área</h3>
          <p class="text-xs text-text3 mt-0.5">Selecciona el origen (quien se ausenta) y los destinos (quienes reciben).</p>
        </div>

        <div v-if="loading" class="text-text3 text-center py-8">Cargando...</div>
        <EmptyState v-else-if="!filasAsesores.length" titulo="Sin asesores activos" size="sm" />

        <table v-else class="w-full text-sm">
          <thead class="text-xs uppercase text-text3 bg-cream/20">
            <tr>
              <th class="text-left px-4 py-2">Asesor</th>
              <th class="text-center px-4 py-2">Prospectos activos</th>
              <th class="text-center px-4 py-2">Origen</th>
              <th class="text-center px-4 py-2">Destino</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in filasAsesores" :key="a.usr_id"
                class="border-t border-text3/5 hover:bg-cream/20 transition-colors"
                :class="{ 'bg-warning/5': origen === a.usr_id, 'bg-sage/5': destinos.includes(a.usr_id) }">
              <td class="px-4 py-3">
                <div class="font-semibold text-text1">{{ a.usr_nombre }} {{ a.usr_apellido }}</div>
                <div class="text-xs text-text3">{{ a.usr_email }}</div>
              </td>
              <td class="text-center px-4 py-3">
                <span class="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold"
                      :class="a.total_activos > 0 ? 'bg-gold/15 text-gold' : 'bg-text3/10 text-text3'">
                  {{ a.total_activos }}
                </span>
              </td>
              <td class="text-center px-4 py-3">
                <input type="radio" :value="a.usr_id" v-model="origen"
                       class="w-4 h-4 accent-warning"
                       :disabled="a.total_activos === 0" />
              </td>
              <td class="text-center px-4 py-3">
                <input type="checkbox" :checked="destinos.includes(a.usr_id)"
                       @change="toggleDestino(a.usr_id)"
                       :disabled="origen === a.usr_id"
                       class="w-4 h-4 accent-sage" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Configuración -->
      <div class="sv-card p-4 mb-4 space-y-3">
        <BaseTextarea v-model="motivo"
                      label="Motivo de la reasignación"
                      placeholder="Ej: Vacaciones del 15 al 30 de mayo · Incapacidad médica · Retiro del cargo"
                      required />

        <label class="flex items-center gap-2 text-sm text-text2">
          <input type="checkbox" v-model="soloNoFinales" class="w-4 h-4 accent-warning" />
          <span>Solo reasignar prospectos en estado activo (excluir ganados / perdidos / cerrados)</span>
        </label>
      </div>

      <!-- Resumen + acción -->
      <div v-if="origen && destinos.length" class="sv-card p-4 mb-4 bg-warning/5 border border-warning/30">
        <h3 class="font-semibold text-warning text-sm mb-2">📋 Resumen</h3>
        <ul class="text-sm text-text2 space-y-1">
          <li>
            <strong>Origen:</strong> {{ origenAsesor?.usr_nombre }} {{ origenAsesor?.usr_apellido }}
            ({{ cantidadOrigen }} prospectos a mover)
          </li>
          <li>
            <strong>Destinos:</strong> {{ destinos.length }} asesor{{ destinos.length > 1 ? 'es' : '' }}
            <span class="text-xs text-text3">(distribución round-robin)</span>
          </li>
          <li v-if="destinos.length > 1" class="text-xs text-text3">
            ≈ {{ Math.ceil(cantidadOrigen / destinos.length) }} prospectos por asesor destino
          </li>
        </ul>
      </div>

      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="origen = null; destinos = []; motivo = ''">
          Limpiar
        </BaseButton>
        <BaseButton variant="primary" :disabled="!puedeReasignar" @click="showConfirm = true">
          🔄 Reasignar {{ cantidadOrigen }} prospectos
        </BaseButton>
      </div>

      <!-- Modal de confirmación -->
      <BaseModal :open="showConfirm" title="Confirmar reasignación masiva" @close="showConfirm = false">
        <div class="space-y-3">
          <p class="text-sm text-text2">
            ¿Confirmas la reasignación de
            <strong class="text-text1">{{ cantidadOrigen }} prospectos</strong>
            de <strong class="text-text1">{{ origenAsesor?.usr_nombre }} {{ origenAsesor?.usr_apellido }}</strong>
            hacia <strong class="text-text1">{{ destinos.length }} asesor{{ destinos.length > 1 ? 'es' : '' }}</strong>?
          </p>
          <p class="text-xs text-text3 bg-warning/5 border border-warning/30 rounded-sv p-3">
            ⚠️ Esta acción es irreversible. Cada prospecto reasignado quedará con una gestión
            inmutable en su historial documentando el cambio.
          </p>
          <div class="bg-cream/60 rounded-sv p-3 text-xs">
            <strong>Motivo:</strong> {{ motivo }}
          </div>
        </div>
        <template #footer>
          <BaseButton variant="secondary" @click="showConfirm = false">Cancelar</BaseButton>
          <BaseButton variant="primary" :loading="loading" @click="confirmar">
            Confirmar reasignación
          </BaseButton>
        </template>
      </BaseModal>

      <!-- Resultado -->
      <div v-if="resultado" class="sv-card p-4 mt-4 border border-sage/30 bg-sage/5">
        <h3 class="font-semibold text-sage text-sm mb-2">✅ Reasignación completada</h3>
        <p class="text-sm text-text2">Total reasignados: <strong>{{ resultado.reasignados }}</strong></p>
        <div v-if="resultado.distribucion" class="mt-2 text-xs text-text3 space-y-0.5">
          <div v-for="(count, asesorId) in resultado.distribucion" :key="asesorId">
            Asesor #{{ asesorId }} → {{ count }} prospectos
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
