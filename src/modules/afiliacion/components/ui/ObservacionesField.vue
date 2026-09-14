<script setup>
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'

const props = defineProps({
  uppercase: { type: Boolean, default: true },
  rows: { type: [Number, String], default: 3 },
  placeholder: { type: String, default: 'Observaciones adicionales sobre el registro...' },
  legend: { type: String, default: 'Observaciones' }
})

const store = useAfiliadoStore()

function onInput(e) {
  const val = props.uppercase ? e.target.value.toUpperCase() : e.target.value
  store.afiliado.observaciones = val
}
</script>

<template>
  <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    <legend class="text-base font-bold text-gray-800 px-2">{{ legend }}</legend>

    <div class="mt-2">
      <textarea
        :value="store.afiliado.observaciones"
        :rows="rows"
        :placeholder="placeholder"
        @input="onInput"
        class="block w-full rounded-lg border border-gray-300 shadow-sm text-sm px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors resize-y"
        :class="{ 'uppercase': uppercase }"
      />
    </div>
  </fieldset>
</template>
