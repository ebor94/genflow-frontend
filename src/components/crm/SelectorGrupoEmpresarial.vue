<script setup>
/**
 * SelectorGrupoEmpresarial.vue
 * Typeahead para seleccionar un grupo empresarial (Grupo Éxito, etc.).
 * Si el nombre escrito no existe, ofrece "+ Crear" inline que llama al
 * backend (findOrCreate). Devuelve el id seleccionado vía v-model.
 *
 *   <SelectorGrupoEmpresarial v-model="empresa.empresa_grupo_empresarial_id" />
 */
import { ref, watch, onMounted } from 'vue';
import { gruposEmpresarialesApi } from '@/api/categorizacionApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({
  modelValue: { type: [Number, null], default: null },
  label: { type: String, default: 'Grupo empresarial (opcional)' },
  placeholder: { type: String, default: 'Buscar o escribir nombre nuevo…' }
});
const emit = defineEmits(['update:modelValue']);

const toast = useToastStore();

const texto         = ref('');
const opciones      = ref([]);
const seleccionado  = ref(null);
const cargando      = ref(false);
const creando       = ref(false);
const dropdownOpen  = ref(false);

let debounceId = null;
function buscar(q) {
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(async () => {
    cargando.value = true;
    try {
      const r = await gruposEmpresarialesApi.list({ q, limit: 20 });
      opciones.value = r.data || r || [];
    } catch (_) {
      opciones.value = [];
    } finally {
      cargando.value = false;
    }
  }, 250);
}

function seleccionar(g) {
  seleccionado.value = g;
  texto.value = g.grupemp_nombre;
  dropdownOpen.value = false;
  emit('update:modelValue', g.grupemp_id);
}

function limpiar() {
  seleccionado.value = null;
  texto.value = '';
  opciones.value = [];
  emit('update:modelValue', null);
}

async function crearAlVuelo() {
  const nombre = texto.value.trim();
  if (nombre.length < 2) return;
  creando.value = true;
  try {
    const r = await gruposEmpresarialesApi.findOrCreate(nombre);
    const { grupo, creado } = r.data || r;
    seleccionar(grupo);
    toast[creado ? 'success' : 'info'](
      creado ? `Grupo "${grupo.grupemp_nombre}" creado` : `Reutilizado grupo existente "${grupo.grupemp_nombre}"`
    );
  } catch (e) {
    toast.error(e.response?.data?.message || 'No se pudo crear el grupo');
  } finally {
    creando.value = false;
  }
}

watch(texto, (v) => {
  if (seleccionado.value && v !== seleccionado.value.grupemp_nombre) {
    seleccionado.value = null;
    emit('update:modelValue', null);
  }
  if (v && v.length >= 1) {
    dropdownOpen.value = true;
    buscar(v);
  } else {
    opciones.value = [];
  }
});

// Si el padre pasa un id inicial, lo hidratamos
onMounted(async () => {
  if (props.modelValue) {
    try {
      const r = await gruposEmpresarialesApi.list({ limit: 200 });
      const lista = r.data || r || [];
      const g = lista.find(x => x.grupemp_id === props.modelValue);
      if (g) { seleccionado.value = g; texto.value = g.grupemp_nombre; }
    } catch (_) { /* silent */ }
  }
});

watch(() => props.modelValue, (v) => {
  if (!v) { texto.value = ''; seleccionado.value = null; }
});

const noMatchPerfecto = () =>
  texto.value.trim().length >= 2 &&
  !opciones.value.some(o => o.grupemp_nombre.toLowerCase() === texto.value.trim().toLowerCase());
</script>

<template>
  <div class="relative">
    <label class="sv-label">{{ label }}</label>
    <div class="relative">
      <input
        v-model="texto"
        type="text"
        :placeholder="placeholder"
        @focus="dropdownOpen = true"
        @blur="setTimeout(() => dropdownOpen = false, 200)"
        class="w-full px-3 py-2 text-sm border border-text3/40 rounded-sv focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
      />
      <button
        v-if="seleccionado"
        type="button"
        @click="limpiar"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-text3 hover:text-danger text-lg leading-none"
        title="Limpiar"
      >×</button>
    </div>

    <div v-if="dropdownOpen && (cargando || opciones.length || noMatchPerfecto())"
         class="absolute z-20 mt-1 w-full bg-white border border-text3/30 rounded-sv shadow-sv-pop max-h-60 overflow-auto">
      <div v-if="cargando" class="px-3 py-2 text-xs text-text3">Buscando…</div>
      <button
        v-for="g in opciones" :key="g.grupemp_id"
        type="button"
        @mousedown.prevent="seleccionar(g)"
        class="w-full text-left px-3 py-2 text-sm hover:bg-cream border-b border-text3/10 last:border-b-0"
      >
        {{ g.grupemp_nombre }}
      </button>
      <button
        v-if="!cargando && noMatchPerfecto()"
        type="button"
        :disabled="creando"
        @mousedown.prevent="crearAlVuelo"
        class="w-full text-left px-3 py-2 text-sm bg-gold/10 hover:bg-gold/20 text-brown-deep font-semibold border-t border-gold/30"
      >
        {{ creando ? '⏳ Creando…' : `+ Crear "${texto.trim()}"` }}
      </button>
    </div>
  </div>
</template>
