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

const documentos = ref([]);
const tipos = ref([]);
const cargando = ref(false);
const showUpload = ref(false);
const enviando = ref(false);

const form = ref({ tipo_id: '', nombre: '', observaciones: '', archivo: null });

const puedeBorrar = computed(() =>
  ['SUPER_ADMIN', 'ADMIN_AREA', 'SUPERVISOR'].includes(auth.rolCodigo)
);

const tiposOpts = computed(() => tipos.value.map(t => ({ value: t.tipo_id, label: t.tipo_nombre })));

async function cargar() {
  cargando.value = true;
  try {
    const [docs, tps] = await Promise.all([
      empresasApi.listarDocumentos(props.empresaId),
      empresasApi.listarTipos(false)
    ]);
    documentos.value = Array.isArray(docs) ? docs : (docs?.data || []);
    tipos.value      = Array.isArray(tps) ? tps : (tps?.data || []);
  } catch (e) {
    toast.error('Error cargando documentos');
  } finally {
    cargando.value = false;
  }
}

function abrirSubida(tipoId = '') {
  form.value = { tipo_id: tipoId || '', nombre: '', observaciones: '', archivo: null };
  showUpload.value = true;
}

function onFile(e) {
  form.value.archivo = e.target.files?.[0] || null;
  if (form.value.archivo && !form.value.nombre) {
    form.value.nombre = form.value.archivo.name.replace(/\.[^.]+$/, '');
  }
}

async function subir() {
  if (!form.value.tipo_id) { toast.warning('Selecciona el tipo de documento'); return; }
  if (!form.value.archivo) { toast.warning('Adjunta un archivo'); return; }
  enviando.value = true;
  try {
    const fd = new FormData();
    fd.append('tipo_id', form.value.tipo_id);
    fd.append('nombre', form.value.nombre || '');
    fd.append('observaciones', form.value.observaciones || '');
    fd.append('archivo', form.value.archivo);
    await empresasApi.subirDocumento(props.empresaId, fd);
    toast.success('Documento subido');
    showUpload.value = false;
    cargar();
  } catch (e) {
    toast.error(e.response?.data?.message || 'Error al subir');
  } finally {
    enviando.value = false;
  }
}

async function eliminar(doc) {
  if (!confirm(`¿Eliminar "${doc.doc_nombre}"?`)) return;
  try {
    await empresasApi.eliminarDocumento(doc.doc_id);
    toast.success('Documento eliminado');
    cargar();
  } catch (e) {
    toast.error(e.response?.data?.message || 'Error');
  }
}

const apiBase = computed(() => {
  // construir URL absoluta al archivo desde la base API
  const base = import.meta.env.VITE_API_URL || '/api/sv';
  const root = base.replace(/\/api\/sv\/?$/, '');
  return root || '';
});

const urlArchivo = (rutaRelativa) => `${apiBase.value}/${rutaRelativa.replace(/^\/+/, '')}`;

const fmtSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

onMounted(cargar);
watch(() => props.empresaId, cargar);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <div>
        <h3 class="font-serif text-lg text-text1">📎 Documentos</h3>
        <p class="text-xs text-text3">Cámara de Comercio, RUT, cédula RL y otros adjuntos</p>
      </div>
      <BaseButton variant="primary" size="sm" @click="abrirSubida()">+ Subir documento</BaseButton>
    </div>

    <!-- Tipos obligatorios pendientes -->
    <div v-if="!cargando" class="mb-3 flex flex-wrap gap-2">
      <button v-for="t in tipos.filter(x => x.tipo_obligatorio)" :key="t.tipo_id"
              type="button" @click="abrirSubida(t.tipo_id)"
              class="text-xs px-2 py-1 rounded-full border"
              :class="documentos.some(d => d.doc_tipo_id === t.tipo_id)
                ? 'bg-sage/15 border-sage/40 text-sage'
                : 'bg-warning/10 border-warning/40 text-warning hover:bg-warning/20'">
        <span v-if="documentos.some(d => d.doc_tipo_id === t.tipo_id)">✓</span>
        <span v-else>+</span>
        {{ t.tipo_nombre }}
      </button>
    </div>

    <div v-if="cargando" class="text-text3 text-center py-8">Cargando...</div>
    <EmptyState v-else-if="!documentos.length"
                titulo="Sin documentos"
                descripcion="Sube la cámara de comercio, RUT y cédula del representante legal." />

    <ul v-else class="sv-card divide-y divide-text3/10">
      <li v-for="d in documentos" :key="d.doc_id" class="px-4 py-3 flex items-center gap-3">
        <div class="w-10 h-10 rounded-sv bg-gold/15 text-gold flex items-center justify-center text-xl shrink-0">📄</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-area-emp/15 text-area-emp font-semibold">
              {{ d.tipo?.tipo_nombre || '—' }}
            </span>
            <span class="font-semibold text-text1 truncate">{{ d.doc_nombre }}</span>
          </div>
          <div class="text-xs text-text3 mt-0.5">
            {{ fmtSize(d.doc_archivo_size) }}
            <span v-if="d.subidoPor"> · subido por {{ d.subidoPor.usr_nombre }} {{ d.subidoPor.usr_apellido }}</span>
            <span> · {{ new Date(d.doc_subido_at).toLocaleDateString() }}</span>
          </div>
          <div v-if="d.doc_observaciones" class="text-xs text-text2 mt-1 italic">{{ d.doc_observaciones }}</div>
        </div>
        <a :href="urlArchivo(d.doc_archivo_url)" target="_blank" rel="noopener"
           class="shrink-0 text-area-emp hover:underline text-sm font-semibold">Descargar</a>
        <button v-if="puedeBorrar" @click="eliminar(d)"
                class="shrink-0 text-danger hover:bg-danger/10 px-2 py-1 rounded">🗑️</button>
      </li>
    </ul>

    <!-- Modal subir -->
    <BaseModal :open="showUpload" title="Subir documento" max-width="max-w-md" @close="showUpload = false">
      <div class="space-y-3">
        <div>
          <label class="sv-label">Tipo de documento</label>
          <BaseSelect v-model="form.tipo_id" :options="tiposOpts" placeholder="Seleccionar..." />
        </div>
        <div>
          <label class="sv-label">Nombre / título</label>
          <BaseInput v-model="form.nombre" placeholder="Ej. Cámara 2025" />
        </div>
        <div>
          <label class="sv-label">Archivo (máx 15 MB)</label>
          <input type="file" @change="onFile" class="w-full text-sm" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" />
        </div>
        <BaseTextarea v-model="form.observaciones" rows="2" placeholder="Observaciones (opcional)" label="Observaciones" />
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
