<script setup>
/**
 * RegistrarEnvioModal.vue — modal para registrar el envío de un detalle.
 *
 * Dos modos:
 *  1. Evento próximo (desde Panel/Calendario): tipo y año vienen del evento.
 *  2. Ad-hoc (desde Mis Contactos / Ficha Contacto): tipo y año seleccionables.
 *     Útil cuando la gerencia llama y pide enviar un detalle especial.
 *
 * El props `evento` debe traer al menos: persona, empresa, persona_id, cargo.
 * Si `evento.adHoc === true` se muestran selectores de tipo y año.
 */
import { ref, computed, watch } from 'vue';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import dayjs from 'dayjs';

import BaseModal    from '@/components/ui/BaseModal.vue';
import BaseInput    from '@/components/ui/BaseInput.vue';
import BaseSelect   from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton   from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open:    { type: Boolean, required: true },
  evento:  { type: Object, default: null }
});
const emit = defineEmits(['close', 'registrado']);

const fidelizStore = useFidelizacionStore();
const toast        = useToastStore();
const { notify }   = useApiError();

const tipoEvento   = ref('otro');         // solo se usa en modo ad-hoc
const anioEvento   = ref(dayjs().year()); // solo se usa en modo ad-hoc
const tipoDetalle  = ref('');
const tipoDetallePersonalizado = ref('');
const direccion    = ref('');
const estado       = ref('enviado');
const comentario   = ref('');
const costo        = ref('');
const archivoFoto  = ref(null);
const loading      = ref(false);

const esAdHoc = computed(() => props.evento?.adHoc === true);

const TIPOS_EVENTO = [
  { value: 'nacimiento',          label: '🎂 Cumpleaños' },
  { value: 'aniversario_laboral', label: '💼 Aniversario laboral' },
  { value: 'aniversario_boda',    label: '💍 Aniversario de boda' },
  { value: 'dia_madre',           label: '💐 Día de la Madre' },
  { value: 'dia_padre',           label: '👔 Día del Padre' },
  { value: 'otro',                label: '🎉 Otro (solicitud especial)' }
];

const ANIOS = Array.from({ length: 3 }, (_, i) => {
  const a = dayjs().year() + i - 1;
  return { value: a, label: String(a) };
});

const ESTADOS = [
  { value: 'enviado',    label: '📤 Enviado' },
  { value: 'confirmado', label: '✅ Confirmado por destinatario' },
  { value: 'devuelto',   label: '↩️ Devuelto / no entregado' }
];

const PLANTILLAS_DETALLE = [
  'Tarjeta + arreglo floral',
  'Bono regalo',
  'Tarjeta personalizada',
  'Detalle corporativo',
  'Llamada de felicitación',
  'Caja chocolates',
  'Almuerzo cortesía',
  'Otro'
];

watch(() => props.open, (v) => {
  if (v) {
    // Inicializar desde el evento
    tipoEvento.value  = props.evento?.tipo || 'otro';
    anioEvento.value  = props.evento?.evento_anio || dayjs().year();
    tipoDetalle.value = '';
    tipoDetallePersonalizado.value = '';
    direccion.value   = props.evento?.persona?.persona_direccion || '';
    estado.value      = 'enviado';
    comentario.value  = '';
    costo.value       = '';
    archivoFoto.value = null;
  }
});

function onFile(e) {
  archivoFoto.value = e.target.files[0] || null;
}

const detalleFinal = computed(() => {
  if (tipoDetalle.value === 'Otro') return tipoDetallePersonalizado.value;
  return tipoDetalle.value;
});

async function guardar() {
  if (!props.evento) return;
  if (esAdHoc.value && !tipoEvento.value) {
    toast.warning('Selecciona el motivo del envío'); return;
  }
  loading.value = true;
  try {
    // 1) Registrar envío
    const payload = {
      persona_id:        props.evento.persona_id,
      empresa_id:        props.evento.empresa.empresa_id,
      fecha_especial_id: esAdHoc.value ? null : (props.evento.fecha_especial_id || null),
      evento_anio:       esAdHoc.value ? parseInt(anioEvento.value) : props.evento.evento_anio,
      evento_tipo:       esAdHoc.value ? tipoEvento.value : props.evento.tipo,
      tipo_detalle:      detalleFinal.value || null,
      direccion_entrega: direccion.value || null,
      estado:            estado.value,
      comentario:        comentario.value || null,
      costo:             costo.value ? parseFloat(costo.value) : null   // descuenta del presupuesto si > 0
    };
    const envio = await fidelizStore.registrarEnvio(payload);

    // 2) Subir evidencia si hay archivo
    if (archivoFoto.value && envio.env_id) {
      await fidelizStore.subirEvidencia(envio.env_id, archivoFoto.value);
    }

    toast.success(esAdHoc.value ? 'Envío ad-hoc registrado' : 'Envío registrado');
    emit('registrado', envio);
    emit('close');
  } catch (e) {
    if (e.response?.data?.error === 'DUPLICATE_ENVIO') {
      toast.warning('Ya existe un envío para este contacto en este evento del año');
    } else { notify(e); }
  } finally { loading.value = false; }
}
</script>

<template>
  <BaseModal :open="open"
             :title="esAdHoc ? 'Registrar envío ad-hoc' : `Registrar envío · ${evento?.tipo || ''}`"
             max-width="max-w-xl"
             @close="emit('close')">
    <div v-if="evento" class="space-y-4">
      <!-- Datos del contacto -->
      <div class="bg-cream/60 rounded-sv p-3">
        <div class="text-xs text-text3">Para</div>
        <div class="font-semibold text-text1">
          {{ evento.persona.persona_nombre }} {{ evento.persona.persona_apellido }}
        </div>
        <div class="text-xs text-text2">{{ evento.cargo || '—' }} · {{ evento.empresa.empresa_razon_social }}</div>
        <div v-if="!esAdHoc" class="text-xs text-text3 mt-1">
          📅 {{ evento.fecha_evento }} · {{ evento.descripcion }}
        </div>
      </div>

      <!-- Selectores ad-hoc: tipo + año -->
      <div v-if="esAdHoc" class="bg-warning/5 border border-warning/30 rounded-sv p-3 space-y-3">
        <p class="text-xs text-warning font-semibold">
          📞 Envío fuera de calendario (solicitud directa de gerencia, ocasión especial...)
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseSelect v-model="tipoEvento" label="Motivo del envío" :options="TIPOS_EVENTO" required />
          <BaseSelect v-model="anioEvento" label="Año del evento" :options="ANIOS" required />
        </div>
      </div>

      <BaseSelect v-model="tipoDetalle" label="Tipo de detalle enviado"
                  :options="PLANTILLAS_DETALLE.map(p => ({ value: p, label: p }))"
                  placeholder="Elegir tipo" />
      <BaseInput v-if="tipoDetalle === 'Otro'"
                 v-model="tipoDetallePersonalizado"
                 label="Especificar tipo"
                 placeholder="Ej: Caja de vinos artesanales" />

      <BaseInput  v-model="direccion" label="Dirección de entrega"
                  placeholder="Av. Libertadores 12-5, oficina 301" />

      <!-- Costo (descuenta del presupuesto fidelización de la empresa si > 0) -->
      <div>
        <BaseInput v-model="costo" type="number" min="0" step="100"
                   label="💰 Costo estimado (COP, opcional)"
                   placeholder="Ej. 80000" />
        <p class="text-[11px] text-text3 mt-1">
          Si indicas un costo, se descontará automáticamente del presupuesto de fidelización de la empresa.
        </p>
      </div>

      <BaseSelect v-model="estado" label="Estado del envío" :options="ESTADOS" />

      <div>
        <label class="sv-label">📷 Foto evidencia (opcional)</label>
        <input type="file" accept="image/*" @change="onFile" class="sv-input" />
        <p v-if="archivoFoto" class="text-xs text-sage mt-1">✓ {{ archivoFoto.name }}</p>
      </div>

      <BaseTextarea v-model="comentario" label="Comentario interno" placeholder="Notas para el equipo..." />
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="loading" @click="guardar">
        {{ esAdHoc ? 'Registrar envío ad-hoc' : 'Registrar envío' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
