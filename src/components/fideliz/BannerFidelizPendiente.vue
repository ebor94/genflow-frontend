<script setup>
/**
 * BannerFidelizPendiente.vue
 *
 * Banner CTA en FichaEmpresa que invita al asesor B2B a capturar contactos
 * para fidelización. Se muestra cuando hay convenio firmado pero aún no
 * existen contactos de fidelización.
 */
defineProps({
  contactosCount: { type: Number, required: true }
});
defineEmits(['agregar']);
</script>

<template>
  <div v-if="contactosCount === 0"
       class="rounded-sv border border-warning/40 bg-warning/5 p-4 mb-4 flex items-start gap-3">
    <div class="text-2xl">💝</div>
    <div class="flex-1">
      <div class="font-semibold text-warning">Captura contactos para fidelización</div>
      <p class="text-sm text-text2 mt-1">
        Esta empresa firmó convenio con Serfunorte. Ingresa los contactos clave
        (gerencia, RRHH, contacto contable…) con sus fechas especiales para que
        el equipo de Fidelización pueda enviar detalles en cumpleaños, día de la
        madre/padre, aniversario laboral, etc.
      </p>
      <button type="button"
              class="mt-2 px-3 py-1.5 rounded-sv bg-warning text-white text-xs font-semibold hover:opacity-90"
              @click="$emit('agregar')">
        + Agregar primer contacto
      </button>
    </div>
  </div>
</template>
