<script setup>
/**
 * AgendaUnificada — /agenda
 * Vista transversal del calendario del asesor que mezcla:
 *   - Gestiones próximas (prospectos con prosp_prox_gestion_fecha) de EMP + PAP
 *   - Eventos manuales (sv_org_eventos_agenda)
 *
 * Asesor: solo ve su propia agenda. Supervisor+ puede cambiar el "asesor"
 * mediante un combo (o dejar vacío = todo el equipo).
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { agendaApi, eventosAgendaApi } from '@/api/agendaApi';
import { usuariosApi } from '@/api/usuariosApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import MiniCalendar from '@/components/common/MiniCalendar.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import NuevoEventoAgendaModal from '@/components/crm/NuevoEventoAgendaModal.vue';

const router = useRouter();
const auth   = useAuthStore();
const toast  = useToastStore();
const { notify } = useApiError();

const hoy = new Date().toISOString().slice(0, 10);
const fechaSel  = ref(hoy);
const mesActual = ref({ anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 });

// MiniCalendar trabaja con Date — proxy bidireccional con el string fechaSel
const fechaSelDate = computed({
  get: () => new Date(fechaSel.value + 'T12:00:00'),
  set: (d) => {
    if (!d) return;
    fechaSel.value = (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
  }
});

function onMesCambio(anio, mes) {
  mesActual.value = { anio, mes };
}
const eventosPorDia = ref({});           // { 'YYYY-MM-DD': { gestiones, eventos, total } }
const gestionesDia  = ref([]);
const eventosDia    = ref([]);
const asesorSel     = ref(null);          // null = "yo" (asesor) o "todo el equipo" (sup+)
const asesoresList  = ref([]);
const loading       = ref(false);
const showModal     = ref(false);
const eventoEdit    = ref(null);

const esAsesor = computed(() => ['ASESOR','AGENTE_SVC'].includes(auth.rolCodigo));
const puedeVerOtros = computed(() => !esAsesor.value);

const tipoBadge = {
  REUNION:      { label: 'Reunión',      color: 'bg-blue-100 text-blue-800' },
  VISITA:       { label: 'Visita',       color: 'bg-green-100 text-green-800' },
  CAPACITACION: { label: 'Capacitación', color: 'bg-purple-100 text-purple-800' },
  LLAMADA:      { label: 'Llamada',      color: 'bg-amber-100 text-amber-800' },
  PERSONAL:     { label: 'Personal',     color: 'bg-pink-100 text-pink-800' },
  OTRO:         { label: 'Otro',         color: 'bg-gray-100 text-gray-700' }
};

const itemsCalendar = computed(() => {
  // MiniCalendar espera array de eventos por fecha — adaptamos al formato esperado
  const out = [];
  for (const [fecha, info] of Object.entries(eventosPorDia.value)) {
    if (info.total > 0) {
      out.push({
        fecha,
        cantidad: info.total,
        color: info.eventos > 0 ? '#9333ea' : '#C8902A'  // morado si hay eventos manuales, dorado si solo gestiones
      });
    }
  }
  return out;
});

async function cargarMes() {
  try {
    const r = await agendaApi.mes({ anio: mesActual.value.anio, mes: mesActual.value.mes, asesorId: asesorSel.value });
    eventosPorDia.value = r.data || r || {};
  } catch (e) { notify(e); }
}

async function cargarDia() {
  loading.value = true;
  try {
    const r = await agendaApi.dia({ fecha: fechaSel.value, asesorId: asesorSel.value });
    const payload = r.data || r;
    gestionesDia.value = payload.gestiones || [];
    eventosDia.value   = payload.eventos   || [];
  } catch (e) {
    notify(e);
    gestionesDia.value = [];
    eventosDia.value   = [];
  } finally {
    loading.value = false;
  }
}

async function cargarAsesores() {
  if (!puedeVerOtros.value) return;
  try {
    const r = await usuariosApi.list({ activo: 1, limit: 200 });
    const lista = (r.data?.items || r.data || []);
    asesoresList.value = [
      { value: '', label: '— Todo mi equipo —' },
      ...lista
        .filter(u => ['ASESOR','AGENTE_SVC'].includes(u.rol?.rol_codigo))
        .map(u => ({ value: u.usr_id, label: `${u.usr_nombre} ${u.usr_apellido || ''} — ${u.grupo?.grupo_codigo || ''}` }))
    ];
  } catch (_) { /* silencioso */ }
}

function abrirNuevo() {
  eventoEdit.value = null;
  showModal.value = true;
}

function editar(ev) {
  eventoEdit.value = ev;
  showModal.value = true;
}

async function toggleCompletado(ev) {
  try {
    await eventosAgendaApi.marcarCompletado(ev.evento_id, !ev.evento_completado);
    await cargarDia();
  } catch (e) { notify(e); }
}

async function eliminar(ev) {
  if (!confirm(`¿Eliminar "${ev.evento_titulo}"?`)) return;
  try {
    await eventosAgendaApi.remove(ev.evento_id);
    toast.success('Evento eliminado');
    await Promise.all([cargarDia(), cargarMes()]);
  } catch (e) { notify(e); }
}

function abrirProspecto(p) {
  // Navegación por área del prospecto
  if (p.prosp_grupo_id === 3) router.push({ name: 'pap-mis-visitas' });
  else if (p.empresa) router.push({ name: 'emp-ficha', params: { id: p.empresa.empresa_id } });
}

function hora(dt) {
  return new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function nombreEntidad(p) {
  if (p.empresa) return p.empresa.empresa_razon_social;
  if (p.persona) return `${p.persona.persona_nombre} ${p.persona.persona_apellido || ''}`.trim();
  return `Prospecto #${p.prosp_id}`;
}

onMounted(async () => {
  await cargarAsesores();
  await Promise.all([cargarMes(), cargarDia()]);
});

watch(fechaSel, cargarDia);
watch(asesorSel, async () => { await Promise.all([cargarMes(), cargarDia()]); });
watch(mesActual, cargarMes);

async function onEventoGuardado() {
  await Promise.all([cargarDia(), cargarMes()]);
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <header class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="font-serif text-2xl text-brown-deep">📅 Mi agenda</h1>
        <p class="text-sm text-text3">Eventos personales + gestiones próximas de Empresariales e Individual.</p>
      </div>
      <div class="flex gap-2 items-end">
        <div v-if="puedeVerOtros" class="w-72">
          <BaseSelect v-model="asesorSel" label="Ver agenda de" :options="asesoresList" />
        </div>
        <BaseButton variant="primary" @click="abrirNuevo">+ Nueva actividad</BaseButton>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <!-- Calendario -->
      <aside class="sv-card p-4">
        <MiniCalendar
          v-model="fechaSelDate"
          :eventos="itemsCalendar"
          @month-change="onMesCambio"
        />
        <p class="text-xs text-text3 mt-3">
          <span class="inline-block w-2 h-2 rounded-full bg-purple-600 mr-1"></span>Eventos
          <span class="inline-block w-2 h-2 rounded-full bg-gold ml-3 mr-1"></span>Gestiones
        </p>
      </aside>

      <!-- Día seleccionado -->
      <section class="space-y-4">
        <h2 class="font-serif text-lg text-brown-deep">
          {{ new Date(fechaSel + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}
        </h2>

        <div v-if="loading" class="text-text3 text-sm">Cargando…</div>

        <div v-else-if="!gestionesDia.length && !eventosDia.length"
             class="sv-card p-8 text-center text-text3">
          Nada agendado para este día.
          <div class="mt-3">
            <BaseButton variant="primary" size="sm" @click="abrirNuevo">+ Crear actividad</BaseButton>
          </div>
        </div>

        <template v-else>
          <!-- Eventos manuales -->
          <article v-for="ev in eventosDia" :key="`ev-${ev.evento_id}`"
                   class="sv-card p-4 border-l-4 border-purple-500"
                   :class="ev.evento_completado ? 'opacity-60' : ''">
            <div class="flex items-start gap-3">
              <input type="checkbox" :checked="!!ev.evento_completado"
                     @change="toggleCompletado(ev)"
                     class="mt-1 w-4 h-4 accent-purple-600" />
              <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-mono text-text2">{{ hora(ev.evento_fecha_hora) }}</span>
                  <h3 class="font-semibold text-brown-deep"
                      :class="ev.evento_completado ? 'line-through' : ''">{{ ev.evento_titulo }}</h3>
                  <span class="text-xs px-2 py-0.5 rounded-full" :class="tipoBadge[ev.evento_tipo]?.color">
                    {{ tipoBadge[ev.evento_tipo]?.label || ev.evento_tipo }}
                  </span>
                </div>
                <p v-if="ev.evento_descripcion" class="text-sm text-text2 mt-1">{{ ev.evento_descripcion }}</p>
                <div class="flex gap-3 items-center text-xs text-text3 mt-2">
                  <span v-if="ev.asesor">👤 {{ ev.asesor.usr_nombre }} {{ ev.asesor.usr_apellido }}</span>
                  <span v-if="ev.creadoPor && ev.evento_creado_por !== ev.evento_asesor_id">
                    · creado por {{ ev.creadoPor.usr_nombre }}
                  </span>
                  <span v-if="ev.empresa">· {{ ev.empresa.empresa_razon_social }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <button @click="editar(ev)" class="text-xs text-text3 hover:text-gold">Editar</button>
                <button @click="eliminar(ev)" class="text-xs text-text3 hover:text-danger">Eliminar</button>
              </div>
            </div>
          </article>

          <!-- Gestiones próximas -->
          <article v-for="g in gestionesDia" :key="`g-${g.prosp_id}`"
                   class="sv-card p-4 border-l-4"
                   :style="`border-color: ${g.estado?.estado_color_hex || '#C8902A'}`">
            <div class="flex items-start gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-mono text-text2">{{ g.prosp_prox_gestion_hora?.slice(0,5) || '—' }}</span>
                  <h3 class="font-semibold text-brown-deep">{{ nombreEntidad(g) }}</h3>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold-bright">📞 Gestión próxima</span>
                  <span class="text-xs text-text3" v-if="g.estado">· {{ g.estado.estado_nombre }}</span>
                </div>
                <div class="text-xs text-text3 mt-1">
                  Área: {{ g.prosp_grupo_id === 2 ? 'Empresariales' : g.prosp_grupo_id === 3 ? 'Individual' : 'Otro' }}
                  <span v-if="g.asesor"> · 👤 {{ g.asesor.usr_nombre }} {{ g.asesor.usr_apellido }}</span>
                </div>
              </div>
              <BaseButton variant="secondary" size="sm" @click="abrirProspecto(g)">Abrir →</BaseButton>
            </div>
          </article>
        </template>
      </section>
    </div>

    <NuevoEventoAgendaModal
      v-model:show="showModal"
      :fecha-default="fechaSel"
      :asesor-id-default="asesorSel || auth.usuario?.usr_id"
      :evento-edit="eventoEdit"
      @guardado="onEventoGuardado"
    />
  </div>
</template>
