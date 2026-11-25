<script setup>
/**
 * Subir el Excel del mes: elegir archivo → se revisa sin guardar → errores por fila,
 * o los cambios (antes → después) para confirmar. Se guarda con las filas revisadas.
 */
import { ref, computed, watch } from 'vue';
import { presupuestosApi } from '@/api/presupuestosApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { fmtCOP } from '@/utils/format';
import { mesLabel } from '@/utils/presupuesto';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  areaId: { type: Number, default: null },
  anio: { type: Number, required: true },
  mes: { type: Number, required: true }
});
const emit = defineEmits(['close', 'guardado']);

const toast = useToastStore();
const { extract } = useApiError();

const input = ref(null);
const revisando = ref(false);
const guardando = ref(false);
const resultado = ref(null);
const errorArchivo = ref('');

let revision = 0;
function limpiar() {
  revision++;
  resultado.value = null;
  errorArchivo.value = '';
  revisando.value = false;
  if (input.value) input.value.value = '';
}
watch(() => props.open, (abierta) => { if (abierta) limpiar(); });

async function elegirArchivo(e) {
  const archivo = e.target.files?.[0];
  limpiar();
  if (!archivo) return;
  const mio = revision;
  revisando.value = true;
  try {
    const fd = new FormData();
    fd.append('archivo', archivo);
    fd.append('area_id', props.areaId);
    fd.append('anio', props.anio);
    fd.append('mes', props.mes);
    const r = await presupuestosApi.revisar(fd);
    if (mio !== revision) return;
    resultado.value = r.data;
  } catch (err) {
    if (mio !== revision) return;
    errorArchivo.value = extract(err);
  } finally {
    if (mio === revision) revisando.value = false;
  }
}

const errores = computed(() => resultado.value?.errores || []);
const cambios = computed(() => resultado.value?.cambios || []);
const puedeGuardar = computed(() => !!resultado.value && !errores.value.length && cambios.value.length > 0);
const asesoresQueCambian = computed(() => new Set(cambios.value.map((c) => c.usr_id)).size);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const titulo = computed(() => puedeGuardar.value ? `Confirmar presupuesto de ${mesLabel(props.anio, props.mes)}` : 'Subir presupuesto');

async function confirmar() {
  guardando.value = true;
  try {
    await presupuestosApi.guardar({ area_id: props.areaId, anio: props.anio, mes: props.mes, filas: resultado.value.filas });
    toast.success('Presupuesto guardado');
    emit('guardado');
    emit('close');
  } catch (err) {
    toast.error(extract(err));
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" :title="titulo" max-width="max-w-2xl" @close="emit('close')">
    <label class="sv-label" for="presupuesto-archivo">Archivo de Excel (.xlsx)</label>
    <input
      id="presupuesto-archivo" ref="input" data-testid="archivo" type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      class="block w-full text-sm text-text1" @change="elegirArchivo"
    />
    <p class="mt-1 text-xs text-text3">Usa la plantilla del mes. Hasta 2 MB.</p>

    <p v-if="revisando" class="mt-4 text-sm text-text3">Revisando el archivo...</p>
    <p v-if="errorArchivo" data-testid="error-archivo" class="mt-4 text-sm text-text1 border border-danger bg-danger/10 rounded-sv px-3 py-2">{{ errorArchivo }}</p>

    <template v-if="resultado">
      <div v-if="errores.length" data-testid="errores" class="mt-4">
        <p class="text-sm font-semibold text-text1 mb-2">Corrige el archivo y vuelve a subirlo. No se guardó nada.</p>
        <ul class="space-y-1 text-sm text-text1 max-h-64 overflow-y-auto">
          <li v-for="(e, i) in errores" :key="i" class="border-l-4 border-danger pl-2">
            Fila {{ e.fila }}, columna {{ e.columna }}: {{ e.mensaje }}
          </li>
        </ul>
      </div>
      <p v-else-if="!cambios.length" class="mt-4 text-sm text-text1">El archivo no trae cambios: los valores son los que ya están guardados.</p>
      <div v-else class="mt-4">
        <p data-testid="resumen" class="text-sm font-semibold text-text1 mb-2">
          Cambian {{ plural(cambios.length, 'valor', 'valores') }} de {{ plural(asesoresQueCambian, 'asesor', 'asesores') }}.
        </p>
        <ul class="space-y-1 text-sm text-text1 max-h-64 overflow-y-auto">
          <li v-for="(c, i) in cambios" :key="i" data-testid="cambio" class="flex justify-between gap-3 border-b border-text3/10 py-1">
            <span>{{ c.nombre }}, {{ c.categoria }}</span>
            <span class="whitespace-nowrap">{{ fmtCOP(c.antes) }} → {{ fmtCOP(c.despues) }}</span>
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton v-if="puedeGuardar" data-testid="btn-confirmar" :loading="guardando" @click="confirmar">Confirmar y guardar</BaseButton>
    </template>
  </BaseModal>
</template>
