<script setup>
/**
 * SalasVelacion.vue — homenajes en curso en las salas de velación (Homenajes360)
 * para que los asesores de Prenecesidad atiendan al contratante y registren visitas.
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { salasApi } from '@/api/salasApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { fmtFecha, fmtRelativo } from '@/utils/format';

import BaseButton from '@/components/ui/BaseButton.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import AtenderContratanteModal from '@/components/salas/AtenderContratanteModal.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

const router = useRouter();
const toast = useToastStore();
const { notify, extract } = useApiError();

const CODIGOS_RECARGA = ['HOMENAJE_CERRADO', 'HOMENAJE_NO_ENCONTRADO', 'SIN_ATENDER'];

const homenajes = ref([]);
const cargando = ref(false);
const atendiendo = ref(null); // homenaje en la ventana de atención
const visita = ref(null);     // { homenajeId, prospecto, resumen } para RegistrarGestion

async function cargar() {
  cargando.value = true;
  try {
    homenajes.value = (await salasApi.listar()).data || [];
  } catch (e) {
    notify(e);
  } finally {
    cargando.value = false;
  }
}

function etiqueta(h) {
  if (!h.cliente) return 'Sin atender';
  if (h.cliente.es_mio) return `Tu cliente · ${h.cliente.estado_nombre}`;
  return `Cliente de ${h.cliente.duenio_nombre} · ${h.cliente.estado_nombre}`;
}

function claseEtiqueta(h) {
  if (!h.cliente) return 'bg-warning/10 text-warning';
  return h.cliente.es_mio ? 'bg-sage/10 text-sage' : 'bg-cream text-text2';
}

function cuando(fecha) {
  const d = new Date(fecha);
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `hoy ${hora}` : `${fmtFecha(fecha)} ${hora}`;
}

function irAFicha(prospId, homenajeId) {
  router.push({ name: 'prenec-ficha', params: { id: prospId }, query: { homenaje: homenajeId } });
}

function onAtendido(homenaje, data) {
  atendiendo.value = null;
  if (data.es_mio) return irAFicha(data.prosp_id, homenaje.id);
  visita.value = {
    homenajeId: homenaje.id,
    resumen: data.resumen,
    prospecto: {
      prosp_id: data.prosp_id,
      prosp_area_id: data.prosp_area_id,
      prosp_grupo_id: data.prosp_grupo_id,
      persona: { persona_nombre: data.persona_nombre, persona_telefono_principal: data.persona_telefono },
      productos: []
    }
  };
}

async function registrarVisita(h) {
  try {
    const r = await salasApi.atender(h.id);
    onAtendido(h, r.data);
  } catch (e) {
    const codigo = e?.response?.data?.error;
    if (CODIGOS_RECARGA.includes(codigo)) {
      toast.warning(extract(e));
      cargar();
    } else {
      notify(e);
    }
  }
}

function onCerrado() {
  atendiendo.value = null;
  cargar();
}

function onVisitaRegistrada() {
  visita.value = null;
  cargar();
}

onMounted(cargar);
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h1 class="font-serif text-2xl text-brown-deep">🏛️ Salas de velación</h1>
        <p class="text-sm text-text3">Homenajes en curso para atender al contratante</p>
      </div>
      <BaseButton variant="secondary" size="sm" :loading="cargando" @click="cargar">Recargar</BaseButton>
    </div>

    <EmptyState v-if="!cargando && !homenajes.length"
                titulo="No hay homenajes en curso en las salas"
                mensaje="Cuando Homenajes360 registre un homenaje en sala, aparecerá aquí."
                icono="🏛️" />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <article v-for="h in homenajes" :key="h.id" :data-testid="`homenaje-${h.id}`" class="sv-card p-4 space-y-2">
        <div class="flex items-center justify-between gap-2 text-xs text-text3">
          <span class="font-semibold truncate">{{ h.sala_nombre }} · {{ h.sede_nombre }}</span>
          <span class="shrink-0">{{ fmtRelativo(h.registrado_at) }}</span>
        </div>
        <div class="font-semibold text-text1">{{ h.nombre_ser_querido || '—' }}</div>
        <div v-if="h.contrato" class="text-xs text-text3">Contrato {{ h.contrato }}</div>
        <div class="text-sm">
          <span class="text-text3">Contratante:</span>
          {{ h.contratante_nombre || 'Sin nombre registrado' }}
          <span v-if="h.contratante_telefono" class="text-text3">· {{ h.contratante_telefono }}</span>
        </div>
        <span :data-testid="`etiqueta-${h.id}`"
              class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
              :class="claseEtiqueta(h)">{{ etiqueta(h) }}</span>
        <ul v-if="h.visitas.length" class="text-xs text-text3 space-y-0.5">
          <li v-for="(v, i) in h.visitas" :key="i">🏛️ {{ v.asesor_nombre }} · {{ cuando(v.fecha_hora) }}</li>
        </ul>
        <div v-if="h.puede_atender" class="pt-1">
          <BaseButton v-if="!h.cliente" :data-testid="`btn-atender-${h.id}`"
                      variant="primary" size="sm" @click="atendiendo = h">Atender contratante</BaseButton>
          <BaseButton v-else-if="h.cliente.es_mio" :data-testid="`btn-ficha-${h.id}`"
                      variant="primary" size="sm" @click="irAFicha(h.cliente.prosp_id, h.id)">Abrir ficha</BaseButton>
          <BaseButton v-else :data-testid="`btn-visita-${h.id}`"
                      variant="secondary" size="sm" @click="registrarVisita(h)">Registrar visita</BaseButton>
        </div>
      </article>
    </div>

    <AtenderContratanteModal :open="!!atendiendo" :homenaje="atendiendo"
                             @close="atendiendo = null"
                             @atendido="(data) => onAtendido(atendiendo, data)"
                             @cerrado="onCerrado" />
    <RegistrarGestion :open="!!visita"
                      :prospecto="visita ? visita.prospecto : null"
                      :homenaje-sala-id="visita ? visita.homenajeId : null"
                      :resumen-cliente="visita ? visita.resumen : null"
                      @close="visita = null"
                      @registrada="onVisitaRegistrada" />
  </div>
</template>
