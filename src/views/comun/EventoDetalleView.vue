<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto">
    <div v-if="cargando" class="text-center py-10 text-text2">Cargando...</div>
    <div v-else-if="!evento" class="text-center py-10 text-red-500">Evento no encontrado</div>
    <div v-else>
      <!-- Header -->
      <header class="bg-white rounded-2xl shadow border border-gray-100 p-4 sm:p-5 mb-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="text-xs uppercase text-primary font-semibold">{{ evento.evento_tipo }}</span>
              <span v-if="evento.evento_registros_publicos_habilitado"
                    class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Público</span>
            </div>
            <h1 class="text-lg sm:text-xl font-bold text-text1 leading-tight">{{ evento.evento_titulo }}</h1>
            <p class="text-xs text-text3 mt-1">{{ fechasFmt }}</p>
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <button type="button"
                    class="text-xs px-3 py-1.5 bg-primary hover:opacity-90 text-white rounded"
                    @click="editar = true">
              Editar
            </button>
            <RouterLink :to="{ name: 'agenda' }" class="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
              Volver
            </RouterLink>
          </div>
        </div>
        <div v-if="evento.evento_descripcion" class="text-sm text-text2 mt-3">
          {{ evento.evento_descripcion }}
        </div>

        <!-- KPIs del resumen -->
        <div v-if="resumen" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 border-t pt-4">
          <div>
            <div class="text-xs text-text3">Total registros</div>
            <div class="text-lg font-bold text-text1">{{ resumen.total_registros }}</div>
          </div>
          <div>
            <div class="text-xs text-text3">Pendientes de asignar</div>
            <div class="text-lg font-bold text-primary">{{ resumen.total_pendientes }}</div>
          </div>
          <div>
            <div class="text-xs text-text3">Asignados</div>
            <div class="text-lg font-bold text-green-600">{{ resumen.total_asignados }}</div>
          </div>
          <div v-if="evento.evento_meta_leads">
            <div class="text-xs text-text3">Meta</div>
            <div class="text-lg font-bold text-text1">{{ evento.evento_meta_leads }}</div>
          </div>
        </div>
      </header>

      <!-- Tabs -->
      <div class="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <nav class="flex border-b border-gray-200 text-sm font-medium">
          <button v-for="t in tabs" :key="t.key" type="button"
                  :class="tab === t.key
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text3 hover:text-text2'"
                  class="flex-1 py-3"
                  @click="tab = t.key">
            {{ t.label }} <span v-if="t.badge" class="ml-1 text-xs bg-gray-200 text-text2 px-1.5 py-0.5 rounded">{{ t.badge }}</span>
          </button>
        </nav>
        <div class="p-4 sm:p-5">
          <EventoAsistentesPanel v-if="tab === 'asistentes'" :evento="evento" @refresh="cargar" />
          <EventoPoolPanel        v-else-if="tab === 'pool'" :evento="evento" @asignado="cargar" />
          <EventoLinkPublicoShare v-else-if="tab === 'link'" :evento="evento" />
        </div>
      </div>
    </div>

    <EditarEventoModal v-if="evento" :open="editar" :evento="evento"
                       @close="editar = false" @guardado="cargar" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';
import EventoAsistentesPanel  from '@/components/eventos/EventoAsistentesPanel.vue';
import EventoPoolPanel        from '@/components/eventos/EventoPoolPanel.vue';
import EventoLinkPublicoShare from '@/components/eventos/EventoLinkPublicoShare.vue';
import EditarEventoModal from '@/components/eventos/EditarEventoModal.vue';

const route  = useRoute();
const toast  = useToastStore();
const cargando = ref(true);
const evento   = ref(null);
const resumen  = ref(null);
const tab      = ref('asistentes');
const editar   = ref(false);

const tabs = computed(() => [
  { key: 'asistentes', label: 'Asistentes', badge: evento.value?.asistentes?.length || 0 },
  { key: 'pool',       label: 'Pool',       badge: resumen.value?.total_pendientes || 0 },
  { key: 'link',       label: 'Link público' }
]);

const fechasFmt = computed(() => {
  if (!evento.value) return '';
  const fmt = (d) => new Date(d).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'
  });
  const inicio = fmt(evento.value.evento_fecha_hora);
  const fin = evento.value.evento_fecha_fin ? ' → ' + fmt(evento.value.evento_fecha_fin) : '';
  return inicio + fin;
});

async function cargar() {
  cargando.value = true;
  try {
    const eid = parseInt(route.params.id);
    const [ev, res] = await Promise.all([
      eventosAgendaApi.get(eid),
      eventosAgendaApi.resumen(eid).catch(() => null)
    ]);
    evento.value  = ev.data || ev;
    resumen.value = res?.data || res || null;
  } catch (e) {
    toast.error('No se pudo cargar el evento');
    evento.value = null;
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>
