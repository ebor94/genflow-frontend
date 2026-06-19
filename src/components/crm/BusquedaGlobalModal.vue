<script setup>
/**
 * BusquedaGlobalModal.vue — buscador global (Cmd+K).
 */
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { buscadorApi } from '@/api/buscadorApi';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import { abrirProspecto } from '@/utils/abrirProspecto';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';

const props = defineProps({ open: { type: Boolean, required: true } });
const emit = defineEmits(['close']);

const router = useRouter();
const { notify } = useApiError();
const { formato } = useTelefono();

const q = ref('');
const resultados = ref({ personas: [], prospectos: [], empresas: [], casos: [] });
const buscando = ref(false);
let debounceId = null;

watch(() => props.open, (v) => {
  if (v) { q.value = ''; resultados.value = { personas: [], prospectos: [], empresas: [], casos: [] }; }
});

watch(q, (val) => {
  if (debounceId) clearTimeout(debounceId);
  if (!val || val.length < 2) {
    resultados.value = { personas: [], prospectos: [], empresas: [], casos: [] };
    return;
  }
  debounceId = setTimeout(async () => {
    buscando.value = true;
    try {
      const r = await buscadorApi.buscar(val);
      resultados.value = r.data;
    } catch (e) { notify(e); }
    finally { buscando.value = false; }
  }, 300);
});

function irAProspecto(p) {
  emit('close');
  abrirProspecto(router, p);
}
</script>

<template>
  <BaseModal :open="open" title="" max-width="max-w-2xl" @close="emit('close')">
    <template #header>
      <span class="text-base text-text2">🔎 Buscar</span>
    </template>

    <BaseInput v-model="q" placeholder="Nombre, teléfono, email, NIT, # caso..." autocomplete="off" />

    <div v-if="buscando" class="text-text3 text-center py-6 text-sm">Buscando...</div>

    <div v-else-if="q.length >= 2" class="mt-4 space-y-4 max-h-[400px] overflow-y-auto">
      <section v-if="resultados.prospectos.length">
        <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">📋 Prospectos</h3>
        <ul class="divide-y divide-text3/10">
          <li v-for="p in resultados.prospectos" :key="p.prosp_id"
              @click="irAProspecto(p)"
              class="py-2 cursor-pointer hover:bg-cream rounded px-2">
            <div class="font-semibold text-text1">
              {{ p.persona?.persona_nombre }} {{ p.persona?.persona_apellido || '' }}
            </div>
            <div class="text-xs text-text3 flex gap-2">
              <span>{{ formato(p.persona?.persona_telefono_principal) }}</span>
              <span v-if="p.estado">· {{ p.estado.estado_nombre }}</span>
              <span v-if="p.asesor">· {{ p.asesor.usr_nombre }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="resultados.personas.length">
        <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">👤 Personas</h3>
        <ul class="divide-y divide-text3/10">
          <li v-for="per in resultados.personas" :key="per.persona_id" class="py-2 px-2">
            <div class="font-semibold text-text1">{{ per.persona_nombre }} {{ per.persona_apellido || '' }}</div>
            <div class="text-xs text-text3">{{ formato(per.persona_telefono_principal) }} · {{ per.persona_email || 'sin email' }}</div>
          </li>
        </ul>
      </section>

      <div v-if="!resultados.prospectos.length && !resultados.personas.length" class="text-center py-8 text-text3 text-sm">
        Sin resultados para "<strong>{{ q }}</strong>"
      </div>
    </div>

    <div v-else class="text-text3 text-center py-6 text-xs">Escribe al menos 2 caracteres...</div>
  </BaseModal>
</template>
