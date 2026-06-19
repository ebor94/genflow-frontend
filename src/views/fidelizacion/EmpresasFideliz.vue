<script setup>
/**
 * EmpresasFideliz.vue — lista de empresas con contactos de Fidelización.
 * Click en una empresa → ver historial completo de envíos.
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useApiError } from '@/composables/useApiError';
import { useNit } from '@/composables/useNit';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
dayjs.extend(relativeTime);
dayjs.locale('es');

import EmptyState from '@/components/common/EmptyState.vue';
import BaseInput  from '@/components/ui/BaseInput.vue';

const router = useRouter();
const store  = useFidelizacionStore();
const { notify } = useApiError();
const { formato: fmtNit } = useNit();

const q = ref('');

const empresas = computed(() => {
  let list = store.empresasConFideliz;
  if (q.value.trim()) {
    const t = q.value.toLowerCase();
    list = list.filter(e =>
      (e.empresa_razon_social || '').toLowerCase().includes(t)
      || (e.empresa_nit || '').includes(t)
      || (e.empresa_sector || '').toLowerCase().includes(t)
    );
  }
  return list;
});

function fmtUltimo(fecha) {
  if (!fecha) return 'sin envíos';
  return dayjs(fecha).fromNow();
}

async function cargar() {
  try { await store.fetchEmpresasConFideliz(); } catch (e) { notify(e); }
}

onMounted(cargar);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
      <h1 class="font-serif text-2xl text-brown-deep">🏢 Empresas con Fidelización</h1>
      <p class="text-sm text-text2 mt-1">
        Empresas con convenio firmado y contactos registrados. Click para ver el historial de envíos.
      </p>
    </header>

    <div class="sv-card p-4 mb-4">
      <BaseInput v-model="q" placeholder="Buscar por razón social, NIT o sector..." />
    </div>

    <div v-if="store.loading" class="text-text3 text-center py-12">Cargando empresas...</div>
    <EmptyState v-else-if="!empresas.length"
                titulo="Sin empresas con fidelización"
                descripcion="No hay empresas con contactos de fidelización registrados aún." />

    <article v-for="emp in empresas" :key="emp.empresa_id"
             class="sv-card p-4 mb-3 flex items-center gap-4 hover:shadow-sv-pop cursor-pointer transition-shadow"
             @click="router.push({ name: 'fideliz-historial-empresa', params: { empresaId: emp.empresa_id } })">
      <div class="w-12 h-12 rounded-sv flex items-center justify-center text-xl"
           style="background-color: #be185d20; color: #be185d">
        🏢
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-text1 truncate">{{ emp.empresa_razon_social }}</div>
        <div class="text-xs text-text3">NIT {{ fmtNit(emp.empresa_nit) }} · {{ emp.empresa_sector || 'Sin sector' }}</div>
        <div class="text-xs text-text2 mt-1">
          👥 {{ emp.contactos_total }} contactos · 📤 {{ emp.envios_total }} envíos
        </div>
      </div>
      <div class="text-right">
        <div class="text-xs text-text3">Último envío</div>
        <div class="text-sm font-semibold text-text2">{{ fmtUltimo(emp.ultimo_envio) }}</div>
      </div>
    </article>
  </div>
</template>
