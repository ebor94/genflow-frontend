<script setup>
/**
 * SelectorProductos.vue — elegir el interés del cliente por categoría, tipo y producto.
 * Props: modelValue [{ prod_id, es_principal, nota }], productos (catálogo activo del área),
 *        actuales (filas pp del prospecto con su producto: dan el precio ya ofrecido y el
 *        nombre de los productos inactivos).
 * El precio es informativo: el que se guarda lo pone el servidor.
 */
import { ref, computed } from 'vue';
import { fmtCOP } from '@/utils/format';
import {
  agruparProductos, filtrarGrupos, alternarInteres, marcarPrincipalEn, precioDe
} from '@/utils/catalogoProductos';

const props = defineProps({
  modelValue: { type: Array, required: true },
  productos:  { type: Array, required: true },
  actuales:   { type: Array, default: () => [] }
});
const emit = defineEmits(['update:modelValue']);

const texto = ref('');
const abierta = ref(null); // categoría abierta

const grupos = computed(() => agruparProductos(props.productos));
const visibles = computed(() => filtrarGrupos(grupos.value, texto.value));
const buscando = computed(() => texto.value.trim().length > 0);
const porId = computed(() => new Map(props.productos.map((p) => [p.prod_id, p])));
const guardados = computed(() => new Map(props.actuales.map((a) => [a.pp_prod_id, a])));
const elegidosIds = computed(() => new Set(props.modelValue.map((s) => s.prod_id)));

const elegidos = computed(() => props.modelValue.map((s) => {
  const guardado = guardados.value.get(s.prod_id);
  const p = porId.value.get(s.prod_id) || guardado?.producto || null;
  const precio = guardado ? (p?.prod_tipo ? precioDe(guardado.pp_precio_ofrecido) : null) : precioDe(p?.prod_precio_base);
  return {
    ...s,
    nombre: p?.prod_nombre || 'Producto no disponible',
    detalle: p?.prod_es_generico ? 'por definir' : (precio ? fmtCOP(precio) : ''),
    nota_producto: p?.prod_descripcion || ''
  };
}));

function estaAbierta(categoria) { return buscando.value || abierta.value === categoria; }
function alternarCategoria(categoria) { abierta.value = abierta.value === categoria ? null : categoria; }
function alternar(producto) { emit('update:modelValue', alternarInteres(props.modelValue, producto, props.productos)); }
function quitar(prodId) { alternar({ prod_id: prodId }); }
function marcarPrincipal(prodId) { emit('update:modelValue', marcarPrincipalEn(props.modelValue, prodId)); }
function precioTexto(p) { const n = precioDe(p.prod_precio_base); return n ? fmtCOP(n) : ''; }
</script>

<template>
  <div class="space-y-2">
    <ul data-testid="elegidos" class="space-y-1.5">
      <li v-if="!elegidos.length" class="text-xs text-text3 italic">Sin elegir</li>
      <li v-for="e in elegidos" :key="e.prod_id"
          class="flex items-start gap-2 rounded-sv border px-2 py-1.5 text-sm"
          :class="e.es_principal ? 'border-gold bg-gold/10' : 'border-text3/30 bg-cream'">
        <button type="button" :data-testid="`principal-${e.prod_id}`" class="shrink-0 leading-none pt-0.5"
                :class="e.es_principal ? 'text-gold' : 'text-text3 hover:text-gold'"
                :aria-label="e.es_principal ? 'Es el principal' : 'Marcar como principal'"
                @click="marcarPrincipal(e.prod_id)">{{ e.es_principal ? '★' : '☆' }}</button>
        <div class="flex-1 min-w-0">
          <div class="text-text1">{{ e.nombre }}<span v-if="e.detalle" class="text-text3"> · {{ e.detalle }}</span></div>
          <div v-if="e.nota_producto" class="text-xs text-text3">{{ e.nota_producto }}</div>
        </div>
        <button type="button" :data-testid="`quitar-${e.prod_id}`" class="shrink-0 text-text3 hover:text-danger leading-none pt-0.5"
                aria-label="Quitar" @click="quitar(e.prod_id)">✕</button>
      </li>
    </ul>

    <input v-model="texto" type="text" aria-label="Buscar producto" placeholder="Osario A2, cremación plus…"
           class="w-full rounded-sv border border-text3/30 px-3 py-2 text-sm" @keydown.enter.prevent />

    <p v-if="!visibles.length" class="text-xs text-text3">Ningún producto coincide. Prueba con otra palabra.</p>

    <div v-else class="max-h-72 overflow-y-auto pr-1">
      <section v-for="g in visibles" :key="g.categoria" class="border-t border-text3/10 first:border-t-0">
        <button type="button" data-testid="categoria" :aria-expanded="estaAbierta(g.categoria) ? 'true' : 'false'"
                :disabled="buscando"
                class="w-full flex items-center justify-between py-2 text-sm font-semibold text-text1 text-left"
                @click="alternarCategoria(g.categoria)">{{ g.categoria }}<svg v-if="!buscando" aria-hidden="true" class="shrink-0 transition-transform" :class="estaAbierta(g.categoria) ? 'rotate-90' : ''" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
        <div v-if="estaAbierta(g.categoria)" class="pb-2">
          <div v-for="t in g.tipos" :key="t.tipo" class="mb-1">
            <button v-if="t.generico" type="button" :data-testid="`producto-${t.generico.prod_id}`"
                    :aria-pressed="elegidosIds.has(t.generico.prod_id) ? 'true' : 'false'"
                    class="w-full flex justify-between gap-3 rounded-sv px-2 py-1.5 text-sm text-left font-semibold"
                    :class="elegidosIds.has(t.generico.prod_id) ? 'bg-gold/15 text-gold' : 'hover:bg-cream/40 text-text1'"
                    @click="alternar(t.generico)">
              <span>{{ t.tipo }}</span> <span class="text-xs font-normal text-text3 whitespace-nowrap">por definir</span>
            </button>
            <div v-else class="px-2 py-1 text-xs font-semibold text-text3">{{ t.tipo }}</div>
            <button v-for="p in t.productos" :key="p.prod_id" type="button" :data-testid="`producto-${p.prod_id}`"
                    :aria-pressed="elegidosIds.has(p.prod_id) ? 'true' : 'false'"
                    class="w-full flex justify-between gap-3 rounded-sv pl-5 pr-2 py-1.5 text-sm text-left"
                    :class="elegidosIds.has(p.prod_id) ? 'bg-gold/15 text-gold' : 'hover:bg-cream/40 text-text2'"
                    @click="alternar(p)">
              <span>{{ p.prod_nombre }}</span> <span v-if="precioTexto(p)" class="text-xs text-text3 whitespace-nowrap">{{ precioTexto(p) }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
