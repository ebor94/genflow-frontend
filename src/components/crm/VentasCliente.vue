<script setup>
/**
 * VentasCliente.vue — tarjeta "Ventas" de la ficha. No se muestra si el cliente no tiene.
 * Props: prospId, productos (catálogo del área), puedeCorregir, version (al cambiar, recarga).
 */
import { ref, watch } from 'vue';
import { ventasApi } from '@/api/ventasApi';
import { useApiError } from '@/composables/useApiError';
import { fmtCOP, fmtFecha } from '@/utils/format';
import BaseButton from '@/components/ui/BaseButton.vue';
import CambiarVentaModal from '@/components/crm/CambiarVentaModal.vue';

const props = defineProps({
  prospId: { type: Number, required: true },
  productos: { type: Array, default: () => [] },
  puedeCorregir: { type: Boolean, default: false },
  version: { type: Number, default: 0 }
});

const { notify } = useApiError();
const ventas = ref([]);
const enCambio = ref(null);
const modo = ref('corregir');

async function cargar() {
  const id = props.prospId;
  try {
    const r = await ventasApi.deProspecto(id);
    if (id === props.prospId) ventas.value = r.data || [];
  } catch (e) {
    if (id === props.prospId) ventas.value = [];
    // La tarjeta es auxiliar: si no puede ver las ventas de este cliente, simplemente no aparece.
    if (![403, 404].includes(e?.response?.status)) notify(e);
  }
}
watch(() => [props.prospId, props.version], cargar, { immediate: true });

function abrir(venta, queModo) { modo.value = queModo; enCambio.value = venta; }
const persona = (u) => [u?.usr_nombre, u?.usr_apellido].filter(Boolean).join(' ') || '—';
const anulacion = (v) => (v.cambios || []).find((c) => c.vc_accion === 'anular');
const correcciones = (v) => (v.cambios || []).filter((c) => c.vc_accion === 'corregir');
</script>

<template>
  <section v-if="ventas.length" data-testid="ventas" class="sv-card p-4 mb-4">
    <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">🧾 Ventas</h3>
    <article v-for="v in ventas" :key="v.venta_id" :data-testid="`venta-${v.venta_id}`"
             class="py-3 border-t border-text3/10 first:border-t-0 first:pt-0" :class="{ 'opacity-60': v.venta_anulada }">
      <div class="flex items-baseline justify-between gap-3">
        <div class="text-sm text-text2">{{ fmtFecha(v.venta_fecha) }} · {{ persona(v.asesor) }}</div>
        <div class="font-semibold whitespace-nowrap" :class="v.venta_anulada ? 'line-through text-text3' : 'text-sage'">{{ fmtCOP(Number(v.venta_total)) }}</div>
      </div>
      <ul class="text-xs text-text3 mt-1 space-y-0.5">
        <li v-for="i in v.items" :key="i.vi_id">{{ i.vi_cantidad }} × {{ i.producto?.prod_nombre || 'Producto no disponible' }} · {{ fmtCOP(Number(i.vi_precio_unitario)) }}</li>
      </ul>
      <p v-for="c in correcciones(v)" :key="c.vc_id" class="text-xs text-text3 mt-1">
        Corregida de {{ fmtCOP(Number(c.vc_total_antes)) }} a {{ fmtCOP(Number(c.vc_total_despues)) }}: {{ c.vc_motivo }} · {{ persona(c.usuario) }}, {{ fmtFecha(c.vc_created_at) }}
      </p>
      <p v-if="v.venta_anulada" data-testid="anulada" class="text-xs text-danger mt-1">
        Anulada<template v-if="anulacion(v)">: {{ anulacion(v).vc_motivo }} · {{ persona(anulacion(v).usuario) }}, {{ fmtFecha(anulacion(v).vc_created_at) }}</template>
      </p>
      <div v-else-if="puedeCorregir" class="flex justify-end gap-2 mt-2">
        <BaseButton variant="ghost" size="sm" @click="abrir(v, 'corregir')">Corregir</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="abrir(v, 'anular')">Anular</BaseButton>
      </div>
    </article>

    <CambiarVentaModal :venta="enCambio" :modo="modo" :productos="productos" @close="enCambio = null" @cambiada="cargar" />
  </section>
</template>
