<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import { personasApi } from '@/api/personasApi';
import { fmtFecha } from '@/utils/format';

import StatusPill from '@/components/common/StatusPill.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import HistorialItem from '@/components/common/HistorialItem.vue';
import QuickActionRow from '@/components/common/QuickActionRow.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import AgendarProximaModal from '@/components/crm/AgendarProximaModal.vue';
import ProspectosCrossArea from '@/components/crm/ProspectosCrossArea.vue';
import ReasignarProspectoModal from '@/components/crm/ReasignarProspectoModal.vue';

const route  = useRoute();
const router = useRouter();
const store  = useProspectosStore();
const gestiones = useGestionesStore();
const auth = useAuthStore();
const { notify } = useApiError();

const otrosProspectos = ref([]);
const puedeVerHistorial = computed(() => auth.rolNivel <= 3);
const { formato } = useTelefono();

const showRegistrar = ref(false);
const showAgendar = ref(false);
const showReasignar = ref(false);

const p = computed(() => store.activo);
const persona = computed(() => p.value?.persona);
const historial = computed(() => gestiones.historial.get(parseInt(route.params.id)) || { items: [], hasMore: false, loading: false });

async function cargar() {
  const id = parseInt(route.params.id);
  try {
    await store.fetchOne(id);
    await gestiones.fetchHistorial(id, { reset: true });
    // Cross-área: prospectos del cliente en otras áreas
    if (store.activo?.prosp_persona_id) {
      const r = await personasApi.prospectosActivos(store.activo.prosp_persona_id);
      otrosProspectos.value = r.data || [];
    }
  } catch (e) { notify(e); }
}

onMounted(cargar);
watch(() => route.params.id, cargar);

async function cargarMas() {
  await gestiones.fetchHistorial(parseInt(route.params.id));
}

function llamar() {
  router.push({ name: 'prenec-llamada', params: { id: p.value.prosp_id } });
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <button @click="router.back()" class="text-sm text-text3 hover:text-text1 mb-3">← Volver</button>

    <div v-if="!p" class="text-text3 text-center py-12">Cargando ficha...</div>

    <template v-else>
      <!-- Header -->
      <header class="sv-card p-5 mb-4">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div class="flex items-center gap-3">
            <div class="w-14 h-14 rounded-full bg-gold/15 text-gold font-bold flex items-center justify-center text-xl">
              {{ (persona?.persona_nombre || '?').charAt(0).toUpperCase() }}
            </div>
            <div>
              <h1 class="font-serif text-2xl text-brown-deep">
                {{ persona?.persona_nombre }} {{ persona?.persona_apellido || '' }}
              </h1>
              <p class="text-sm text-text3">{{ formato(persona?.persona_telefono_principal) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <StatusPill v-if="p.estado" :label="p.estado.estado_nombre" :color-hex="p.estado.estado_color_hex || '#8A6A52'" />
            <BaseButton v-if="auth.puedeReasignar" variant="secondary" size="sm" @click="showReasignar = true">
              🔄 Reasignar
            </BaseButton>
          </div>
        </div>

        <QuickActionRow
          :telefono="persona?.persona_telefono_principal"
          @registrar="showRegistrar = true"
          @agendar="showAgendar = true"
        />
      </header>

      <!-- Próxima gestión -->
      <section v-if="p.prosp_prox_gestion_fecha" class="sv-card p-4 mb-4 flex items-center justify-between"
               :class="new Date(p.prosp_prox_gestion_fecha) < new Date().setHours(0,0,0,0)
                       ? 'border-l-4 border-danger bg-danger/5'
                       : 'border-l-4 border-warning bg-warning/5'">
        <div>
          <div class="text-xs text-text3 uppercase tracking-wide">Próxima gestión</div>
          <div class="font-semibold text-text1">
            {{ fmtFecha(p.prosp_prox_gestion_fecha) }} {{ p.prosp_prox_gestion_hora?.slice(0,5) || '' }}
          </div>
        </div>
        <BaseButton variant="ghost" size="sm" @click="showAgendar = true">Reagendar</BaseButton>
      </section>

      <!-- Datos -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="sv-card p-4">
          <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">Contacto</h3>
          <dl class="text-sm space-y-1.5">
            <div class="flex"><dt class="text-text3 w-28">Teléfono</dt><dd>{{ formato(persona?.persona_telefono_principal) }}</dd></div>
            <div v-if="persona?.persona_telefono_alterno" class="flex"><dt class="text-text3 w-28">Alterno</dt><dd>{{ formato(persona.persona_telefono_alterno) }}</dd></div>
            <div v-if="persona?.persona_email" class="flex"><dt class="text-text3 w-28">Email</dt><dd>{{ persona.persona_email }}</dd></div>
            <div v-if="persona?.persona_direccion" class="flex"><dt class="text-text3 w-28">Dirección</dt><dd>{{ persona.persona_direccion }}</dd></div>
            <div v-if="persona?.persona_barrio" class="flex"><dt class="text-text3 w-28">Barrio</dt><dd>{{ persona.persona_barrio }}</dd></div>
          </dl>
        </div>

        <div class="sv-card p-4">
          <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">Comercial</h3>
          <dl class="text-sm space-y-1.5">
            <div class="flex"><dt class="text-text3 w-28">Asesor</dt><dd>{{ p.asesor?.usr_nombre }} {{ p.asesor?.usr_apellido }}</dd></div>
            <div v-if="p.fuente" class="flex"><dt class="text-text3 w-28">Fuente</dt><dd>{{ p.fuente.fuente_nombre }}</dd></div>
            <div v-if="p.punto" class="flex"><dt class="text-text3 w-28">Punto</dt><dd>{{ p.punto.punto_nombre }}</dd></div>
            <div v-if="p.lista" class="flex"><dt class="text-text3 w-28">Lista</dt><dd>{{ p.lista.lista_nombre }}</dd></div>
            <div class="flex"><dt class="text-text3 w-28">Prioridad</dt><dd>{{ p.prosp_prioridad }} / 5</dd></div>
          </dl>
        </div>
      </section>

      <!-- Productos -->
      <section v-if="p.productos?.length" class="sv-card p-4 mb-4">
        <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">Productos de interés</h3>
        <div class="flex flex-wrap gap-2">
          <span v-for="pp in p.productos" :key="pp.pp_id"
                class="px-3 py-1 text-xs rounded-full bg-gold/10 text-gold border border-gold/30 font-semibold">
            <span v-if="pp.pp_es_principal">⭐</span>
            {{ pp.producto?.prod_nombre }}
          </span>
        </div>
      </section>

      <!-- Nota inicial -->
      <section v-if="p.prosp_nota_inicial" class="sv-card p-4 mb-4">
        <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">Nota inicial</h3>
        <p class="text-sm text-text2 whitespace-pre-line">{{ p.prosp_nota_inicial }}</p>
      </section>

      <!-- Cross-área: prospectos en otras áreas -->
      <section v-if="otrosProspectos.length > 1" class="mb-4">
        <ProspectosCrossArea
          :prospectos="otrosProspectos"
          :ocultar-area-id="p.prosp_area_id"
          tono="info"
        />
      </section>

      <!-- Historial -->
      <section class="sv-card p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-serif text-lg text-brown-deep">Historial de gestiones</h3>
          <div class="flex items-center gap-3">
            <span class="text-xs text-text3">{{ historial.total }} total</span>
            <RouterLink v-if="puedeVerHistorial && p.prosp_persona_id"
                        :to="{ name: 'cliente-historial', params: { personaId: p.prosp_persona_id } }"
                        class="text-xs text-gold hover:text-gold-bright font-semibold">
              🔍 Ver historial cross-área
            </RouterLink>
          </div>
        </div>
        <EmptyState v-if="!historial.items.length && !historial.loading" titulo="Sin gestiones aún" mensaje="Registra la primera para comenzar el historial." icono="📋" />
        <div v-else class="space-y-0">
          <HistorialItem v-for="g in historial.items" :key="g.gest_id" :gestion="g" />
        </div>
        <div v-if="historial.hasMore" class="text-center mt-3">
          <BaseButton variant="ghost" size="sm" :loading="historial.loading" @click="cargarMas">Cargar más</BaseButton>
        </div>
      </section>

      <RegistrarGestion :open="showRegistrar" :prospecto="p" @close="showRegistrar = false" @registrada="cargar" />
      <AgendarProximaModal :open="showAgendar" :prospecto="p" @close="showAgendar = false" @actualizado="cargar" />
      <ReasignarProspectoModal :open="showReasignar" :prospecto="p" @close="showReasignar = false" @reasignado="cargar" />
    </template>
  </div>
</template>
