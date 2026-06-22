<script setup>
/**
 * NuevoEventoAgendaModal.vue
 * Crea o edita un evento en la agenda del asesor (migración 018).
 * Supervisor+ puede asignar el evento a otro asesor de su grupo.
 *
 *   <NuevoEventoAgendaModal
 *      v-model:show="show"
 *      :fecha-default="'2026-06-25'"
 *      :asesor-id-default="123"    <- relevante para supervisor (asesor lo ignora)
 *      :evento-edit="null|obj"
 *      @guardado="recargar" />
 */
import { ref, watch, computed, onMounted } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { usuariosApi } from '@/api/usuariosApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  show:           { type: Boolean, required: true },
  fechaDefault:   { type: String,  default: '' },        // YYYY-MM-DD
  asesorIdDefault:{ type: [Number, null], default: null },
  eventoEdit:     { type: Object,  default: null }
});
const emit = defineEmits(['update:show', 'guardado']);

const auth      = useAuthStore();
const toast     = useToastStore();
const { notify } = useApiError();

const form = ref({
  titulo: '', descripcion: '', tipo: 'OTRO',
  fecha: '', hora: '09:00',
  asesor_id: null,
  prosp_id: null, empresa_id: null
});
const loading      = ref(false);
const asesoresList = ref([]);

const tipos = [
  { value: 'REUNION',      label: 'Reunión' },
  { value: 'VISITA',       label: 'Visita' },
  { value: 'CAPACITACION', label: 'Capacitación' },
  { value: 'LLAMADA',      label: 'Llamada' },
  { value: 'PERSONAL',     label: 'Personal' },
  { value: 'OTRO',         label: 'Otro' }
];

const puedeAsignarOtros = computed(() =>
  ['SUPER_ADMIN','GERENTE_GENERAL','ADMIN_AREA','JEFE_PAP','SUPERVISOR'].includes(auth.rolCodigo)
);

const titulo = computed(() => props.eventoEdit ? 'Editar evento' : 'Nueva actividad');

watch(() => props.show, async (v) => {
  if (!v) return;
  if (props.eventoEdit) {
    const e = props.eventoEdit;
    const dt = new Date(e.evento_fecha_hora);
    form.value = {
      titulo: e.evento_titulo,
      descripcion: e.evento_descripcion || '',
      tipo: e.evento_tipo,
      fecha: dt.toISOString().slice(0,10),
      hora:  dt.toTimeString().slice(0,5),
      asesor_id: e.evento_asesor_id,
      prosp_id: e.evento_prosp_id,
      empresa_id: e.evento_empresa_id
    };
  } else {
    form.value = {
      titulo: '', descripcion: '', tipo: 'OTRO',
      fecha: props.fechaDefault || new Date().toISOString().slice(0,10),
      hora: '09:00',
      asesor_id: props.asesorIdDefault || auth.usuario?.usr_id,
      prosp_id: null, empresa_id: null
    };
  }
  if (puedeAsignarOtros.value && !asesoresList.value.length) {
    try {
      const r = await usuariosApi.list({ activo: 1, limit: 200 });
      const lista = (r.data?.items || r.data || []);
      asesoresList.value = lista
        .filter(u => ['ASESOR','AGENTE_SVC'].includes(u.rol?.rol_codigo))
        .map(u => ({ value: u.usr_id, label: `${u.usr_nombre} ${u.usr_apellido || ''} — ${u.grupo?.grupo_codigo || ''}` }));
    } catch (_) { /* silencioso */ }
  }
});

async function guardar() {
  if (!form.value.titulo.trim()) { toast.warning('El título es requerido'); return; }
  if (!form.value.fecha || !form.value.hora) { toast.warning('Fecha y hora son requeridas'); return; }
  loading.value = true;
  const payload = {
    titulo:      form.value.titulo.trim(),
    descripcion: form.value.descripcion || null,
    tipo:        form.value.tipo,
    fecha_hora:  `${form.value.fecha} ${form.value.hora}:00`,
    asesor_id:   puedeAsignarOtros.value ? form.value.asesor_id : undefined,
    prosp_id:    form.value.prosp_id || null,
    empresa_id:  form.value.empresa_id || null
  };
  try {
    if (props.eventoEdit) {
      await eventosAgendaApi.update(props.eventoEdit.evento_id, payload);
      toast.success('Evento actualizado');
    } else {
      await eventosAgendaApi.create(payload);
      toast.success('Evento creado');
    }
    emit('guardado');
    emit('update:show', false);
  } catch (e) {
    notify(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseModal :open="show" :title="titulo" max-width="max-w-lg" @close="emit('update:show', false)">
    <div class="space-y-4">
      <BaseInput v-model="form.titulo" label="Título" required placeholder="Ej: Reunión con cliente X" />

      <div class="grid grid-cols-2 gap-3">
        <BaseInput  v-model="form.fecha" type="date" label="Fecha" required />
        <BaseInput  v-model="form.hora"  type="time" label="Hora"  required />
      </div>

      <BaseSelect v-model="form.tipo" label="Tipo" :options="tipos" />

      <BaseSelect
        v-if="puedeAsignarOtros && asesoresList.length"
        v-model="form.asesor_id"
        label="Asignar a (asesor)"
        :options="asesoresList"
      />

      <BaseTextarea v-model="form.descripcion" label="Descripción (opcional)" rows="3" />

      <p class="text-xs text-text3">
        💡 Vinculación a prospecto/empresa específica próximamente.
      </p>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('update:show', false)">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="loading" @click="guardar">
        {{ eventoEdit ? 'Guardar cambios' : 'Crear evento' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
