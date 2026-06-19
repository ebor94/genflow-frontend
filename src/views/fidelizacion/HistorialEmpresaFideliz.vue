<script setup>
/**
 * HistorialEmpresaFideliz.vue — timeline completo de envíos de una empresa.
 *
 * Header con stats (total, por estado, por tipo) + lista agrupada por año/mes,
 * filtros por contacto / tipo / estado.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useEmpresasStore } from '@/stores/useEmpresasStore';
import { useApiError } from '@/composables/useApiError';
import { useNit } from '@/composables/useNit';
import dayjs from 'dayjs';

import EmptyState from '@/components/common/EmptyState.vue';
import KpiCard    from '@/components/dashboard/KpiCard.vue';
import FilterChips from '@/components/common/FilterChips.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';

const route   = useRoute();
const router  = useRouter();
const store   = useFidelizacionStore();
const empresasStore = useEmpresasStore();
const { notify } = useApiError();
const { formato: fmtNit } = useNit();

const filtroEstado   = ref('todos');
const filtroContacto = ref('');
const empresa        = ref(null);

const FILTROS_ESTADO = [
  { value: 'todos',       label: 'Todos' },
  { value: 'enviado',     label: '📤 Enviado' },
  { value: 'confirmado',  label: '✅ Confirmado' },
  { value: 'devuelto',    label: '↩️ Devuelto' }
];

const TIPO_LABEL = {
  nacimiento: '🎂 Cumpleaños',
  aniversario_laboral: '💼 Aniv. laboral',
  aniversario_boda: '💍 Aniv. boda',
  dia_madre: '💐 Día Madre',
  dia_padre: '👔 Día Padre',
  otro: '🎉 Otro'
};

const empresaId = computed(() => parseInt(route.params.empresaId));

const data = computed(() => store.historialPorEmpresa.get(empresaId.value) || { envios: [], stats: {} });
const envios = computed(() => data.value.envios || []);
const stats = computed(() => data.value.stats || {});

const opcionesContactos = computed(() => {
  const lst = stats.value.por_contacto || [];
  return [{ value: '', label: 'Todos los contactos' },
          ...lst.map(c => ({ value: String(c.persona_id), label: `${c.persona_nombre} ${c.persona_apellido || ''} (${c.total})` }))];
});

const filtrados = computed(() => {
  let lst = envios.value;
  if (filtroEstado.value !== 'todos') lst = lst.filter(e => e.env_estado === filtroEstado.value);
  if (filtroContacto.value) lst = lst.filter(e => String(e.env_persona_id) === filtroContacto.value);
  return lst;
});

// Agrupados por año-mes
const grupos = computed(() => {
  const m = new Map();
  for (const e of filtrados.value) {
    const k = dayjs(e.env_fecha_envio).format('YYYY-MM');
    if (!m.has(k)) m.set(k, { etiqueta: dayjs(e.env_fecha_envio).format('MMMM YYYY'), items: [] });
    m.get(k).items.push(e);
  }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ ...v, key: k }));
});

async function cargar() {
  try {
    await store.fetchHistorialEmpresa(empresaId.value);
    empresa.value = await empresasStore.fetchOne(empresaId.value);
  } catch (e) { notify(e); }
}

onMounted(cargar);
watch(empresaId, cargar);
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <button @click="router.back()" class="text-sm text-text3 hover:text-text1 mb-3">← Volver</button>

    <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
      <h1 class="font-serif text-2xl text-brown-deep">
        🏢 {{ empresa?.empresa_razon_social || 'Cargando...' }}
      </h1>
      <p v-if="empresa" class="text-sm text-text3 mt-1">
        NIT {{ fmtNit(empresa.empresa_nit) }} · {{ empresa.empresa_sector || 'Sin sector' }}
      </p>
      <p class="text-sm text-text2 mt-2">📤 Historial de detalles enviados al equipo de la empresa.</p>
    </header>

    <!-- KPIs -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <KpiCard label="Total envíos"  :value="stats.total ?? 0" icon="📤" colorHex="#be185d" />
      <KpiCard label="Confirmados"   :value="stats.confirmados ?? 0" icon="✅" colorHex="#6B8F6E" />
      <KpiCard label="Pendientes"    :value="stats.enviados ?? 0" icon="⏳" colorHex="#C8902A" />
      <KpiCard label="Devueltos"     :value="stats.devueltos ?? 0" icon="↩️" colorHex="#B83227" />
    </div>

    <!-- Por tipo -->
    <section v-if="stats.por_tipo?.length" class="sv-card p-4 mb-4">
      <h3 class="text-sm font-semibold text-text2 mb-3">Por tipo de evento</h3>
      <div class="flex flex-wrap gap-2">
        <span v-for="t in stats.por_tipo" :key="t.tipo"
              class="px-3 py-1 rounded-full text-xs bg-cream border border-text3/20">
          {{ TIPO_LABEL[t.tipo] || t.tipo }} <strong class="ml-1">{{ t.total }}</strong>
        </span>
      </div>
    </section>

    <!-- Filtros -->
    <div class="sv-card p-4 mb-4 space-y-3">
      <FilterChips v-model="filtroEstado" :options="FILTROS_ESTADO" />
      <BaseSelect v-if="opcionesContactos.length > 1"
                  v-model="filtroContacto"
                  :options="opcionesContactos"
                  placeholder="Filtrar por contacto" />
    </div>

    <!-- Timeline -->
    <div v-if="store.loading" class="text-text3 text-center py-12">Cargando historial...</div>
    <EmptyState v-else-if="!filtrados.length"
                titulo="Sin envíos"
                descripcion="No se encontraron envíos con los filtros seleccionados." />

    <section v-for="g in grupos" :key="g.key" class="mb-6">
      <h3 class="text-sm font-serif text-brown-deep mb-3 capitalize">📅 {{ g.etiqueta }}</h3>
      <div class="space-y-3">
        <article v-for="env in g.items" :key="env.env_id"
                 class="sv-card p-4 border-l-4"
                 :class="env.env_estado === 'confirmado' ? 'border-sage'
                         : env.env_estado === 'devuelto'   ? 'border-danger'
                         : 'border-gold'">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-text1">
                  {{ env.persona?.persona_nombre }} {{ env.persona?.persona_apellido }}
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
                      :class="env.env_estado === 'confirmado' ? 'bg-sage/20 text-sage'
                              : env.env_estado === 'devuelto'   ? 'bg-danger/20 text-danger'
                              : 'bg-gold/20 text-gold'">
                  {{ env.env_estado }}
                </span>
              </div>
              <div class="text-xs text-text2 mt-1">
                {{ TIPO_LABEL[env.env_evento_tipo] || env.env_evento_tipo }} {{ env.env_evento_anio }}
                · {{ env.env_tipo_detalle || 'Sin descripción del detalle' }}
              </div>
              <div class="text-xs text-text3 mt-1">
                🗓️ {{ dayjs(env.env_fecha_envio).format('DD/MM/YYYY HH:mm') }}
                <span v-if="env.agente"> · por {{ env.agente.usr_nombre }} {{ env.agente.usr_apellido }}</span>
              </div>
              <div v-if="env.env_direccion_entrega" class="text-xs text-text3 mt-1">
                📍 {{ env.env_direccion_entrega }}
              </div>
              <div v-if="env.env_comentario" class="text-xs text-text2 italic mt-1">"{{ env.env_comentario }}"</div>
            </div>
            <a v-if="env.env_evidencia_url" :href="env.env_evidencia_url" target="_blank"
               class="shrink-0 px-2 py-1 rounded-sv bg-area-emp/10 text-area-emp text-xs hover:bg-area-emp/20">
              📷 Ver foto
            </a>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
