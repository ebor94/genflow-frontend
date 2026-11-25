<script setup>
/**
 * CambiarVentaModal.vue — el supervisor corrige o anula una venta, con motivo.
 * Props: venta (fila de la API, o null = cerrada), modo 'corregir' | 'anular', productos.
 * Emits: close, cambiada.
 */
import { ref, computed, watch } from 'vue';
import { ventasApi } from '@/api/ventasApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { errorVenta, itemsVenta, lineasDeVenta, diaVenta } from '@/utils/ventas';
import { fmtCOP, fmtFecha } from '@/utils/format';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';

const props = defineProps({
  venta: { type: Object, default: null },
  modo: { type: String, default: 'corregir' },
  productos: { type: Array, default: () => [] }
});
const emit = defineEmits(['close', 'cambiada']);

const toast = useToastStore();
const { notify } = useApiError();
const lineas = ref([]);
const motivo = ref('');
const guardando = ref(false);
const anula = computed(() => props.modo === 'anular');

// Al cerrar, venta pasa a null antes de que termine la transición: se sigue pintando la última.
const ultima = ref(null);
watch(() => [props.venta, props.modo], () => {
  if (!props.venta) return;
  ultima.value = props.venta;
  lineas.value = lineasDeVenta(props.venta);
  motivo.value = '';
}, { immediate: true });

async function guardar() {
  if (!props.venta) return; // ya se está cerrando
  const falta = anula.value ? '' : errorVenta(lineas.value);
  if (falta) { toast.warning(falta); return; }
  if (motivo.value.trim().length < 3) { toast.warning('Escribe el motivo'); return; }

  if (motivo.value.trim().length > 250) { toast.warning('El motivo no puede pasar de 250 caracteres'); return; }

  const datos = { motivo: motivo.value.trim(), cambios_vistos: (props.venta.cambios || []).length };
  guardando.value = true;
  try {
    if (anula.value) await ventasApi.anular(props.venta.venta_id, datos);
    else await ventasApi.corregir(props.venta.venta_id, { items: itemsVenta(lineas.value), ...datos });
    toast.success(anula.value ? 'Venta anulada' : 'Venta corregida');
    emit('cambiada');
    emit('close');
  } catch (e) {
    notify(e);
    // Otra persona la cambió: se recarga la lista para que vea el valor actual.
    if (e?.response?.status === 409) { emit('cambiada'); emit('close'); }
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <BaseModal :open="!!venta" :title="anula ? 'Anular venta' : 'Corregir venta'" max-width="max-w-xl" @close="emit('close')">
    <div v-if="ultima" class="space-y-4">
      <p class="text-sm text-text2">
        Venta del {{ fmtFecha(diaVenta(ultima)) }} por <strong>{{ fmtCOP(Number(ultima.venta_total)) }}</strong>.
      </p>
      <p v-if="anula" class="text-sm text-warning">
        Dejará de sumar y de contar como contrato. El estado del cliente no cambia: si vuelve a proceso, registra una gestión.
      </p>
      <ProductosVendidos v-else v-model="lineas" :productos="productos" />
      <BaseTextarea v-model="motivo" label="Motivo *" rows="2" />
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton :variant="anula ? 'danger' : 'primary'" :loading="guardando" @click="guardar">
        {{ anula ? 'Anular venta' : 'Guardar corrección' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
