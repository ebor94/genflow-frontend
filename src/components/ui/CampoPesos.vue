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
  const antes = formato(props.modelValue);
  let texto = campo.value;
  let cursor = campo.selectionStart ?? texto.length;
  // Solo se borró un separador: se borra el dígito de al lado. Si no, el punto vuelve a salir
  // y el cursor se traba.
  if (texto.length === antes.length - 1 && texto.replace(/\D/g, '') === antes.replace(/\D/g, '')) {
    if (e.inputType === 'deleteContentBackward' && cursor > 0) {
      texto = texto.slice(0, cursor - 1) + texto.slice(cursor);
      cursor -= 1;
    } else if (e.inputType === 'deleteContentForward') {
      texto = texto.slice(0, cursor) + texto.slice(cursor + 1);
    }
  }
  // En pesos la coma nunca es de miles (es-CO no la muestra) y solo separa decimales.
  // Lo que entra de una sola vez (pegar, soltar, sugerencia del teclado, autocompletar) puede traer
  // decimales al final ("8770000.00", "8.770.000,00 COP"): se descartan. Lo que se escribe tecla a
  // tecla o se borra no se toca, porque ahí un ".5" o una coma suelta son a medias, no decimales.
  const tipo = e.inputType || '';
  const entroDeUnaVez = tipo === 'insertText'
    ? (e.data || '').length > 1
    : !/^(delete|history|insertComposition)/.test(tipo);
  // Las comas se ignoran sin perder los dígitos de al lado ("8,770,000" son 8.770.000): el cursor
  // queda después del mismo dígito.
  let digitosAntes = null;
  if (texto.includes(',')) digitosAntes = texto.slice(0, cursor).replace(/\D/g, '').length;
  if (entroDeUnaVez) texto = texto.replace(/[.,]\d{1,2}\D*$/, '');
  if (digitosAntes !== null) {
    cursor = Math.max(0, cursor - (campo.value.slice(0, cursor).match(/,/g) || []).length);
    texto = texto.replace(/,/g, '');
  }
  cursor = Math.min(cursor, texto.length);
  let aLaDerecha = texto.slice(cursor).replace(/\D/g, '').length;
  const digitos = texto.replace(/\D/g, '').slice(0, MAX_DIGITOS);
  const valor = digitos ? Number(digitos) : null;

  campo.value = formato(valor);
  // El cursor queda delante de los mismos dígitos aunque se muevan los puntos.
  let pos = campo.value.length;
  while (pos > 0 && aLaDerecha > 0) {
    pos -= 1;
    if (/\d/.test(campo.value[pos])) aLaDerecha -= 1;
  }
  if (digitosAntes !== null) {
    // Tras ignorar la coma, el cursor queda justo después del mismo dígito.
    pos = 0;
    for (let vistos = 0; pos < campo.value.length && vistos < digitosAntes; pos++) {
      if (/\d/.test(campo.value[pos])) vistos += 1;
    }
  }
  campo.setSelectionRange(pos, pos);
  if (valor !== props.modelValue) emit('update:modelValue', valor);
}
</script>

<template>
  <span class="relative block">
    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-text3" aria-hidden="true">$</span>
    <input type="text" inputmode="numeric" autocomplete="off" :value="formato(modelValue)"
           :aria-label="etiqueta" :disabled="disabled" class="sv-input pl-6 text-right" @input="alEscribir" @keydown.enter.prevent />
  </span>
</template>
