<script setup>
defineProps({ modelValue: Boolean })
defineEmits(['update:modelValue'])
</script>

<template>
  <div
    class="flex items-start gap-3 p-4 rounded-lg border transition-colors"
    :class="modelValue ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'"
  >
    <input
      id="aceptacion-datos"
      type="checkbox"
      :checked="modelValue"
      @change="$emit('update:modelValue', $event.target.checked)"
      class="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer flex-shrink-0 accent-green-600"
    />
    <label for="aceptacion-datos" class="text-sm text-gray-700 cursor-pointer leading-relaxed select-none">
     Declaro que conozco mis derechos a actualizar, rectificar, suprimir y consultar mis datos personales entregados a Serfunorte, y que los mismos serán tratados conforme a los lineamientos establecidos
      en la política de privacidad que se puede consultar en el sitio web https://cucuta.losolivos.co , Autorizo el
    
      <a
        href="https://cucuta.losolivos.co/politica-privacidad/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-green-700 underline font-medium hover:text-green-900"
        @click.stop
      >
        tratamiento de datos personales
      </a>
      conforme a la política de privacidad de Los Olivos Cúcuta / Serfunorte.
      <span class="text-red-500 font-semibold ml-0.5">*</span>
    </label>
  </div>
</template>
