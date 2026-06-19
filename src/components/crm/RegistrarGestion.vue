<script setup>
/**
 * RegistrarGestion.vue — modal para registrar gestión inmutable.
 * Props: open, prospecto (objeto con prosp_id, prosp_grupo_id, prosp_area_id, persona, productos)
 * Emit: close, registrada (gestion)
 *
 * Incluye editor opcional de productos de interés del cliente.
 * Si se modifican, se guardan antes de registrar la gestión.
 * Catálogos se leen del configStore (bootstrap por área).
 */
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { prospectosApi } from '@/api/prospectosApi';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  prospecto: { type: Object, default: null }
});
const emit = defineEmits(['close', 'registrada']);

const config = useConfigStore();
const gestiones = useGestionesStore();
const toast = useToastStore();
const { notify } = useApiError();

const form = ref({
  gest_canal: 'llamada',
  gest_resultado_id: '',
  gest_estado_nuevo_id: '',
  gest_comentario: '',
  gest_duracion_seg: null,
  gest_prox_fecha: '',
  gest_prox_hora: ''
});
const saving = ref(false);

// ─── Productos de interés (editor opcional) ───
const editandoProductos = ref(false);
const productosSel = ref([]); // [{ prod_id, es_principal, nota }]
const productosOriginales = ref([]); // snapshot para detectar cambios

const grupoId = computed(() => props.prospecto?.prosp_grupo_id || null);
const areaId  = computed(() => props.prospecto?.prosp_area_id  || null);

const productosDisponibles = computed(() => {
  const all = config.actual?.productos || [];
  return all
    .filter(p => p.prod_area_id === areaId.value && p.prod_activo)
    .sort((a, b) => (a.prod_orden_display || 0) - (b.prod_orden_display || 0));
});

const resultadosDelGrupo = computed(() => {
  const all = config.actual?.resultados || [];
  return all.filter(r => r.resultado_grupo_id === grupoId.value && r.resultado_activo);
});

const estadosDelGrupo = computed(() => {
  const all = config.actual?.estados || [];
  return all.filter(e => e.estado_grupo_id === grupoId.value && e.estado_activo);
});

const resultadoSeleccionado = computed(() =>
  resultadosDelGrupo.value.find(r => r.resultado_id === parseInt(form.value.gest_resultado_id))
);

const requiereFecha = computed(() => {
  if (resultadoSeleccionado.value?.resultado_requiere_fecha) return true;
  const e = estadosDelGrupo.value.find(x => x.estado_id === parseInt(form.value.gest_estado_nuevo_id));
  return e?.estado_requiere_fecha;
});

const opcResultados = computed(() => resultadosDelGrupo.value
  .sort((a, b) => a.resultado_orden - b.resultado_orden)
  .map(r => ({ value: r.resultado_id, label: `${r.resultado_icono || ''} ${r.resultado_nombre}`.trim() })));

const opcEstados = computed(() => [
  { value: '', label: '— sin cambio —' },
  ...estadosDelGrupo.value
    .sort((a, b) => a.estado_orden - b.estado_orden)
    .map(e => ({ value: e.estado_id, label: e.estado_nombre }))
]);

const opcCanales = [
  { value: 'llamada',    label: '📞 Llamada' },
  { value: 'presencial', label: '🤝 Presencial' },
  { value: 'correo',     label: '✉️ Correo' }
];

watch(() => props.open, (v) => {
  if (v) {
    form.value = {
      gest_canal: 'llamada',
      gest_resultado_id: '',
      gest_estado_nuevo_id: '',
      gest_comentario: '',
      gest_duracion_seg: null,
      gest_prox_fecha: '',
      gest_prox_hora: ''
    };
    // Cargar productos actuales del prospecto
    const actuales = (props.prospecto?.productos || []).map(p => ({
      prod_id:      p.pp_prod_id,
      es_principal: !!p.pp_es_principal,
      nota:         p.pp_nota || null
    }));
    productosSel.value = JSON.parse(JSON.stringify(actuales));
    productosOriginales.value = JSON.parse(JSON.stringify(actuales));
    editandoProductos.value = false;
  }
});

function estaSeleccionado(prodId) {
  return productosSel.value.some(p => p.prod_id === prodId);
}

function esPrincipal(prodId) {
  return productosSel.value.find(p => p.prod_id === prodId)?.es_principal;
}

function toggleProducto(prodId) {
  const i = productosSel.value.findIndex(p => p.prod_id === prodId);
  if (i >= 0) {
    productosSel.value.splice(i, 1);
  } else {
    // Si es el primer producto, marcarlo principal
    const esPrimero = productosSel.value.length === 0;
    productosSel.value.push({ prod_id: prodId, es_principal: esPrimero, nota: null });
  }
}

function marcarPrincipal(prodId) {
  // Desmarcar los demás, marcar este
  productosSel.value = productosSel.value.map(p => ({
    ...p,
    es_principal: p.prod_id === prodId
  }));
}

const productosCambiaron = computed(() => {
  if (productosSel.value.length !== productosOriginales.value.length) return true;
  const orig = new Map(productosOriginales.value.map(p => [p.prod_id, p.es_principal]));
  for (const p of productosSel.value) {
    if (!orig.has(p.prod_id)) return true;
    if (orig.get(p.prod_id) !== p.es_principal) return true;
  }
  return false;
});

async function submit() {
  if (!form.value.gest_resultado_id) {
    toast.warning('Selecciona un resultado'); return;
  }
  if (requiereFecha.value && !form.value.gest_prox_fecha) {
    toast.warning('Este resultado requiere agendar próxima gestión'); return;
  }
  // Validar máx 1 principal
  const principales = productosSel.value.filter(p => p.es_principal).length;
  if (principales > 1) {
    toast.warning('Solo puede haber un producto principal'); return;
  }
  saving.value = true;
  try {
    // 1) Si los productos cambiaron, guardarlos primero
    if (productosCambiaron.value) {
      await prospectosApi.actualizarProductos(props.prospecto.prosp_id, productosSel.value);
      toast.info(`Productos actualizados (${productosSel.value.length})`);
    }

    // 2) Registrar gestión
    const payload = {
      gest_prosp_id: props.prospecto.prosp_id,
      gest_canal: form.value.gest_canal,
      gest_resultado_id: parseInt(form.value.gest_resultado_id),
      gest_estado_nuevo_id: form.value.gest_estado_nuevo_id ? parseInt(form.value.gest_estado_nuevo_id) : null,
      gest_comentario: form.value.gest_comentario || null,
      gest_duracion_seg: form.value.gest_duracion_seg || null,
      gest_prox_fecha: form.value.gest_prox_fecha || null,
      gest_prox_hora:  form.value.gest_prox_hora || null
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
  <BaseModal :open="open" title="Registrar gestión" max-width="max-w-xl" @close="emit('close')">
    <div v-if="prospecto?.persona" class="mb-4 pb-3 border-b border-text3/10">
      <div class="text-xs text-text3">Sobre el prospecto:</div>
      <div class="font-semibold text-text1">
        {{ prospecto.persona.persona_nombre }} {{ prospecto.persona.persona_apellido || '' }}
      </div>
      <div class="text-xs text-text3">{{ prospecto.persona.persona_telefono_principal }}</div>
    </div>

    <form @submit.prevent="submit" class="space-y-4">
      <BaseSelect v-model="form.gest_canal"    label="Canal"     :options="opcCanales"   required />
      <BaseSelect v-model="form.gest_resultado_id" label="Resultado *" :options="opcResultados" required />
      <BaseSelect v-model="form.gest_estado_nuevo_id" label="Cambiar estado a..." :options="opcEstados" />

      <BaseTextarea v-model="form.gest_comentario" label="Comentario / observaciones" rows="3" />

      <div v-if="form.gest_canal === 'llamada'" class="grid grid-cols-2 gap-3">
        <BaseInput v-model.number="form.gest_duracion_seg" label="Duración (segundos)" type="number" inputmode="numeric" placeholder="120" />
      </div>

      <div v-if="requiereFecha" class="sv-card border border-warning/40 bg-warning/5 p-3">
        <div class="text-xs text-warning font-semibold mb-2">⚠️ Este resultado requiere próxima gestión</div>
        <div class="grid grid-cols-2 gap-3">
          <BaseInput v-model="form.gest_prox_fecha" label="Fecha" type="date" required />
          <BaseInput v-model="form.gest_prox_hora"  label="Hora"  type="time" />
        </div>
      </div>

      <!-- Editor de productos de interés -->
      <div class="border-t border-text3/10 pt-3">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-sm font-semibold text-text1">🛒 Productos de interés</div>
            <div class="text-xs text-text3">
              {{ productosSel.length }} seleccionado{{ productosSel.length === 1 ? '' : 's' }}
              <span v-if="productosCambiaron" class="text-warning font-semibold ml-1">· hay cambios sin guardar</span>
            </div>
          </div>
          <button type="button"
                  class="text-xs text-area-emp underline hover:text-brown-warm"
                  @click="editandoProductos = !editandoProductos">
            {{ editandoProductos ? 'Ocultar' : 'Editar' }}
          </button>
        </div>

        <!-- Vista compacta cuando no se edita -->
        <div v-if="!editandoProductos && productosSel.length" class="flex flex-wrap gap-1.5">
          <span v-for="p in productosSel" :key="p.prod_id"
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="p.es_principal ? 'bg-gold text-white' : 'bg-cream border border-text3/30 text-text2'">
            <span v-if="p.es_principal">⭐ </span>
            {{ productosDisponibles.find(pr => pr.prod_id === p.prod_id)?.prod_nombre || `#${p.prod_id}` }}
          </span>
        </div>
        <div v-if="!editandoProductos && !productosSel.length" class="text-xs text-text3 italic">
          Sin productos registrados
        </div>

        <!-- Editor expandido -->
        <div v-if="editandoProductos" class="space-y-2 max-h-56 overflow-y-auto pr-1">
          <p class="text-xs text-text3 mb-2">
            Marca los productos de interés del cliente. Marca la estrella ⭐ del producto principal.
          </p>
          <label v-for="prod in productosDisponibles" :key="prod.prod_id"
                 class="flex items-center gap-2 p-2 rounded-sv hover:bg-cream/40 cursor-pointer transition-colors">
            <input type="checkbox"
                   :checked="estaSeleccionado(prod.prod_id)"
                   @change="toggleProducto(prod.prod_id)"
                   class="w-4 h-4 accent-gold" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text1 truncate">{{ prod.prod_nombre }}</div>
              <div class="text-xs text-text3">
                {{ prod.prod_categoria || 'Sin categoría' }}
                <span v-if="prod.prod_precio_base">· {{ new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(prod.prod_precio_base) }}</span>
              </div>
            </div>
            <button v-if="estaSeleccionado(prod.prod_id)"
                    type="button"
                    @click.prevent="marcarPrincipal(prod.prod_id)"
                    class="shrink-0 px-2 py-1 rounded text-xs font-bold transition-colors"
                    :class="esPrincipal(prod.prod_id)
                      ? 'bg-gold text-white'
                      : 'bg-cream border border-text3/30 text-text3 hover:text-gold'"
                    :title="esPrincipal(prod.prod_id) ? 'Es principal' : 'Marcar principal'">
              ⭐
            </button>
          </label>
        </div>
      </div>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="saving" @click="submit">Registrar</BaseButton>
    </template>
  </BaseModal>
</template>
