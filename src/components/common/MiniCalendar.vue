<script setup>
/**
 * MiniCalendar.vue
 * Calendario mini 7×N con dots de eventos.
 * Props:
 *   - modelValue (Date)
 *   - eventos: [{ fecha: 'YYYY-MM-DD', total, vencidas }]
 * Emits:
 *   - update:modelValue (fecha seleccionada)
 *   - month-change (anio, mes)
 */
import { ref, computed, watch } from 'vue';
import { useAgenda } from '@/composables/useAgenda';
const { matrizMes, dayjs } = useAgenda();

const props = defineProps({
  modelValue: { type: [Date, String], default: () => new Date() },
  eventos: { type: Array, default: () => [] }
});
const emit = defineEmits(['update:modelValue', 'month-change']);

const cursor = ref(dayjs(props.modelValue));
const seleccion = ref(dayjs(props.modelValue));

const matriz = computed(() => matrizMes(cursor.value.year(), cursor.value.month() + 1));
const tituloMes = computed(() => cursor.value.format('MMMM YYYY').replace(/^./, c => c.toUpperCase()));

const eventoMap = computed(() => {
  const m = new Map();
  for (const e of props.eventos) m.set(dayjs(e.fecha).format('YYYY-MM-DD'), e);
  return m;
});

function infoDia(d) {
  return eventoMap.value.get(d.format('YYYY-MM-DD'));
}

function mes(delta) {
  cursor.value = cursor.value.add(delta, 'month');
  emit('month-change', cursor.value.year(), cursor.value.month() + 1);
}

function seleccionar(d) {
  seleccion.value = d;
  emit('update:modelValue', d.toDate());
}

watch(() => props.modelValue, (v) => {
  if (v) { seleccion.value = dayjs(v); cursor.value = dayjs(v); }
});

const dias = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
</script>

<template>
  <div class="sv-card p-4">
    <header class="flex items-center justify-between mb-3">
      <button @click="mes(-1)" class="w-8 h-8 rounded-full hover:bg-cream text-text2" aria-label="Mes anterior">‹</button>
      <h3 class="text-base font-serif text-brown-deep">{{ tituloMes }}</h3>
      <button @click="mes(+1)" class="w-8 h-8 rounded-full hover:bg-cream text-text2" aria-label="Mes siguiente">›</button>
    </header>

    <div class="grid grid-cols-7 text-center text-[10px] text-text3 mb-1">
      <div v-for="d in dias" :key="d" class="py-1">{{ d }}</div>
    </div>

    <div class="grid grid-cols-7 gap-0.5">
      <button v-for="(cell, i) in matriz" :key="i"
              @click="seleccionar(cell.fecha)"
              class="relative aspect-square text-xs rounded-md transition-colors"
              :class="{
                'text-text3/40': !cell.mesActual,
                'text-text1':    cell.mesActual,
                'bg-gold/15 text-gold font-bold': cell.fecha.isSame(seleccion, 'day'),
                'ring-1 ring-gold': cell.fecha.isSame(dayjs(), 'day') && !cell.fecha.isSame(seleccion, 'day'),
                'hover:bg-cream': cell.mesActual
              }">
        <span>{{ cell.fecha.date() }}</span>
        <span v-if="infoDia(cell.fecha)?.vencidas > 0"
              class="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-danger"></span>
        <span v-else-if="infoDia(cell.fecha)?.total > 0"
              class="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-gold"></span>
      </button>
    </div>
  </div>
</template>
