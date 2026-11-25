<script setup>
/**
 * ProductosVendidos.vue — qué se vendió, cuánto y a qué precio.
 * Props: modelValue (líneas de utils/ventas), productos (catálogo activo del área),
 *        porDefinir (nombres de intereses sin producto exacto).
 */
import { computed } from 'vue';
import { fmtCOP } from '@/utils/format';
import { agruparProductos } from '@/utils/catalogoProductos';
import { lineaDe, subtotal, totalVenta } from '@/utils/ventas';
import CampoPesos from '@/components/ui/CampoPesos.vue';

const props = defineProps({
  modelValue: { type: Array, required: true },
  productos:  { type: Array, required: true },
  porDefinir: { type: Array, default: () => [] }
});
const emit = defineEmits(['update:modelValue']);

const total = computed(() => totalVenta(props.modelValue));

// Lo que se puede agregar: productos exactos que aún no están en la lista.
const grupos = computed(() => {
  const puestos = new Set(props.modelValue.map((l) => l.prod_id));
  return agruparProductos(props.productos.filter((p) => !p.prod_es_generico && !puestos.has(p.prod_id)))
    .flatMap((g) => g.tipos.map((t) => ({ titulo: `${g.categoria} › ${t.tipo}`, productos: t.productos })));
});

function cambiar(prodId, datos) {
  emit('update:modelValue', props.modelValue.map((l) => (l.prod_id === prodId ? { ...l, ...datos } : l)));
}

function cambiarCantidad(prodId, texto) {
  const digitos = texto.replace(/\D/g, '').slice(0, 3);
  cambiar(prodId, { cantidad: digitos ? Number(digitos) : null });
}

function agregar(e) {
  const p = props.productos.find((x) => x.prod_id === Number(e.target.value));
  e.target.value = '';
  if (p) emit('update:modelValue', [...props.modelValue, lineaDe(p)]);
}
</script>

<template>
  <div class="space-y-2">
    <p v-if="porDefinir.length" data-testid="por-definir" class="text-xs text-warning">
      Falta definir: {{ porDefinir.join(', ') }}. Agrega abajo el producto exacto que se vendió.
    </p>
    <p v-if="!modelValue.length" class="text-xs text-text3 italic">Agrega los productos que se vendieron.</p>

    <div v-for="l in modelValue" :key="l.prod_id" :data-testid="`linea-${l.prod_id}`"
         class="rounded-sv border px-2 py-2" :class="l.vendido ? 'border-gold/40 bg-gold/5' : 'border-text3/20'">
      <label class="flex items-start gap-2 text-sm text-text1 cursor-pointer">
        <input type="checkbox" class="mt-0.5 w-4 h-4 accent-gold" :checked="l.vendido"
               :data-testid="`vendido-${l.prod_id}`" @change="cambiar(l.prod_id, { vendido: $event.target.checked })" />
        <span class="flex-1 min-w-0">{{ l.nombre }}</span>
        <span v-if="!l.vendido" class="text-xs text-text3 whitespace-nowrap">no se vendió</span>
      </label>
      <div v-if="l.vendido" class="mt-2 grid grid-cols-[4rem_1fr] sm:grid-cols-[4rem_10rem_1fr] gap-2 items-center">
        <input type="text" inputmode="numeric" autocomplete="off" class="sv-input text-center" :value="l.cantidad ?? ''"
               :aria-label="`Cantidad de ${l.nombre}`" :data-testid="`cantidad-${l.prod_id}`"
               @input="cambiarCantidad(l.prod_id, $event.target.value)" @keydown.enter.prevent />
        <CampoPesos :model-value="l.precio_unitario" :etiqueta="`Precio por unidad de ${l.nombre}`"
                    :data-testid="`precio-${l.prod_id}`" @update:model-value="cambiar(l.prod_id, { precio_unitario: $event })" />
        <span :data-testid="`subtotal-${l.prod_id}`"
              class="col-span-2 sm:col-span-1 text-right text-sm font-semibold text-text1 whitespace-nowrap">{{ fmtCOP(subtotal(l)) }}</span>
      </div>
    </div>

    <select data-testid="agregar-producto" aria-label="Agregar otro producto" class="sv-input" @change="agregar">
      <option value="">+ Agregar otro producto…</option>
      <optgroup v-for="g in grupos" :key="g.titulo" :label="g.titulo">
        <option v-for="p in g.productos" :key="p.prod_id" :value="p.prod_id">{{ p.prod_nombre }}</option>
      </optgroup>
    </select>

    <div class="flex items-center justify-between border-t border-text3/15 pt-2">
      <span class="text-sm font-semibold text-text1">Total de la venta</span>
      <span data-testid="total-venta" class="text-lg font-bold text-sage">{{ fmtCOP(total) }}</span>
    </div>
  </div>
</template>
