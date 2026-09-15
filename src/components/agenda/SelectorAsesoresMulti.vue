<template>
  <div class="relative">
    <button type="button"
            class="w-full text-left px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-slate-400 flex items-center justify-between gap-2"
            @click="abierto = !abierto">
      <span class="text-slate-700 truncate">
        {{ etiqueta }}
      </span>
      <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 8l4 4 4-4"/>
      </svg>
    </button>

    <div v-if="abierto"
         class="absolute z-30 mt-1 w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col">
      <div class="p-2 border-b">
        <input v-model="filtro" type="text" placeholder="Buscar asesor..."
               class="w-full py-1.5 px-2 text-sm border border-gray-200 rounded" />
      </div>
      <div class="p-2 border-b bg-slate-50">
        <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" :checked="todosSel" @change="toggleTodos" />
          <span class="text-slate-700">Todos ({{ usuariosVisibles.length }})</span>
        </label>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <label v-for="u in usuariosVisibles" :key="u.usr_id"
               class="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer text-sm">
          <input type="checkbox" :checked="seleccionados.includes(u.usr_id)"
                 @change="toggle(u.usr_id)" />
          <span class="text-slate-700">{{ nombre(u) }}</span>
          <span v-if="u.rol?.rol_codigo" class="text-xs text-slate-400 ml-auto">{{ u.rol.rol_codigo }}</span>
        </label>
      </div>
      <div class="p-2 border-t bg-slate-50 text-right">
        <button type="button" class="text-xs text-slate-500 hover:text-slate-700 mr-2"
                @click="limpiar">Limpiar</button>
        <button type="button" class="text-xs px-3 py-1 bg-green-700 hover:bg-green-800 text-white rounded"
                @click="abierto = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usuariosApi } from '@/api/usuariosApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ modelValue: { type: Array, default: () => [] } });
const emit  = defineEmits(['update:modelValue']);
const toast = useToastStore();

const usuarios = ref([]);
const abierto  = ref(false);
const filtro   = ref('');

const seleccionados = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const usuariosVisibles = computed(() => {
  const f = filtro.value.trim().toLowerCase();
  if (!f) return usuarios.value;
  return usuarios.value.filter(u => nombre(u).toLowerCase().includes(f));
});

const todosSel = computed(() =>
  usuariosVisibles.value.length > 0 &&
  usuariosVisibles.value.every(u => seleccionados.value.includes(u.usr_id))
);

const etiqueta = computed(() => {
  const n = seleccionados.value.length;
  if (n === 0)                        return 'Todos los asesores';
  if (n === 1) {
    const u = usuarios.value.find(x => x.usr_id === seleccionados.value[0]);
    return u ? nombre(u) : `1 asesor`;
  }
  return `${n} asesores seleccionados`;
});

function nombre(u) {
  const n = `${u.usr_nombre || ''} ${u.usr_apellido || ''}`.trim();
  if (n) return n;
  if (u.usr_email) return u.usr_email.split('@')[0];
  return `Usuario #${u.usr_id}`;
}

function toggle(id) {
  const arr = [...seleccionados.value];
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(id);
  seleccionados.value = arr;
}

function toggleTodos() {
  if (todosSel.value) {
    // Deseleccionar los visibles
    seleccionados.value = seleccionados.value.filter(id => !usuariosVisibles.value.find(u => u.usr_id === id));
  } else {
    const nuevos = usuariosVisibles.value.map(u => u.usr_id);
    seleccionados.value = [...new Set([...seleccionados.value, ...nuevos])];
  }
}

function limpiar() { seleccionados.value = []; }

onMounted(async () => {
  try {
    const r = await usuariosApi.list({ activo: 1, limit: 200 });
    usuarios.value = r.data || r;
  } catch (e) {
    toast.error('No se pudieron cargar los asesores');
  }
});
</script>
