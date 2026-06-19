<script setup>
/**
 * NuevoProspecto.vue — flujo 2 pasos para crear persona + prospecto.
 * Paso 1: validar teléfono (anti-duplicados)
 * Paso 2: completar datos persona + prospecto
 *
 * Props: open, areaId (forzar área), grupoId (forzar grupo)
 * Emit: close, creado (prospecto)
 */
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import { personasApi } from '@/api/personasApi';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import ProspectosCrossArea from '@/components/crm/ProspectosCrossArea.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  areaId:  { type: Number, default: null },
  grupoId: { type: Number, default: null },
  subproceso: { type: String, default: null }   // 'nuevo' | 'recuperacion' (SVC)
});
const emit = defineEmits(['close', 'creado']);

const config = useConfigStore();
const auth   = useAuthStore();
const store  = useProspectosStore();
const toast  = useToastStore();
const { notify } = useApiError();
const { formato, esValido } = useTelefono();

const paso = ref(1);
const telefono = ref('');
const personaExistente = ref(null);
const prospectosActivos = ref([]);   // cross-área: prospectos existentes del cliente
const buscando = ref(false);
const saving = ref(false);

const persona = ref({
  persona_nombre: '',
  persona_apellido: '',
  persona_telefono_principal: '',
  persona_telefono_alterno: '',
  persona_email: '',
  persona_direccion: '',
  persona_barrio: '',
  persona_documento_tipo: '',
  persona_documento_num: ''
});

const prospecto = ref({
  prosp_fuente_id: '',
  prosp_punto_id: '',
  prosp_estado_id: '',
  prosp_prioridad: 3,
  prosp_nota_inicial: '',
  productos: []
});

const areaIdEffective = computed(() => props.areaId  || auth.usuario?.usr_area_id);
const grupoIdEffective = computed(() => props.grupoId || auth.usuario?.usr_grupo_id);

const opcFuentes = computed(() => (config.actual?.fuentes || [])
  .filter(f => f.fuente_activa)
  .map(f => ({ value: f.fuente_id, label: f.fuente_nombre })));

const opcPuntos = computed(() => (config.actual?.puntos || [])
  .filter(p => p.punto_activo)
  .map(p => ({ value: p.punto_id, label: `${p.punto_codigo} — ${p.punto_nombre}` })));

const opcEstadosIniciales = computed(() => (config.actual?.estados || [])
  .filter(e => e.estado_grupo_id === grupoIdEffective.value && e.estado_activo)
  .sort((a, b) => a.estado_orden - b.estado_orden)
  .map(e => ({ value: e.estado_id, label: e.estado_nombre })));

const opcProductos = computed(() => (config.actual?.productos || [])
  .filter(p => p.prod_area_id === areaIdEffective.value && p.prod_activo)
  .sort((a, b) => a.prod_orden_display - b.prod_orden_display));

watch(() => props.open, (v) => {
  if (v) {
    paso.value = 1;
    telefono.value = '';
    personaExistente.value = null;
    persona.value = { persona_nombre: '', persona_apellido: '', persona_telefono_principal: '',
      persona_telefono_alterno: '', persona_email: '', persona_direccion: '', persona_barrio: '',
      persona_documento_tipo: '', persona_documento_num: '' };
    prospecto.value = { prosp_fuente_id: '', prosp_punto_id: '', prosp_estado_id: '',
      prosp_prioridad: 3, prosp_nota_inicial: '', productos: [] };
    // Pre-seleccionar primer estado
    if (opcEstadosIniciales.value.length) {
      prospecto.value.prosp_estado_id = opcEstadosIniciales.value[0].value;
    }
  }
});

async function validarTelefono() {
  if (!esValido(telefono.value)) {
    toast.warning('Teléfono inválido (mínimo 7 dígitos)');
    return;
  }
  buscando.value = true;
  try {
    const r = await personasApi.buscar(telefono.value);
    // Respuesta cross-área: { persona, prospectos_activos }
    personaExistente.value = r.data.persona || r.data;
    prospectosActivos.value = r.data.prospectos_activos || [];
  } catch (e) {
    if (e.response?.status === 404) {
      personaExistente.value = null;
      prospectosActivos.value = [];
      persona.value.persona_telefono_principal = telefono.value;
      paso.value = 2;
    } else { notify(e); }
  } finally { buscando.value = false; }
}

function toggleProducto(prodId) {
  const idx = prospecto.value.productos.findIndex(p => p.prod_id === prodId);
  if (idx >= 0) prospecto.value.productos.splice(idx, 1);
  else prospecto.value.productos.push({ prod_id: prodId, es_principal: prospecto.value.productos.length === 0 });
}

function esSeleccionado(prodId) {
  return prospecto.value.productos.some(p => p.prod_id === prodId);
}

async function crear() {
  if (!persona.value.persona_nombre || !persona.value.persona_telefono_principal) {
    toast.warning('Nombre y teléfono son obligatorios');
    return;
  }
  if (!prospecto.value.prosp_estado_id) {
    toast.warning('Selecciona un estado inicial');
    return;
  }
  saving.value = true;
  try {
    let personaId;
    if (personaExistente.value) {
      personaId = personaExistente.value.persona_id;
    } else {
      const pCreated = await personasApi.create(persona.value);
      personaId = pCreated.data.persona_id;
    }
    const payload = {
      prosp_area_id:  areaIdEffective.value,
      prosp_grupo_id: grupoIdEffective.value,
      prosp_persona_id: personaId,
      prosp_estado_id: parseInt(prospecto.value.prosp_estado_id),
      prosp_fuente_id: prospecto.value.prosp_fuente_id ? parseInt(prospecto.value.prosp_fuente_id) : undefined,
      prosp_punto_id:  prospecto.value.prosp_punto_id  ? parseInt(prospecto.value.prosp_punto_id)  : undefined,
      prosp_prioridad: prospecto.value.prosp_prioridad,
      prosp_subproceso: props.subproceso || null,   // SVC: 'recuperacion'
      prosp_nota_inicial: prospecto.value.prosp_nota_inicial || null,
      productos: prospecto.value.productos
    };
    const p = await store.crear(payload);
    toast.success('Prospecto creado');
    emit('creado', p);
    emit('close');
  } catch (e) {
    if (e.response?.data?.error === 'DUPLICATE_PHONE') {
      const err = e.response.data.errors || {};
      personaExistente.value = err.persona;
      prospectosActivos.value = err.prospectos_activos || [];
      paso.value = 1;
      toast.warning('Ya existe una persona con ese teléfono');
    } else {
      notify(e);
    }
  } finally {
    saving.value = false;
  }
}

function usarExistente() {
  persona.value = { ...personaExistente.value };
  paso.value = 2;
}

function descartarExistente() {
  personaExistente.value = null;
  persona.value.persona_telefono_principal = telefono.value;
  paso.value = 2;
}
</script>

<template>
  <BaseModal :open="open" :title="paso === 1 ? 'Nuevo prospecto · Paso 1' : 'Nuevo prospecto · Paso 2'" max-width="max-w-2xl" @close="emit('close')">
    <!-- Paso 1: validar teléfono -->
    <div v-if="paso === 1" class="space-y-4">
      <p class="text-sm text-text2">Primero validamos si ya existe esta persona en el sistema.</p>
      <BaseInput v-model="telefono" label="Teléfono principal" inputmode="tel" placeholder="3115550001"
                 @keyup.enter="validarTelefono" />

      <div v-if="personaExistente" class="space-y-3">
        <div class="sv-card border border-warning/40 bg-warning/5 p-4">
          <div class="text-sm font-semibold text-warning mb-2">⚠️ Ya existe una persona con este teléfono</div>
          <div class="text-text1 font-semibold">
            {{ personaExistente.persona_nombre }} {{ personaExistente.persona_apellido || '' }}
          </div>
          <div class="text-xs text-text3">
            {{ formato(personaExistente.persona_telefono_principal) }} ·
            {{ personaExistente.persona_email || 'sin email' }}
          </div>
          <div class="mt-3 flex gap-2 flex-wrap">
            <BaseButton variant="primary" size="sm" @click="usarExistente">Continuar y crear en mi área</BaseButton>
            <BaseButton variant="secondary" size="sm" @click="descartarExistente">Es alguien diferente</BaseButton>
          </div>
        </div>

        <!-- Cross-área: prospectos activos del cliente en OTRAS áreas -->
        <ProspectosCrossArea
          :prospectos="prospectosActivos"
          :ocultar-area-id="areaIdEffective"
          tono="warning"
          @abrir="emit('close')"
        />
      </div>
    </div>

    <!-- Paso 2: completar datos -->
    <div v-if="paso === 2" class="space-y-5">
      <fieldset class="space-y-3">
        <legend class="font-serif text-base text-brown-deep mb-1">👤 Datos personales</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseInput v-model="persona.persona_nombre"   label="Nombres"   required :disabled="!!personaExistente" />
          <BaseInput v-model="persona.persona_apellido" label="Apellidos" :disabled="!!personaExistente" />
          <BaseInput v-model="persona.persona_telefono_principal" label="Teléfono principal" required :disabled="!!personaExistente" />
          <BaseInput v-model="persona.persona_telefono_alterno"   label="Teléfono alterno" :disabled="!!personaExistente" />
          <BaseInput v-model="persona.persona_email"     label="Email" type="email" :disabled="!!personaExistente" />
          <BaseInput v-model="persona.persona_barrio"    label="Barrio" :disabled="!!personaExistente" />
          <BaseInput v-model="persona.persona_direccion" label="Dirección" class="sm:col-span-2" :disabled="!!personaExistente" />
        </div>
      </fieldset>

      <fieldset class="space-y-3">
        <legend class="font-serif text-base text-brown-deep mb-1">🎯 Datos comerciales</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseSelect v-model="prospecto.prosp_fuente_id" label="Fuente"  :options="opcFuentes" />
          <BaseSelect v-model="prospecto.prosp_punto_id"  label="Punto"   :options="opcPuntos" />
          <BaseSelect v-model="prospecto.prosp_estado_id" label="Estado inicial" :options="opcEstadosIniciales" required />
          <BaseSelect v-model="prospecto.prosp_prioridad" label="Prioridad (1-5)" :options="[1,2,3,4,5].map(n=>({value:n,label:String(n)}))" />
        </div>

        <div>
          <label class="sv-label">Productos de interés</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="prod in opcProductos" :key="prod.prod_id"
                    type="button"
                    @click="toggleProducto(prod.prod_id)"
                    class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                    :class="esSeleccionado(prod.prod_id)
                      ? 'bg-gold text-white border-gold'
                      : 'bg-white text-text2 border-text3/30 hover:bg-cream'">
              {{ prod.prod_nombre }}
            </button>
          </div>
        </div>

        <BaseTextarea v-model="prospecto.prosp_nota_inicial" label="Nota inicial" />
      </fieldset>
    </div>

    <template #footer>
      <template v-if="paso === 1">
        <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="buscando" :disabled="!telefono" @click="validarTelefono">
          Validar teléfono
        </BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="secondary" @click="paso = 1">← Atrás</BaseButton>
        <BaseButton variant="primary" :loading="saving" @click="crear">Crear prospecto</BaseButton>
      </template>
    </template>
  </BaseModal>
</template>
