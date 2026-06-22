<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEmpresasStore } from '@/stores/useEmpresasStore';
import { useConfigStore } from '@/stores/useConfigStore';
import { useApiError } from '@/composables/useApiError';
import { useNit } from '@/composables/useNit';
import { useTelefono } from '@/composables/useTelefono';

import AreaBadge from '@/components/common/AreaBadge.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import HistorialItem from '@/components/common/HistorialItem.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import PipelineVisual from '@/components/crm/PipelineVisual.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import AgendarProximaModal from '@/components/crm/AgendarProximaModal.vue';
import ReasignarAsesorEmpresaModal from '@/components/crm/ReasignarAsesorEmpresaModal.vue';
import CategoriaPresupuestoModal from '@/components/crm/CategoriaPresupuestoModal.vue';
import DocumentosEmpresaTab from '@/components/crm/DocumentosEmpresaTab.vue';
import PropuestasArchivoTab from '@/components/crm/PropuestasArchivoTab.vue';
import { useAuthStore } from '@/stores/useAuthStore';
import BannerFidelizPendiente from '@/components/fideliz/BannerFidelizPendiente.vue';
import FormContactoFideliz from '@/components/fideliz/FormContactoFideliz.vue';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';

const route  = useRoute();
const router = useRouter();
const store  = useEmpresasStore();
const config = useConfigStore();
const { notify } = useApiError();
const { formato: fmtNit } = useNit();
const { formato: fmtTel, linkTel } = useTelefono();

const auth = useAuthStore();
const tab = ref('datos');   // Tabs nuevos: datos | contactos | documentos | propuestas | fidelizacion | historial
const showRegistrar = ref(false);
const showAgendar   = ref(false);
const showFormContacto = ref(false);
const showReasignarEmpresa = ref(false); // reasignar TODA la empresa al nuevo asesor
const showCategoria = ref(false);
const prospectoActivo = ref(null);

// Fidelización
const fidelizStore = useFidelizacionStore();
const contactosFideliz = ref([]);

async function cargarContactosFideliz() {
  try {
    contactosFideliz.value = await fidelizStore.fetchContactosEmpresa(parseInt(route.params.id));
  } catch (e) {
    contactosFideliz.value = [];
  }
}

const e = computed(() => store.activa);

// Migración 019: edición inline de la periodicidad de seguimiento
const periodicidadInline   = ref('');
const savingPeriodicidad   = ref(false);
watch(e, (nv) => { if (nv) periodicidadInline.value = nv.empresa_periodicidad_seguimiento || ''; }, { immediate: true });
async function guardarPeriodicidad() {
  if (!e.value) return;
  savingPeriodicidad.value = true;
  try {
    await store.actualizar(e.value.empresa_id, { empresa_periodicidad_seguimiento: periodicidadInline.value || null });
  } catch (err) { notify(err); }
  finally { savingPeriodicidad.value = false; }
}

// Helpers categoría / presupuesto
const CATEGORIA_INFO = {
  BRONCE:   { icono: '🥉', color: '#cd7f32', label: 'Bronce' },
  PLATA:    { icono: '🥈', color: '#b0b0b0', label: 'Plata' },
  ORO:      { icono: '🥇', color: '#d4af37', label: 'Oro' },
  PLATINO:  { icono: '💎', color: '#7ec0c0', label: 'Platino' },
  DIAMANTE: { icono: '💠', color: '#5ac8fa', label: 'Diamante' }
};
const categoriaInfo = computed(() => CATEGORIA_INFO[e.value?.empresa_categoria] || null);

const presupuestoTotal = computed(() => parseFloat(e.value?.empresa_presupuesto_fideliz || 0));
const presupuestoGastado = computed(() => parseFloat(e.value?.empresa_presupuesto_gastado || 0));
const presupuestoDisponible = computed(() => presupuestoTotal.value - presupuestoGastado.value);
const presupuestoPct = computed(() => {
  if (!presupuestoTotal.value) return 0;
  return Math.min(100, Math.round((presupuestoGastado.value / presupuestoTotal.value) * 100));
});
const fmtMoneda = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n || 0);

async function cargar() {
  try {
    await store.fetchOne(parseInt(route.params.id));
    await cargarContactosFideliz();
  } catch (e) { notify(e); }
}

onMounted(cargar);
watch(() => route.params.id, cargar);

// Detección del convenio activo y sus fechas (banner de vencimiento)
const convenioActivo = computed(() => {
  return (e.value?.prospectos || []).find(p =>
    p.prosp_fecha_vencimiento_convenio && p.estado?.estado_es_final && p.estado?.estado_es_ganado
  );
});
const diasParaVencer = computed(() => {
  if (!convenioActivo.value?.prosp_fecha_vencimiento_convenio) return null;
  const venc = new Date(convenioActivo.value.prosp_fecha_vencimiento_convenio);
  const hoy = new Date();
  return Math.ceil((venc - hoy) / 86400000);
});
const renovacionExistente = computed(() => {
  if (!convenioActivo.value) return null;
  return (e.value?.prospectos || []).find(p =>
    p.prosp_origen_prosp_id === convenioActivo.value.prosp_id && p.prosp_activo
  );
});

const estadosGrupo = computed(() => {
  const grupoId = e.value?.prospectos?.[0]?.prosp_grupo_id;
  return (config.actual?.estados || []).filter(es => es.estado_grupo_id === grupoId && es.estado_activo);
});

// Estas funciones siguen usándose para gestiones internas del prospecto principal
// (registrar gestión / reagendar), aunque el tab Prospectos se eliminó del UI.
const prospectoPrincipal = computed(() => e.value?.prospectos?.[0] || null);
function registrar(p) { prospectoActivo.value = p || prospectoPrincipal.value; showRegistrar.value = true; }
function agendar(p)   { prospectoActivo.value = p || prospectoPrincipal.value; showAgendar.value = true; }
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <button @click="router.back()" class="text-sm text-text3 hover:text-text1 mb-3">← Volver</button>

    <div v-if="!e" class="text-text3 text-center py-12">Cargando empresa...</div>

    <template v-else>
      <!-- Header B2B azul -->
      <header class="sv-card p-5 mb-4 border-l-4 border-area-emp">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="font-serif text-2xl text-brown-deep">{{ e.empresa_razon_social }}</h1>
              <span v-if="categoriaInfo"
                    class="text-xs px-2 py-1 rounded-full font-bold border"
                    :style="{ color: categoriaInfo.color, borderColor: categoriaInfo.color + '88', backgroundColor: categoriaInfo.color + '22' }">
                {{ categoriaInfo.icono }} {{ categoriaInfo.label }}
              </span>
            </div>
            <div v-if="e.empresa_nombre_comercial" class="text-sm text-text3">{{ e.empresa_nombre_comercial }}</div>
            <div class="flex flex-wrap gap-3 mt-2 text-sm text-text2">
              <span><strong>NIT:</strong> {{ fmtNit(e.empresa_nit) }}</span>
              <span v-if="e.tipo?.tipoemp_nombre">
                · <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-area-emp/15 text-area-emp text-xs font-semibold">{{ e.tipo.tipoemp_nombre }}</span>
              </span>
              <span v-if="e.empresa_sector">· {{ e.empresa_sector }}</span>
              <span v-if="e.empresa_num_empleados">· {{ e.empresa_num_empleados }} empleados</span>
              <span v-if="e.empresa_ciudad">· {{ e.empresa_ciudad }}</span>
            </div>
            <div v-if="e.grupoEmpresarial?.grupemp_nombre" class="text-xs text-text2 mt-1">
              🏢 Grupo empresarial: <strong>{{ e.grupoEmpresarial.grupemp_nombre }}</strong>
            </div>
            <div class="text-xs text-text2 mt-1 flex items-center gap-2">
              🔁 Seguimiento:
              <select
                v-model="periodicidadInline"
                @change="guardarPeriodicidad"
                :disabled="savingPeriodicidad"
                class="text-xs border border-text3/40 rounded-sv px-2 py-0.5 bg-white"
              >
                <option value="">Sin seguimiento automático</option>
                <option value="BIMENSUAL">Bimensual (2 meses)</option>
                <option value="TRIMESTRAL">Trimestral (3 meses)</option>
                <option value="ANUAL">Anual (12 meses)</option>
              </select>
              <span v-if="savingPeriodicidad" class="text-text3">guardando…</span>
            </div>
            <div v-if="prospectoPrincipal?.asesor" class="text-xs text-text3 mt-2">
              👤 Asesor: <strong>{{ prospectoPrincipal.asesor.usr_nombre }} {{ prospectoPrincipal.asesor.usr_apellido }}</strong>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <AreaBadge codigo="PREV-EMP" nombre="B2B" color-hex="#1A5C8A" size="sm" />
            <div v-if="auth.puedeReasignar" class="flex gap-1 flex-wrap justify-end">
              <BaseButton size="sm" variant="secondary" @click="showReasignarEmpresa = true">🔄 Reasignar</BaseButton>
              <BaseButton size="sm" variant="secondary" @click="showCategoria = true">🏷️ Categoría</BaseButton>
            </div>
          </div>
        </div>

        <!-- Indicador de presupuesto de fidelización -->
        <div v-if="presupuestoTotal > 0 || categoriaInfo" class="mt-4 border-t border-text3/10 pt-3">
          <div class="flex items-center justify-between mb-1 text-xs">
            <span class="text-text3 uppercase tracking-wide">Presupuesto fidelización</span>
            <span class="font-semibold">
              <span class="text-sage">{{ fmtMoneda(presupuestoDisponible) }}</span>
              <span class="text-text3"> de {{ fmtMoneda(presupuestoTotal) }}</span>
            </span>
          </div>
          <div v-if="presupuestoTotal > 0" class="h-2 bg-cream rounded-full overflow-hidden">
            <div class="h-full transition-all"
                 :class="presupuestoPct >= 90 ? 'bg-danger' : presupuestoPct >= 70 ? 'bg-warning' : 'bg-sage'"
                 :style="{ width: presupuestoPct + '%' }"></div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 mt-4">
          <a v-if="e.empresa_telefono" :href="linkTel(e.empresa_telefono)" class="sv-btn-secondary flex-col py-3">
            <span class="text-xl" aria-hidden="true">📞</span><span class="text-xs mt-1">Llamar</span>
          </a>
          <a v-if="e.empresa_email_corporativo" :href="`mailto:${e.empresa_email_corporativo}`" class="sv-btn-secondary flex-col py-3">
            <span class="text-xl" aria-hidden="true">✉️</span><span class="text-xs mt-1">Email</span>
          </a>
          <BaseButton variant="primary" class="flex-col py-3" @click="registrar()" :disabled="!prospectoPrincipal">
            <span class="text-xl" aria-hidden="true">📝</span><span class="text-xs mt-1">Registrar gestión</span>
          </BaseButton>
        </div>
      </header>

      <!-- Banner de vencimiento de convenio (≤ 60 días) -->
      <div v-if="convenioActivo && diasParaVencer != null && diasParaVencer <= 60 && diasParaVencer >= 0"
           class="sv-card p-4 mb-4 border"
           :class="diasParaVencer <= 15 ? 'border-danger/40 bg-danger/5'
                   : diasParaVencer <= 30 ? 'border-warning/40 bg-warning/5'
                   : 'border-gold/30 bg-gold/5'">
        <div class="flex items-center gap-3">
          <span class="text-2xl">⏰</span>
          <div class="flex-1">
            <div class="font-semibold"
                 :class="diasParaVencer <= 15 ? 'text-danger' : diasParaVencer <= 30 ? 'text-warning' : 'text-gold'">
              Convenio vence en {{ diasParaVencer }} día{{ diasParaVencer === 1 ? '' : 's' }}
              ({{ convenioActivo.prosp_fecha_vencimiento_convenio?.toString().slice(0, 10) }})
            </div>
            <p class="text-xs text-text2 mt-1">
              <template v-if="renovacionExistente">
                ✓ Ya existe un prospecto de renovación activo
                (<a class="underline" @click.prevent="">en {{ renovacionExistente.estado?.estado_nombre }}</a>).
              </template>
              <template v-else-if="diasParaVencer <= 30">
                El sistema creará automáticamente un prospecto de renovación esta noche (job 00:30).
              </template>
              <template v-else>
                Faltan {{ diasParaVencer - 30 }} días para que se cree la renovación automática.
              </template>
            </p>
          </div>
        </div>
      </div>

      <!-- Pipeline visual (basado en el primer prospecto activo) -->
      <section v-if="e.prospectos?.length && estadosGrupo.length" class="sv-card p-5 mb-4">
        <h3 class="text-xs text-text3 uppercase tracking-wide mb-2">Pipeline B2B</h3>
        <PipelineVisual :estados="estadosGrupo" :estado-actual-id="e.prospectos[0].prosp_estado_id" />
      </section>

      <!-- Banner Fidelización -->
      <BannerFidelizPendiente
        v-if="e.tiene_convenio_firmado"
        :contactos-count="contactosFideliz.length"
        @agregar="showFormContacto = true" />

      <!-- Tabs -->
      <div class="border-b border-text3/15 flex gap-1 mb-4 overflow-x-auto">
        <button v-for="t in ['contactos','documentos','propuestas','fidelizacion','historial']" :key="t"
                @click="tab = t"
                class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize whitespace-nowrap"
                :class="tab === t ? 'border-area-emp text-area-emp' : 'border-transparent text-text3 hover:text-text2'">
          <span v-if="t === 'fidelizacion'">💝 Fidelización</span>
          <span v-else-if="t === 'documentos'">📎 Documentos</span>
          <span v-else-if="t === 'propuestas'">📋 Propuestas</span>
          <span v-else>{{ t }}</span>
          <span v-if="t === 'contactos'"   class="ml-1 text-xs">({{ e.contactos?.length  || 0 }})</span>
          <span v-if="t === 'fidelizacion'" class="ml-1 text-xs">({{ contactosFideliz?.length || 0 }})</span>
          <span v-if="t === 'historial'"   class="ml-1 text-xs">({{ e.gestiones?.length  || 0 }})</span>
        </button>
      </div>

      <!-- Tab: Contactos (con botón Agregar) -->
      <section v-show="tab === 'contactos'" class="space-y-2">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-text2">Contactos vinculados a la empresa</h3>
          <BaseButton variant="primary" size="sm" @click="showFormContacto = true">+ Agregar contacto</BaseButton>
        </div>
        <EmptyState v-if="!e.contactos?.length" titulo="Sin contactos"
                    descripcion="Agrega los contactos clave de la empresa (gerencia, RRHH, contacto de pago…)" />
        <div v-for="c in e.contactos" :key="c.persona_id" class="sv-card p-3 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-area-emp/15 text-area-emp font-bold flex items-center justify-center text-sm">
            {{ (c.persona_nombre || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1">
            <div class="font-semibold text-text1">{{ c.persona_nombre }} {{ c.persona_apellido || '' }}</div>
            <div class="text-xs text-text3">{{ fmtTel(c.persona_telefono_principal) }} · {{ c.persona_email || '—' }}</div>
          </div>
        </div>
      </section>

      <!-- Tab: Documentos -->
      <section v-show="tab === 'documentos'">
        <DocumentosEmpresaTab :empresa-id="parseInt(route.params.id)" />
      </section>

      <!-- Tab: Propuestas (archivos, reemplaza generación PDF) -->
      <section v-show="tab === 'propuestas'">
        <PropuestasArchivoTab :empresa-id="parseInt(route.params.id)" />
      </section>

      <!-- Tab: Fidelización -->
      <section v-show="tab === 'fidelizacion'" class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-text2">Contactos para envío de detalles</h3>
          <BaseButton size="sm" variant="primary" @click="showFormContacto = true">+ Agregar contacto</BaseButton>
        </div>
        <EmptyState v-if="!contactosFideliz?.length" titulo="Aún no hay contactos de fidelización"
                    descripcion="Captura los empleados clave (gerencia, RRHH...) con sus fechas especiales para que el equipo de Fidelización pueda enviar detalles." />
        <article v-for="c in contactosFideliz" :key="c.cf_id"
                 class="sv-card p-4 flex items-center gap-3 hover:shadow-sv-pop cursor-pointer transition-shadow"
                 @click="router.push({ name: 'fideliz-contacto', params: { cfId: c.cf_id } })">
          <div class="w-10 h-10 rounded-full bg-warning/15 text-warning font-bold flex items-center justify-center">
            {{ (c.persona?.persona_nombre || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1">
            <div class="font-semibold text-text1">
              {{ c.persona?.persona_nombre }} {{ c.persona?.persona_apellido }}
              <span v-if="c.cf_es_titular" class="ml-2 text-xs text-gold">⭐ Titular</span>
            </div>
            <div class="text-xs text-text2">{{ c.cf_cargo || '—' }} <span v-if="c.cf_departamento">· {{ c.cf_departamento }}</span></div>
            <div class="text-xs text-text3">
              📅 {{ c.persona?.fechasEspeciales?.length || 0 }} fechas
              <span v-if="c.persona?.persona_fecha_nacimiento"> · cumple: {{ c.persona.persona_fecha_nacimiento }}</span>
              <span v-if="c.ultimo_envio"> · último envío: {{ String(c.ultimo_envio).slice(0,10) }}</span>
            </div>
          </div>
        </article>
      </section>

      <!-- Tab: Historial -->
      <section v-show="tab === 'historial'" class="sv-card p-4">
        <EmptyState v-if="!e.gestiones?.length" titulo="Sin gestiones registradas" />
        <div v-else class="space-y-0">
          <HistorialItem v-for="g in e.gestiones" :key="g.gest_id" :gestion="g" />
        </div>
      </section>

      <RegistrarGestion :open="showRegistrar" :prospecto="prospectoActivo" @close="showRegistrar = false" @registrada="cargar" />
      <AgendarProximaModal :open="showAgendar" :prospecto="prospectoActivo" @close="showAgendar = false" @actualizado="cargar" />
      <ReasignarAsesorEmpresaModal :open="showReasignarEmpresa" :empresa="e" @close="showReasignarEmpresa = false" @reasignado="cargar" />
      <CategoriaPresupuestoModal :open="showCategoria" :empresa="e" @close="showCategoria = false" @actualizada="cargar" />
      <FormContactoFideliz :open="showFormContacto" :empresa-id="parseInt(route.params.id)"
                           @close="showFormContacto = false"
                           @creado="cargarContactosFideliz" />
    </template>
  </div>
</template>
