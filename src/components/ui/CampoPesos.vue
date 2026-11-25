<script setup>
/**
 * CampoPesos.vue — valor en pesos con separador de miles.
 * v-model: entero, o null si está vacío. Es un campo de texto: la rueda no lo cambia.
 */
const props = defineProps({
  modelValue: { type: Number, default: null },
  etiqueta: { type: String, required: true }, // para lectores de pantalla
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const MAX_DIGITOS = 10;
const miles = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const formato = (n) => (n === null || n === undefined ? '' : miles.format(n));

function alEscribir(e) {
  const campo = e.target;
  const cursor = campo.selectionStart ?? campo.value.length;
  let aLaDerecha = campo.value.slice(cursor).replace(/\D/g, '').length;
  const digitos = campo.value.replace(/\D/g, '').slice(0, MAX_DIGITOS);
  const valor = digitos ? Number(digitos) : null;

  campo.value = formato(valor);
  // El cursor queda delante de los mismos dígitos aunque se muevan los puntos.
  let pos = campo.value.length;
  while (pos > 0 && aLaDerecha > 0) {
    pos -= 1;
    if (/\d/.test(campo.value[pos])) aLaDerecha -= 1;
  }
  campo.setSelectionRange(pos, pos);
  if (valor !== props.modelValue) emit('update:modelValue', valor);
}
</script>

<template>
  <span class="relative block">
    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-text3" aria-hidden="true">$</span>
    <input type="text" inputmode="numeric" autocomplete="off" :value="formato(modelValue)"
           :aria-label="etiqueta" :disabled="disabled" class="sv-input pl-6 text-right" @input="alEscribir" />
  </span>
</template>
