<template>
  <div class="space-y-4">
    <div v-if="!evento.evento_registros_publicos_habilitado"
         class="text-sm text-text3 text-center py-6 bg-gray-50 rounded-lg">
      El link público no está habilitado para este evento.
      <span class="block mt-1 text-xs">
        Para eventos con link público, crea un nuevo evento marcando "Habilitar link público de registro"
        en el modal de creación. La edición inline llegará en una próxima entrega.
      </span>
    </div>
    <div v-else class="space-y-4">
      <div>
        <label class="text-xs font-medium text-text2">URL pública</label>
        <div class="mt-1 flex gap-2">
          <input :value="url" readonly
                 class="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-xs font-mono text-text2 bg-gray-50" />
          <button type="button" class="text-xs px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg"
                  @click="copiar">{{ copiado ? '✓ Copiado' : 'Copiar' }}</button>
          <a :href="url" target="_blank" rel="noopener"
             class="text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Abrir</a>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 p-4 bg-gray-50 text-xs text-text2 space-y-2">
        <p><strong class="text-text1">Cómo usarlo:</strong></p>
        <ul class="list-disc pl-4 space-y-1">
          <li>Comparte este link con las personas que quieres que se registren.</li>
          <li>Los registros aparecerán en la pestaña <em>Pool</em> para que los asignes a un asesor asistente.</li>
          <li>El link deja de funcionar automáticamente cuando pase <em>{{ fechaCierre }}</em>.</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ evento: { type: Object, required: true } });
const toast = useToastStore();
const copiado = ref(false);

const url = computed(() => {
  const hash = props.evento.evento_link_hash;
  if (!hash) return '';
  // window.location.origin funciona en producción y dev.
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/genflow/registro-evento/${hash}`;
});

const fechaCierre = computed(() => {
  const f = props.evento.evento_fecha_fin || props.evento.evento_fecha_hora;
  if (!f) return 'la fecha final';
  return new Date(f).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'
  });
});

async function copiar() {
  try {
    await navigator.clipboard.writeText(url.value);
    copiado.value = true;
    toast.success('Link copiado');
    setTimeout(() => copiado.value = false, 2000);
  } catch (e) {
    toast.error('No se pudo copiar');
  }
}
</script>
