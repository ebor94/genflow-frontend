<script setup>
/**
 * CargarListaModal.vue — sube CSV de prospectos masivos.
 * Columnas mínimas: nombre, telefono. Opcionales: apellido, telefono_alterno, email, direccion, barrio.
 */
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { listasApi } from '@/api/listasApi';
import { usuariosApi } from '@/api/usuariosApi';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  // Pre-selecciona una fuente por código (ej. 'LISTA_RECUPERA' para SVC)
  fuenteCodigoDefault: { type: String, default: null },
  // Rol del asesor a filtrar (default ASESOR; SVC puede usar AGENTE_SVC)
  rolAsesor: { type: String, default: 'ASESOR' },
  // Texto override del título
  titulo: { type: String, default: 'Cargar lista masiva' }
});
const emit = defineEmits(['close', 'cargada']);

const config = useConfigStore();
const auth   = useAuthStore();
const toast  = useToastStore();
const { notify } = useApiError();

const archivo  = ref(null);
const nombre   = ref('');
const fuenteId = ref('');
const asesorId = ref('');
const cargando = ref(false);
const asesores = ref([]);
const resultado = ref(null);

const opcFuentes = computed(() => (config.actual?.fuentes || [])
  .filter(f => f.fuente_activa && f.fuente_es_masiva)
  .map(f => ({ value: f.fuente_id, label: f.fuente_nombre })));

// Acepta ambos roles (ASESOR genérico + AGENTE_SVC para call center)
const opcAsesores = computed(() => asesores.value
  .filter(u => (u.rol?.rol_codigo === props.rolAsesor || u.rol?.rol_codigo === 'ASESOR') && u.usr_activo)
  .map(u => ({ value: u.usr_id, label: `${u.usr_nombre} ${u.usr_apellido}` })));

watch(() => props.open, async (v) => {
  if (v) {
    archivo.value = null; nombre.value = ''; fuenteId.value = ''; asesorId.value = ''; resultado.value = null;
    try { asesores.value = (await usuariosApi.list({ area_id: auth.areaActivaId })).data; }
    catch (e) { notify(e); }

    // Pre-seleccionar fuente si se pasó por prop
    if (props.fuenteCodigoDefault) {
      const f = (config.actual?.fuentes || []).find(x => x.fuente_codigo === props.fuenteCodigoDefault);
      if (f) fuenteId.value = f.fuente_id;
    }
  }
});

function onFile(e) {
  archivo.value = e.target.files?.[0] || null;
  if (archivo.value && !nombre.value) nombre.value = archivo.value.name.replace(/\.csv$/i, '');
}

async function cargar() {
  if (!archivo.value)  return toast.warning('Selecciona un archivo CSV');
  if (!fuenteId.value) return toast.warning('Selecciona la fuente');
  if (!asesorId.value) return toast.warning('Asigna a un asesor');

  cargando.value = true;
  try {
    const fd = new FormData();
    fd.append('archivo', archivo.value);
    fd.append('area_id',  auth.areaActivaId);
    fd.append('grupo_id', auth.usuario?.usr_grupo_id || '');
    fd.append('fuente_id', fuenteId.value);
    fd.append('asesor_id', asesorId.value);
    fd.append('nombre',   nombre.value);

    const r = await listasApi.cargar(fd);
    resultado.value = r.data;
    toast.success(`Lista procesada: ${r.data.lista_importadas} importadas, ${r.data.lista_duplicados_omit} duplicados, ${r.data.lista_errores} errores`);
    emit('cargada', r.data);
  } catch (e) {
    notify(e);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="titulo" max-width="max-w-xl" @close="emit('close')">
    <div v-if="!resultado" class="space-y-4">
      <p class="text-sm text-text2">Sube un archivo CSV con encabezados <code class="text-xs bg-cream px-1 rounded">nombre, telefono</code> (mínimo). Opcionales: apellido, telefono_alterno, email, direccion, barrio.</p>

      <BaseInput v-model="nombre" label="Nombre de la lista" placeholder="Lista febrero 2026" />

      <BaseSelect v-model="fuenteId" label="Fuente" :options="opcFuentes" required />
      <BaseSelect v-model="asesorId" label="Asesor asignado" :options="opcAsesores" required />

      <div>
        <label class="sv-label">Archivo CSV</label>
        <input type="file" accept=".csv,text/csv" @change="onFile"
               class="block w-full text-sm text-text2 file:mr-3 file:py-2 file:px-4 file:rounded-sv file:border-0 file:bg-gold file:text-white file:font-semibold file:cursor-pointer hover:file:bg-gold-bright" />
        <p v-if="archivo" class="text-xs text-text3 mt-1">{{ archivo.name }} ({{ (archivo.size / 1024).toFixed(1) }} KB)</p>
      </div>
    </div>

    <div v-else class="space-y-3">
      <div class="text-3xl text-center">✅</div>
      <h3 class="text-center font-serif text-xl text-brown-deep">Carga procesada</h3>
      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="sv-card p-3 border border-sage/40 bg-sage/5">
          <div class="text-2xl font-serif text-sage">{{ resultado.lista_importadas }}</div>
          <div class="text-xs text-text3">Importadas</div>
        </div>
        <div class="sv-card p-3 border border-warning/40 bg-warning/5">
          <div class="text-2xl font-serif text-warning">{{ resultado.lista_duplicados_omit }}</div>
          <div class="text-xs text-text3">Duplicadas</div>
        </div>
        <div class="sv-card p-3 border border-danger/40 bg-danger/5">
          <div class="text-2xl font-serif text-danger">{{ resultado.lista_errores }}</div>
          <div class="text-xs text-text3">Errores</div>
        </div>
      </div>
      <p class="text-xs text-text3 text-center">Total de filas procesadas: {{ resultado.lista_total_registros }}</p>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ resultado ? 'Cerrar' : 'Cancelar' }}</BaseButton>
      <BaseButton v-if="!resultado" variant="primary" :loading="cargando" @click="cargar">Procesar CSV</BaseButton>
    </template>
  </BaseModal>
</template>
