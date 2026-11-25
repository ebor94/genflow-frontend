<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { presupuestosApi } from '@/api/presupuestosApi';
import { fmtCOP, fmtFechaHora } from '@/utils/format';
import { cumplimiento, mesesOpciones } from '@/utils/presupuesto';

import KpiCard from '@/components/dashboard/KpiCard.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import ChipCumplimiento from '@/components/prenec/ChipCumplimiento.vue';
import BarrasPresupuesto from '@/components/prenec/BarrasPresupuesto.vue';
import TablaPresupuesto from '@/components/prenec/TablaPresupuesto.vue';
import SubirPresupuestoModal from '@/components/prenec/SubirPresupuestoModal.vue';

const auth = useAuthStore();
const toast = useToastStore();
const { extract } = useApiError();

const opciones = mesesOpciones(14);
const hoy = new Date();
const mes = ref(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`);
const datos = ref(null);
const cargando = ref(false);
const error = ref(false);
const grupoSel = ref(null);
const asesorSel = ref(null);
const bajando = ref(false);
const subiendo = ref(false);

const periodo = () => {
  const [anio, m] = mes.value.split('-').map(Number);
  return { area_id: auth.areaActivaId, anio, mes: m };
};

// Cada pedido lleva un número: si llega tarde uno viejo, no pisa al nuevo.
let pedido = 0;
async function cargar() {
  const mio = ++pedido;
  cargando.value = true;
  error.value = false;
  try {
    const r = await presupuestosApi.obtener(periodo());
    if (mio !== pedido) return;
    datos.value = r.data;
    grupoSel.value = tabs.value[0]?.grupo_id ?? null;
    asesorSel.value = datos.value.asesores.length === 1 ? datos.value.asesores[0].usr_id : null;
  } catch (e) {
    if (mio !== pedido) return;
    datos.value = null;
    error.value = true;
    toast.error(extract(e));
  } finally {
    if (mio === pedido) cargando.value = false;
  }
}

function cambiarMes(valor) {
  mes.value = valor;
  cargar();
}

onMounted(cargar);

const asesores = computed(() => datos.value?.asesores || []);
const categorias = computed(() => datos.value?.categorias || []);

// Pestañas por grupo; quien no está en ningún grupo conocido no se pierde: va en "Sin grupo".
const tabs = computed(() => {
  const grupos = (datos.value?.grupos || []).map((g) => ({ grupo_id: g.grupo_id, nombre: g.nombre }));
  const conocidos = new Set(grupos.map((g) => g.grupo_id));
  if (asesores.value.some((a) => !conocidos.has(a.grupo_id))) grupos.push({ grupo_id: null, nombre: 'Sin grupo' });
  return grupos;
});
const hayTabs = computed(() => tabs.value.length > 1);

const visibles = computed(() => {
  if (!hayTabs.value) return asesores.value;
  const conocidos = new Set(tabs.value.map((t) => t.grupo_id));
  return asesores.value.filter((a) => (conocidos.has(a.grupo_id) ? a.grupo_id : null) === grupoSel.value);
});

const soloUno = computed(() => asesores.value.length === 1);
const totales = computed(() => visibles.value.reduce(
  (t, a) => ({ presupuesto: t.presupuesto + (Number(a.presupuesto) || 0), realizado: t.realizado + (Number(a.realizado) || 0) }),
  { presupuesto: 0, realizado: 0 }
));
const pctTotal = computed(() => cumplimiento(totales.value.realizado, totales.value.presupuesto));

const elegido = computed(() => visibles.value.find((a) => a.usr_id === asesorSel.value) || null);

function elegirGrupo(id) {
  grupoSel.value = id;
  asesorSel.value = null;
}

// ── Plantilla ──
async function mensajeDeBlob(blob) {
  try {
    const j = JSON.parse(await blob.text());
    return j.message || j.error || null;
  } catch { return null; }
}

async function descargarPlantilla() {
  const { anio, mes: m } = periodo();
  const porDefecto = `presupuesto-prenecesidad-${anio}-${String(m).padStart(2, '0')}.xlsx`;
  bajando.value = true;
  try {
    const r = await presupuestosApi.plantilla({ area_id: auth.areaActivaId, anio, mes: m });
    if (r.data?.type?.includes('json')) {
      toast.error((await mensajeDeBlob(r.data)) || 'No se pudo descargar la plantilla');
      return;
    }
    const cd = r.headers?.['content-disposition'] || '';
    const nombre = /filename="?([^";]+)"?/i.exec(cd)?.[1] || porDefecto;
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    const data = e?.response?.data;
    const msg = data instanceof Blob ? await mensajeDeBlob(data) : null;
    toast.error(msg || extract(e));
  } finally {
    bajando.value = false;
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 tabular-nums lining-nums">
    <header class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <h1 class="font-serif text-3xl text-brown-deep">Presupuesto</h1>
        <BaseSelect :model-value="mes" :options="opciones" class="min-w-[170px]" @update:model-value="cambiarMes" />
      </div>
      <div v-if="datos?.puede_cargar" class="flex items-center gap-2 flex-wrap">
        <BaseButton variant="secondary" data-testid="btn-plantilla" :loading="bajando" @click="descargarPlantilla">Plantilla del mes</BaseButton>
        <BaseButton data-testid="btn-subir" @click="subiendo = true">Subir presupuesto</BaseButton>
      </div>
    </header>

    <div v-if="cargando" class="text-text3 text-center py-12">Cargando...</div>
    <div v-else-if="error" data-testid="error-presupuesto" class="sv-card p-5 text-center text-text2">
      No se pudo cargar el presupuesto.
      <button type="button" class="ml-2 underline text-text1" @click="cargar">Reintentar</button>
    </div>
    <template v-else-if="datos">
      <p v-if="datos.actualizado" data-testid="actualizado" class="text-xs text-text3 mb-3">
        Última actualización<template v-if="datos.actualizado.por">: {{ datos.actualizado.por }}</template><template v-if="datos.actualizado.en"> · {{ fmtFechaHora(datos.actualizado.en) }}</template>
      </p>

      <div v-if="!asesores.length" class="sv-card p-6 text-center text-text3">No hay asesores para este mes.</div>
      <template v-else>
        <div v-if="hayTabs" role="tablist" class="flex gap-1 flex-wrap mb-4 border-b border-text3/20">
          <button
            v-for="t in tabs" :key="t.grupo_id ?? 'sin'" type="button" role="tab"
            :aria-selected="String(t.grupo_id === grupoSel)"
            class="px-3 py-2 text-sm -mb-px border-b-2 transition-colors"
            :class="t.grupo_id === grupoSel ? 'border-gold text-text1 font-semibold' : 'border-transparent text-text3 hover:text-text1'"
            @click="elegirGrupo(t.grupo_id)"
          >{{ t.nombre }}</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div data-testid="total-presupuesto"><KpiCard label="Presupuesto" icon="🎯" :value="fmtCOP(totales.presupuesto)" /></div>
          <div data-testid="total-realizado"><KpiCard label="Realizado" icon="💰" :value="fmtCOP(totales.realizado)" /></div>
          <div data-testid="total-cumplimiento" class="sv-card p-5">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-text3 font-semibold uppercase tracking-wider">Cumplimiento</span>
              <span class="text-xl opacity-70" aria-hidden="true">📈</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-serif text-3xl text-text1">{{ pctTotal === null ? '—' : `${pctTotal} %` }}</span>
              <ChipCumplimiento v-if="pctTotal !== null" solo-icono :realizado="totales.realizado" :presupuesto="totales.presupuesto" />
            </div>
          </div>
        </div>

        <div v-if="!soloUno" class="sv-card p-5 mb-5">
          <h2 class="font-serif text-lg text-brown-deep mb-3">Por asesor</h2>
          <BarrasPresupuesto :asesores="visibles" :seleccionado="asesorSel" @seleccionar="asesorSel = $event" />
        </div>

        <div v-if="elegido" data-testid="tabla-presupuesto" class="sv-card p-5">
          <h2 data-testid="tabla-titulo" class="font-serif text-lg text-brown-deep mb-3">{{ elegido.nombre }}</h2>
          <TablaPresupuesto :asesor="elegido" :categorias="categorias" />
        </div>
        <p v-else-if="!soloUno" class="text-center text-sm text-text3">Toca un asesor para ver su detalle por categoría.</p>
      </template>
    </template>

    <SubirPresupuestoModal
      v-if="datos?.puede_cargar"
      :open="subiendo" :area-id="auth.areaActivaId" :anio="periodo().anio" :mes="periodo().mes"
      @close="subiendo = false" @guardado="cargar"
    />
  </div>
</template>
