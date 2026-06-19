<script setup>
import { ref, computed, watch } from 'vue';
import { empresasApi } from '@/api/empresasApi';
import { useToastStore } from '@/stores/useToastStore';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  empresa: { type: Object, default: null }
});
const emit = defineEmits(['close', 'actualizada']);

const toast = useToastStore();

const CATEGORIAS = [
  { value: '', label: 'Sin categoría' },
  { value: 'BRONCE',   label: '🥉 Bronce' },
  { value: 'PLATA',    label: '🥈 Plata' },
  { value: 'ORO',      label: '🥇 Oro' },
  { value: 'PLATINO',  label: '💎 Platino' },
  { value: 'DIAMANTE', label: '💠 Diamante' }
];

const categoria = ref('');
const montoAjuste = ref('');
const tipoAjuste = ref('AJUSTE');     // ASIGNACION | AJUSTE
const descripcion = ref('');
const enviando = ref(false);

// Histórico de movimientos
const movimientos = ref([]);
const cargandoMov = ref(false);
const mostrarHistorico = ref(false);

async function cargarMovimientos() {
  if (!props.empresa?.empresa_id) return;
  cargandoMov.value = true;
  try {
    const r = await empresasApi.movimientos(props.empresa.empresa_id, { limit: 100 });
    movimientos.value = r?.items || r || [];
  } catch (_e) {
    movimientos.value = [];
  } finally {
    cargandoMov.value = false;
  }
}

const TIPO_INFO = {
  ASIGNACION: { label: 'Asignación inicial', icon: '➕', color: 'text-sage' },
  AJUSTE:     { label: 'Ajuste manual',      icon: '⚖️', color: 'text-area-emp' },
  CONSUMO:    { label: 'Consumo (envío)',    icon: '🛍️', color: 'text-danger' }
};

const presupuestoActual = computed(() => parseFloat(props.empresa?.empresa_presupuesto_fideliz || 0));
const gastadoActual    = computed(() => parseFloat(props.empresa?.empresa_presupuesto_gastado || 0));
const disponible       = computed(() => presupuestoActual.value - gastadoActual.value);

const fmtMoneda = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n || 0);

watch(() => props.open, (n) => {
  if (n) {
    categoria.value = props.empresa?.empresa_categoria || '';
    montoAjuste.value = '';
    tipoAjuste.value = 'AJUSTE';
    descripcion.value = '';
    mostrarHistorico.value = false;
    movimientos.value = [];
  }
});

async function guardar() {
  enviando.value = true;
  try {
    // 1. Actualizar categoría si cambió
    if ((categoria.value || null) !== (props.empresa.empresa_categoria || null)) {
      await empresasApi.actualizarCategoria(props.empresa.empresa_id, categoria.value || null);
    }
    // 2. Aplicar ajuste de presupuesto si hay monto
    const m = parseFloat(montoAjuste.value);
    if (!Number.isNaN(m) && m !== 0) {
      await empresasApi.ajustarPresupuesto(props.empresa.empresa_id, {
        monto: m, tipo: tipoAjuste.value, descripcion: descripcion.value
      });
    }
    toast.success('Categoría / presupuesto actualizados');
    emit('actualizada');
    emit('close');
  } catch (e) {
    toast.error(e.response?.data?.message || 'Error al guardar');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="🏷️ Categoría y presupuesto de fidelización" max-width="max-w-lg" @close="emit('close')">
    <div v-if="!empresa" class="text-text3 text-center py-8">Empresa no disponible.</div>
    <div v-else class="space-y-4">
      <!-- Estado actual -->
      <div class="sv-card p-3 bg-cream/50 grid grid-cols-3 gap-2 text-center">
        <div>
          <div class="text-[10px] text-text3 uppercase">Presupuesto</div>
          <div class="font-semibold text-text1 text-sm">{{ fmtMoneda(presupuestoActual) }}</div>
        </div>
        <div>
          <div class="text-[10px] text-text3 uppercase">Gastado</div>
          <div class="font-semibold text-danger text-sm">{{ fmtMoneda(gastadoActual) }}</div>
        </div>
        <div>
          <div class="text-[10px] text-text3 uppercase">Disponible</div>
          <div class="font-semibold text-sage text-sm">{{ fmtMoneda(disponible) }}</div>
        </div>
      </div>

      <!-- Categoría -->
      <div>
        <label class="sv-label">Categoría</label>
        <BaseSelect v-model="categoria" :options="CATEGORIAS" />
        <p class="text-[11px] text-text3 mt-1">Asignación manual. Los parámetros son ajustables en cualquier momento.</p>
      </div>

      <!-- Ajuste presupuesto -->
      <div class="border-t border-text3/15 pt-3">
        <div class="text-xs text-text3 uppercase tracking-wider mb-2">Ajustar presupuesto (opcional)</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="sv-label">Tipo</label>
            <BaseSelect v-model="tipoAjuste" :options="[
              { value: 'ASIGNACION', label: 'Asignación inicial' },
              { value: 'AJUSTE',     label: 'Ajuste (+/-)' }
            ]" />
          </div>
          <div>
            <label class="sv-label">Monto (COP)</label>
            <BaseInput v-model="montoAjuste" type="number" placeholder="Ej. 500000 o -50000" />
          </div>
        </div>
        <BaseTextarea v-model="descripcion" rows="2" class="mt-2" placeholder="Motivo del ajuste (opcional)" />
        <p class="text-[11px] text-text3 mt-1">
          Para aumentar usa monto positivo. Para descontar, negativo.
          Se registra en el libro mayor de movimientos.
        </p>
      </div>

      <!-- Histórico de movimientos -->
      <div class="border-t border-text3/15 pt-3">
        <button type="button"
                @click="mostrarHistorico = !mostrarHistorico; if (mostrarHistorico) cargarMovimientos()"
                class="w-full flex items-center justify-between text-xs text-text2 uppercase tracking-wider hover:text-text1">
          <span>📜 Libro mayor de movimientos</span>
          <span>{{ mostrarHistorico ? '▾' : '▸' }}</span>
        </button>
        <div v-if="mostrarHistorico" class="mt-2 max-h-56 overflow-y-auto border border-text3/15 rounded-sv">
          <div v-if="cargandoMov" class="text-text3 text-sm text-center py-4">Cargando...</div>
          <div v-else-if="!movimientos.length" class="text-text3 text-sm text-center py-4">Sin movimientos registrados</div>
          <ul v-else class="divide-y divide-text3/10">
            <li v-for="m in movimientos" :key="m.mov_id" class="px-3 py-2 flex items-center gap-2 text-sm">
              <span class="text-base">{{ TIPO_INFO[m.mov_tipo]?.icon || '•' }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold" :class="TIPO_INFO[m.mov_tipo]?.color">
                    {{ TIPO_INFO[m.mov_tipo]?.label || m.mov_tipo }}
                  </span>
                  <span class="text-[10px] text-text3">{{ new Date(m.mov_fecha).toLocaleString() }}</span>
                </div>
                <div class="text-xs text-text2 truncate">{{ m.mov_descripcion }}</div>
                <div v-if="m.usuario" class="text-[10px] text-text3">
                  por {{ m.usuario.usr_nombre }} {{ m.usuario.usr_apellido }}
                </div>
              </div>
              <div class="font-semibold whitespace-nowrap"
                   :class="parseFloat(m.mov_monto) >= 0 ? 'text-sage' : 'text-danger'">
                {{ parseFloat(m.mov_monto) >= 0 ? '+' : '' }}{{ fmtMoneda(parseFloat(m.mov_monto)) }}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :disabled="enviando" @click="guardar">
        {{ enviando ? 'Guardando...' : 'Guardar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
