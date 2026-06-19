<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { empresasApi } from '@/api/empresasApi';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const props = defineProps({
  empresaId: { type: Number, required: true }
});

const toast = useToastStore();
const auth = useAuthStore();

const propuestas = ref([]);
const cargando = ref(false);
const showUpload = ref(false);
const enviando = ref(false);

const TIPOS = [
  { value: 'vinculacion', label: 'Vinculación' },
  { value: 'renovacion',  label: 'Renovación' },
  { value: 'adendum',     label: 'Adendum' },
  { value: 'otro',        label: 'Otro' }
];

const form = ref({
  titulo: '', descripcion: '', tipo: 'vinculacion',
  valor: '', vigencia_desde: '', vigencia_hasta: '', archivo: null
});

const puedeBorrar = computed(() =>
  ['SUPER_ADMIN', 'ADMIN_AREA', 'SUPERVISOR'].includes(auth.rolCodigo)
);

async function cargar() {
  cargando.value = true;
  try {
    const r = await empresasApi.listarPropuestasArchivo(props.empresaId);
    propuestas.value = Array.isArray(r) ? r : (r?.data || []);
  } catch (e) {
    toast.error('Error cargando propuestas');
  } finally {
    cargando.value = false;
  }
}

function abrirSubida() {
  form.value = {
    titulo: '', descripcion: '', tipo: 'vinculacion',
    valor: '', vigencia_desde: '', vigencia_hasta: '', archivo: null
  };
  showUpload.value = true;
}

function onFile(e) {
  form.value.archivo = e.target.files?.[0] || null;
  if (form.value.archivo && !form.value.titulo) {
    form.value.titulo = form.value.archivo.name.replace(/\.[^.]+$/, '');
  }
}

async function subir() {
  if (!form.value.titulo)  { toast.warning('Indica un título'); return; }
  if (!form.value.archivo) { toast.warning('Adjunta el archivo'); return; }
  enviando.value = true;
  try {
    const fd = new FormData();
    ['titulo','descripcion','tipo','valor','vigencia_desde','vigencia_hasta'].forEach(k => {
      if (form.value[k]) fd.append(k, form.value[k]);
    });
    fd.append('archivo', form.value.archivo);
    await empresasApi.subirPropuestaArchivo(props.empresaId, fd);
    toast.success('Propuesta cargada');
    showUpload.value = false;
    cargar();
  } catch (e) {
    toast.error(e.response?.data?.message || 'Error al subir');
  } finally {
    enviando.value = false;
  }
}

async function eliminar(p) {
  if (!confirm(`¿Eliminar la propuesta "${p.prop_titulo}"?`)) return;
  try {
    await empresasApi.eliminarPropuestaArchivo(p.prop_id);
    toast.success('Propuesta eliminada');
    cargar();
  } catch (e) {
    toast.error(e.response?.data?.message || 'Error');
  }
}

const apiBase = computed(() => {
  const base = import.meta.env.VITE_API_URL || '/api/sv';
  const root = base.replace(/\/api\/sv\/?$/, '');
  return root || '';
});
const urlArchivo = (rel) => `${apiBase.value}/${rel.replace(/^\/+/, '')}`;

const fmtMoneda = (n) => n ? new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n) : null;

const tipoLabel = (codigo) => TIPOS.find(t => t.value === codigo)?.label || codigo;

const tipoColor = (codigo) => ({
  vinculacion: 'bg-area-emp/15 text-area-emp',
  renovacion:  'bg-gold/20 text-gold',
  adendum:     'bg-warning/15 text-warning',
  otro:        'bg-text3/15 text-text2'
}[codigo] || 'bg-text3/15 text-text2');

onMounted(cargar);
watch(() => props.empresaId, cargar);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <div>
        <h3 class="font-serif text-lg text-text1">📋 Propuestas</h3>
        <p class="text-xs text-text3">Histórico de propuestas de vinculación, renovación y adenda</p>
      </div>
      <BaseButton variant="primary" size="sm" @click="abrirSubida">+ Cargar propuesta</BaseButton>
    </div>

    <div v-if="cargando" class="text-text3 text-center py-8">Cargando...</div>
    <EmptyState v-else-if="!propuestas.length"
                titulo="Sin propuestas cargadas"
                descripcion="Sube la propuesta de vinculación o renovación correspondiente." />

    <ul v-else class="sv-card divide-y divide-text3/10">
      <li v-for="p in propuestas" :key="p.prop_id" class="px-4 py-3 flex items-start gap-3">
        <div class="w-10 h-10 rounded-sv bg-area-emp/15 text-area-emp flex items-center justify-center text-xl shrink-0">📋</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" :class="tipoColor(p.prop_tipo)">
              {{ tipoLabel(p.prop_tipo) }}
            </span>
            <span class="font-semibold text-text1">{{ p.prop_titulo }}</span>
            <span v-if="p.prop_valor" class="text-xs text-sage font-semibold">{{ fmtMoneda(p.prop_valor) }}</span>
          </div>
          <div v-if="p.prop_descripcion" class="text-xs text-text2 mt-1">{{ p.prop_descripcion }}</div>
          <div class="text-xs text-text3 mt-1 flex gap-2 flex-wrap">
            <span v-if="p.prop_vigencia_desde">Vigencia: {{ p.prop_vigencia_desde }} → {{ p.prop_vigencia_hasta || '—' }}</span>
            <span v-if="p.subidoPor">· por {{ p.subidoPor.usr_nombre }} {{ p.subidoPor.usr_apellido }}</span>
            <span>· {{ new Date(p.prop_subido_at).toLocaleDateString() }}</span>
          </div>
        </div>
        <a :href="urlArchivo(p.prop_archivo_url)" target="_blank" rel="noopener"
           class="shrink-0 text-area-emp hover:underline text-sm font-semibold">Descargar</a>
        <button v-if="puedeBorrar" @click="eliminar(p)" class="shrink-0 text-danger hover:bg-danger/10 px-2 py-1 rounded">🗑️</button>
      </li>
    </ul>

    <BaseModal :open="showUpload" title="Cargar propuesta" max-width="max-w-md" @close="showUpload = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="sv-label">Tipo</label>
            <BaseSelect v-model="form.tipo" :options="TIPOS" />
          </div>
          <div>
            <label class="sv-label">Valor (COP, opcional)</label>
            <BaseInput v-model="form.valor" type="number" placeholder="Ej. 2500000" />
          </div>
        </div>
        <div>
          <label class="sv-label">Título</label>
          <BaseInput v-model="form.titulo" placeholder="Ej. Propuesta vinculación 2026" />
        </div>
        <div>
          <label class="sv-label">Archivo (PDF preferido, máx 15 MB)</label>
          <input type="file" @change="onFile" class="w-full text-sm" accept=".pdf,.doc,.docx,.xls,.xlsx" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="sv-label">Vigencia desde</label>
            <BaseInput v-model="form.vigencia_desde" type="date" />
          </div>
          <div>
            <label class="sv-label">Vigencia hasta</label>
            <BaseInput v-model="form.vigencia_hasta" type="date" />
          </div>
        </div>
        <BaseTextarea v-model="form.descripcion" rows="2" label="Descripción / notas" />
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showUpload = false">Cancelar</BaseButton>
        <BaseButton variant="primary" :disabled="enviando" @click="subir">
          {{ enviando ? 'Subiendo...' : 'Subir' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
