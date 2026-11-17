<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { usuariosApi } from '@/api/usuariosApi';
import { useApiError } from '@/composables/useApiError';

const props = defineProps({
  modelValue: { type: String, default: '' },
  required:   { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'seleccionar']);
const { extract } = useApiError();

const MIN_CARACTERES = 3;
const ESPERA_MS = 300;

const texto = ref(props.modelValue || '');
const resultados = ref([]);
const cargando = ref(false);
const error = ref('');
let temporizador = null;

watch(() => props.modelValue, (v) => { if ((v || '') !== texto.value) texto.value = v || ''; });

function buscar() {
  clearTimeout(temporizador);
  error.value = '';
  const q = texto.value.trim();
  if (q.length < MIN_CARACTERES) { resultados.value = []; return; }
  temporizador = setTimeout(async () => {
    cargando.value = true;
    try {
      const r = await usuariosApi.directorio(q);
      resultados.value = r.data || [];
    } catch (e) {
      error.value = extract(e);
      resultados.value = [];
    } finally {
      cargando.value = false;
    }
  }, ESPERA_MS);
}

function onInput(e) {
  texto.value = e.target.value;
  emit('update:modelValue', texto.value.trim());
  buscar();
}

function elegir(item) {
  clearTimeout(temporizador);
  texto.value = item.usuario;
  resultados.value = [];
  emit('update:modelValue', item.usuario);
  emit('seleccionar', item);
}

onBeforeUnmount(() => clearTimeout(temporizador));
</script>

<template>
  <div class="relative">
    <label class="sv-label">
      Usuario de red
      <span v-if="required" class="text-danger ml-0.5">*</span>
    </label>
    <input
      :value="texto"
      type="text"
      class="sv-input"
      placeholder="Busca por nombre, usuario o correo"
      autocomplete="off"
      data-testid="buscador-usuario-red"
      @input="onInput"
    />
    <p v-if="cargando" class="mt-1 text-xs text-text3">Buscando en el directorio…</p>
    <p v-else-if="error" class="mt-1 text-xs text-danger">{{ error }}</p>
    <ul
      v-if="resultados.length"
      class="absolute z-10 mt-1 w-full max-h-60 overflow-auto sv-card divide-y divide-text3/10"
      data-testid="resultados-usuario-red"
    >
      <li v-for="r in resultados" :key="r.usuario">
        <button type="button" class="w-full text-left px-3 py-2 hover:bg-cream" @click="elegir(r)">
          <div class="text-sm font-semibold text-text1">{{ r.nombre || r.usuario }}</div>
          <div class="text-xs text-text3">{{ r.usuario }}<span v-if="r.mail"> · {{ r.mail }}</span></div>
        </button>
      </li>
    </ul>
  </div>
</template>
