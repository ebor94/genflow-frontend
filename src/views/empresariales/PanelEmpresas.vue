<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useEmpresasStore } from '@/stores/useEmpresasStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { useNit } from '@/composables/useNit';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import NuevaEmpresa from '@/components/crm/NuevaEmpresa.vue';

const router = useRouter();
const store  = useEmpresasStore();
const auth   = useAuthStore();
const { notify } = useApiError();
const { formato: fmtNit } = useNit();

const q = ref('');
const sector = ref('');
const showNueva = ref(false);
let debounce = null;

const sectores = [
  { value: '', label: 'Todos los sectores' },
  { value: 'Manufactura', label: 'Manufactura' },
  { value: 'Salud',       label: 'Salud' },
  { value: 'Comercio',    label: 'Comercio' },
  { value: 'Educación',   label: 'Educación' },
  { value: 'Construcción',label: 'Construcción' },
  { value: 'Tecnología',  label: 'Tecnología' },
  { value: 'Servicios',   label: 'Servicios' },
  { value: 'Otro',        label: 'Otro' }
];

async function cargar() {
  try { await store.fetchList({ q: q.value || undefined, sector: sector.value || undefined, page: 1, limit: 50 }); }
  catch (e) { notify(e); }
}

onMounted(cargar);
watch(sector, cargar);
watch(q, () => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(cargar, 300);
});

function abrir(empresa) {
  router.push({ name: 'emp-ficha', params: { id: empresa.empresa_id } });
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <h1 class="font-serif text-3xl text-brown-deep">Empresas</h1>
      <div class="flex gap-2">
        <BaseButton variant="secondary" size="sm" @click="router.push({ name: 'emp-kanban' })">🔄 Kanban</BaseButton>
        <BaseButton v-if="auth.rolNivel <= 3" variant="secondary" size="sm" @click="router.push({ name: 'emp-reporte-fideliz' })">📊 Reporte Fidelización</BaseButton>
        <BaseButton variant="primary"   size="sm" @click="showNueva = true">+ Nueva empresa</BaseButton>
      </div>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-3 mb-4">
      <BaseInput v-model="q" placeholder="🔎 Razón social, NIT..." />
      <BaseSelect v-model="sector" :options="sectores" />
    </div>

    <div v-if="store.loading" class="text-text3 text-center py-12">Cargando...</div>
    <EmptyState v-else-if="!store.items.length" titulo="Sin empresas" mensaje="Crea una nueva empresa para empezar." icono="🏢" />

    <div v-else class="sv-card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-cream text-text2">
          <tr>
            <th class="text-left px-4 py-3">Razón social</th>
            <th class="text-left px-4 py-3">NIT</th>
            <th class="text-left px-4 py-3">Sector</th>
            <th class="text-right px-4 py-3"># Empleados</th>
            <th class="text-right px-4 py-3">Prospectos</th>
            <th class="text-left px-4 py-3">Contacto</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-text3/10">
          <tr v-for="e in store.items" :key="e.empresa_id"
              @click="abrir(e)"
              class="cursor-pointer hover:bg-cream transition-colors">
            <td class="px-4 py-3">
              <div class="font-semibold text-text1">{{ e.empresa_razon_social }}</div>
              <div v-if="e.empresa_nombre_comercial" class="text-xs text-text3">{{ e.empresa_nombre_comercial }}</div>
            </td>
            <td class="px-4 py-3 text-text2 font-mono text-xs">{{ fmtNit(e.empresa_nit) }}</td>
            <td class="px-4 py-3 text-text2">{{ e.empresa_sector || '—' }}</td>
            <td class="px-4 py-3 text-right text-text2">{{ e.empresa_num_empleados ?? '—' }}</td>
            <td class="px-4 py-3 text-right">
              <span v-if="e.prospectos_activos > 0" class="px-2 py-0.5 text-xs font-semibold rounded-full bg-area-emp/10 text-area-emp">
                {{ e.prospectos_activos }}
              </span>
              <span v-else class="text-text3">—</span>
            </td>
            <td class="px-4 py-3 text-xs text-text3">
              <div v-if="e.empresa_telefono">📞 {{ e.empresa_telefono }}</div>
              <div v-if="e.empresa_email_corporativo">✉️ {{ e.empresa_email_corporativo }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <NuevaEmpresa :open="showNueva" @close="showNueva = false" @creada="(r) => { showNueva = false; cargar(); router.push({ name: 'emp-ficha', params: { id: r.empresa_id } }); }" />
  </div>
</template>
