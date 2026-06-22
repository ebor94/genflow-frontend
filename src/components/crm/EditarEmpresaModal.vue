<script setup>
/**
 * EditarEmpresaModal — modificar datos básicos de una empresa existente.
 *
 *   <EditarEmpresaModal v-model:open="show" :empresa="e" @guardado="cargar" />
 *
 * Solo edita campos descriptivos. La reasignación de asesor, el tier de
 * fidelización (categoría BRONCE/PLATA/ORO/...) y la periodicidad de
 * seguimiento se mantienen en sus modales/controles propios.
 */
import { ref, watch, computed } from 'vue';
import { useEmpresasStore } from '@/stores/useEmpresasStore';
import { useConfigStore }   from '@/stores/useConfigStore';
import { useToastStore }    from '@/stores/useToastStore';
import { useApiError }      from '@/composables/useApiError';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import SelectorGrupoEmpresarial from '@/components/crm/SelectorGrupoEmpresarial.vue';

const props = defineProps({
  open:    { type: Boolean, required: true },
  empresa: { type: Object,  required: true }
});
const emit = defineEmits(['update:open', 'guardado']);

const store   = useEmpresasStore();
const config  = useConfigStore();
const toast   = useToastStore();
const { notify } = useApiError();

const form    = ref({});
const loading = ref(false);

const opcSectores = [
  'Manufactura','Salud','Comercio','Educación','Construcción','Tecnología',
  'Servicios','Logística','Financiero','Gobierno','Agropecuario','Otro'
].map(s => ({ value: s, label: s }));

const opcTipos = computed(() => (config.actual?.tipos_empresa || [])
  .filter(t => t.tipoemp_activo)
  .map(t => ({ value: t.tipoemp_id, label: t.tipoemp_nombre })));

const opcPeriodicidad = [
  { value: '',           label: 'Sin seguimiento automático' },
  { value: 'BIMENSUAL',  label: 'Bimensual (cada 2 meses)' },
  { value: 'TRIMESTRAL', label: 'Trimestral (cada 3 meses)' },
  { value: 'ANUAL',      label: 'Anual (cada 12 meses)' }
];

watch(() => props.open, (v) => {
  if (!v) return;
  const e = props.empresa || {};
  form.value = {
    empresa_nit:                      e.empresa_nit || '',
    empresa_razon_social:             e.empresa_razon_social || '',
    empresa_nombre_comercial:         e.empresa_nombre_comercial || '',
    empresa_tipo_id:                  e.empresa_tipo_id || e.tipo?.tipoemp_id || null,
    empresa_sector:                   e.empresa_sector || '',
    empresa_num_empleados:            e.empresa_num_empleados ?? null,
    empresa_telefono:                 e.empresa_telefono || '',
    empresa_email_corporativo:        e.empresa_email_corporativo || '',
    empresa_sitio_web:                e.empresa_sitio_web || '',
    empresa_direccion:                e.empresa_direccion || '',
    empresa_ciudad:                   e.empresa_ciudad || 'Cucuta',
    empresa_nota:                     e.empresa_nota || '',
    empresa_grupo_empresarial_id:     e.empresa_grupo_empresarial_id || e.grupoEmpresarial?.grupemp_id || null,
    empresa_periodicidad_seguimiento: e.empresa_periodicidad_seguimiento || ''
  };
});

async function guardar() {
  if (!form.value.empresa_razon_social?.trim()) { toast.warning('Razón social requerida'); return; }
  if (!form.value.empresa_tipo_id)              { toast.warning('Categoría requerida');    return; }
  loading.value = true;
  try {
    const payload = { ...form.value };
    // Normalizar '' → null para opcionales que el backend prefiere null
    if (!payload.empresa_periodicidad_seguimiento) payload.empresa_periodicidad_seguimiento = null;
    if (!payload.empresa_grupo_empresarial_id)    payload.empresa_grupo_empresarial_id    = null;
    await store.actualizar(props.empresa.empresa_id, payload);
    toast.success('Empresa actualizada');
    emit('guardado');
    emit('update:open', false);
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}
</script>

<template>
  <BaseModal :open="open" title="Editar empresa" max-width="max-w-2xl" @close="emit('update:open', false)">
    <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <BaseInput  v-model="form.empresa_nit"              label="NIT" />
      <BaseInput  v-model="form.empresa_razon_social"     label="Razón social" required />
      <BaseInput  v-model="form.empresa_nombre_comercial" label="Nombre comercial" class="sm:col-span-2" />

      <BaseSelect v-model="form.empresa_tipo_id"          label="Categoría" required :options="opcTipos" />
      <BaseSelect v-model="form.empresa_sector"           label="Sector" :options="opcSectores" />

      <div class="sm:col-span-2">
        <SelectorGrupoEmpresarial v-model="form.empresa_grupo_empresarial_id" />
      </div>

      <BaseSelect v-model="form.empresa_periodicidad_seguimiento"
                  label="Periodicidad de seguimiento" :options="opcPeriodicidad" class="sm:col-span-2" />

      <BaseInput  v-model.number="form.empresa_num_empleados" label="# empleados" type="number" />
      <BaseInput  v-model="form.empresa_telefono"             label="Teléfono empresa" />
      <BaseInput  v-model="form.empresa_email_corporativo"    label="Email corporativo" type="email" />
      <BaseInput  v-model="form.empresa_sitio_web"            label="Sitio web" />
      <BaseInput  v-model="form.empresa_direccion"            label="Dirección" class="sm:col-span-2" />
      <BaseInput  v-model="form.empresa_ciudad"               label="Ciudad" />

      <BaseTextarea v-model="form.empresa_nota" label="Nota" class="sm:col-span-2" />
    </fieldset>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('update:open', false)">Cancelar</BaseButton>
      <BaseButton variant="primary" :loading="loading" @click="guardar">Guardar cambios</BaseButton>
    </template>
  </BaseModal>
</template>
