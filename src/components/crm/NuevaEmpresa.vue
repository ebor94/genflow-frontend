<script setup>
/**
 * NuevaEmpresa.vue — wizard 3 pasos:
 *   1. NIT (anti-duplicados)
 *   2. Datos empresa
 *   3. Contacto principal + prospecto inicial
 */
import { ref, computed, watch } from 'vue';
import { useEmpresasStore } from '@/stores/useEmpresasStore';
import { useProspectosStore } from '@/stores/useProspectosStore';
import { useConfigStore } from '@/stores/useConfigStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { useNit } from '@/composables/useNit';
import { useTelefono } from '@/composables/useTelefono';
import { personasApi } from '@/api/personasApi';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import SelectorGrupoEmpresarial from '@/components/crm/SelectorGrupoEmpresarial.vue';

const props = defineProps({ open: { type: Boolean, required: true } });
const emit = defineEmits(['close', 'creada']);

const empresasStore = useEmpresasStore();
const prospStore    = useProspectosStore();
const config        = useConfigStore();
const auth          = useAuthStore();
const toast         = useToastStore();
const { notify }    = useApiError();
const { esValido: nitValido, formato: fmtNit } = useNit();
const { esValido: telValido } = useTelefono();

const paso = ref(1);
const empresaExistente = ref(null);
const loading = ref(false);

const empresa = ref({
  empresa_nit: '',
  empresa_razon_social: '',
  empresa_nombre_comercial: '',
  empresa_sector: '',
  empresa_num_empleados: null,
  empresa_telefono: '',
  empresa_email_corporativo: '',
  empresa_sitio_web: '',
  empresa_direccion: '',
  empresa_ciudad: 'Cucuta',
  empresa_nota: '',
  // Migración 017
  empresa_tipo_id: null,
  empresa_grupo_empresarial_id: null,
  // Migración 019
  empresa_periodicidad_seguimiento: ''
});

const opcPeriodicidad = [
  { value: '',           label: 'Sin seguimiento automático' },
  { value: 'BIMENSUAL',  label: 'Bimensual (cada 2 meses)' },
  { value: 'TRIMESTRAL', label: 'Trimestral (cada 3 meses)' },
  { value: 'ANUAL',      label: 'Anual (cada 12 meses)' }
];

const contacto = ref({
  persona_nombre: '',
  persona_apellido: '',
  persona_telefono_principal: '',
  persona_email: '',
  persona_cargo: ''
});

const prospecto = ref({
  prosp_estado_id: '',
  prosp_fuente_id: '',
  prosp_punto_id: '',
  prosp_prioridad: 3,
  prosp_nota_inicial: '',
  productos: []
});

const opcSectores = [
  'Manufactura','Salud','Comercio','Educación','Construcción','Tecnología',
  'Servicios','Logística','Financiero','Gobierno','Agropecuario','Otro'
].map(s => ({ value: s, label: s }));

// Catálogo de categorías (viene del bootstrap como tipos_empresa — migración 017)
const opcTipos = computed(() => (config.actual?.tipos_empresa || [])
  .filter(t => t.tipoemp_activo)
  .map(t => ({ value: t.tipoemp_id, label: t.tipoemp_nombre })));

const opcEstados = computed(() => (config.actual?.estados || [])
  .filter(e => e.estado_grupo_id === auth.usuario?.usr_grupo_id && e.estado_activo)
  .sort((a, b) => a.estado_orden - b.estado_orden)
  .map(e => ({ value: e.estado_id, label: e.estado_nombre })));

const opcFuentes = computed(() => (config.actual?.fuentes || [])
  .filter(f => f.fuente_activa)
  .map(f => ({ value: f.fuente_id, label: f.fuente_nombre })));

const opcPuntos = computed(() => (config.actual?.puntos || [])
  .filter(p => p.punto_activo)
  .map(p => ({ value: p.punto_id, label: `${p.punto_codigo} — ${p.punto_nombre}` })));

const opcProductos = computed(() => (config.actual?.productos || [])
  .filter(p => p.prod_area_id === auth.usuario?.usr_area_id && p.prod_activo)
  .sort((a, b) => a.prod_orden_display - b.prod_orden_display));

watch(() => props.open, (v) => {
  if (v) {
    paso.value = 1;
    empresaExistente.value = null;
    empresa.value = { empresa_nit: '', empresa_razon_social: '', empresa_nombre_comercial: '', empresa_sector: '',
      empresa_num_empleados: null, empresa_telefono: '', empresa_email_corporativo: '', empresa_sitio_web: '',
      empresa_direccion: '', empresa_ciudad: 'Cucuta', empresa_nota: '',
      empresa_tipo_id: null, empresa_grupo_empresarial_id: null,
      empresa_periodicidad_seguimiento: '' };
    contacto.value = { persona_nombre: '', persona_apellido: '', persona_telefono_principal: '', persona_email: '', persona_cargo: '' };
    prospecto.value = { prosp_estado_id: '', prosp_fuente_id: '', prosp_punto_id: '', prosp_prioridad: 3, prosp_nota_inicial: '', productos: [] };
    if (opcEstados.value.length) prospecto.value.prosp_estado_id = opcEstados.value[0].value;
  }
});

async function buscarNit() {
  if (!nitValido(empresa.value.empresa_nit)) {
    toast.warning('NIT inválido (mínimo 7 dígitos)');
    return;
  }
  loading.value = true;
  try {
    const r = await empresasApi_buscar(empresa.value.empresa_nit);
    empresaExistente.value = r;
  } catch (e) {
    if (e.response?.status === 404) {
      empresaExistente.value = null;
      paso.value = 2;
    } else { notify(e); }
  } finally { loading.value = false; }
}

// Workaround: para mantener el código local sencillo, importamos en el watcher.
import { empresasApi } from '@/api/empresasApi';
async function empresasApi_buscar(nit) {
  const r = await empresasApi.buscar(nit);
  return r.data;
}

function usarExistente() {
  Object.assign(empresa.value, empresaExistente.value);
  paso.value = 2;
}

function descartarExistente() {
  empresaExistente.value = null;
  paso.value = 2;
}

function irPaso3() {
  if (!empresa.value.empresa_razon_social) {
    toast.warning('Razón social requerida'); return;
  }
  if (!empresa.value.empresa_tipo_id) {
    toast.warning('La categoría de la empresa es obligatoria'); return;
  }
  paso.value = 3;
}

function toggleProducto(prodId) {
  const idx = prospecto.value.productos.findIndex(p => p.prod_id === prodId);
  if (idx >= 0) prospecto.value.productos.splice(idx, 1);
  else prospecto.value.productos.push({ prod_id: prodId, es_principal: prospecto.value.productos.length === 0 });
}

function esSeleccionado(prodId) {
  return prospecto.value.productos.some(p => p.prod_id === prodId);
}

async function finalizar() {
  if (!empresa.value.empresa_razon_social) {
    toast.warning('Razón social requerida'); paso.value = 2; return;
  }
  if (!contacto.value.persona_nombre || !contacto.value.persona_telefono_principal) {
    toast.warning('Contacto: nombre y teléfono requeridos'); return;
  }
  if (!telValido(contacto.value.persona_telefono_principal)) {
    toast.warning('Teléfono del contacto inválido'); return;
  }
  if (!prospecto.value.prosp_estado_id) {
    toast.warning('Estado inicial requerido'); return;
  }

  loading.value = true;
  try {
    // 1) Crear/reusar empresa
    let empresaId;
    if (empresaExistente.value) {
      empresaId = empresaExistente.value.empresa_id;
    } else {
      // '' → null para la periodicidad si el asesor no eligió
      const payload = { ...empresa.value };
      if (!payload.empresa_periodicidad_seguimiento) payload.empresa_periodicidad_seguimiento = null;
      const emp = await empresasStore.crear(payload);
      empresaId = emp.empresa_id;
    }

    // 2) Crear/reusar contacto (persona)
    let contactoId;
    try {
      const r = await personasApi.create({
        persona_nombre: contacto.value.persona_nombre,
        persona_apellido: contacto.value.persona_apellido || null,
        persona_telefono_principal: contacto.value.persona_telefono_principal,
        persona_email: contacto.value.persona_email || null
      });
      contactoId = r.data.persona_id;
    } catch (e) {
      if (e.response?.data?.error === 'DUPLICATE_PHONE') {
        contactoId = e.response.data.errors?.persona?.persona_id;
        toast.info('Contacto ya existía, lo reutilizamos.');
      } else { throw e; }
    }

    // 3) Crear prospecto
    const p = await prospStore.crear({
      prosp_area_id:    auth.usuario.usr_area_id,
      prosp_grupo_id:   auth.usuario.usr_grupo_id,
      prosp_empresa_id: empresaId,
      prosp_contacto_empresa_id: contactoId,
      prosp_estado_id:  parseInt(prospecto.value.prosp_estado_id),
      prosp_fuente_id:  prospecto.value.prosp_fuente_id ? parseInt(prospecto.value.prosp_fuente_id) : undefined,
      prosp_punto_id:   prospecto.value.prosp_punto_id  ? parseInt(prospecto.value.prosp_punto_id)  : undefined,
      prosp_prioridad:  prospecto.value.prosp_prioridad,
      prosp_nota_inicial: prospecto.value.prosp_nota_inicial || null,
      productos: prospecto.value.productos
    });

    toast.success('Empresa y prospecto creados');
    emit('creada', { empresa_id: empresaId, prospecto: p });
    emit('close');
  } catch (e) {
    notify(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open"
             :title="`Nueva empresa · Paso ${paso} de 3`"
             max-width="max-w-2xl"
             @close="emit('close')">
    <!-- Paso 1: NIT -->
    <div v-if="paso === 1" class="space-y-4">
      <p class="text-sm text-text2">Primero validamos si ya existe esta empresa en el sistema.</p>
      <BaseInput v-model="empresa.empresa_nit" label="NIT" placeholder="900234567-1" @keyup.enter="buscarNit" />

      <div v-if="empresaExistente" class="sv-card border border-warning/40 bg-warning/5 p-4">
        <div class="text-sm font-semibold text-warning mb-2">⚠️ Ya existe una empresa con este NIT</div>
        <div class="text-text1 font-semibold">{{ empresaExistente.empresa_razon_social }}</div>
        <div class="text-xs text-text3">{{ fmtNit(empresaExistente.empresa_nit) }} · {{ empresaExistente.empresa_sector || 'sin sector' }}</div>
        <div class="mt-3 flex gap-2">
          <BaseButton variant="primary" size="sm" @click="usarExistente">Usar esta empresa</BaseButton>
          <BaseButton variant="secondary" size="sm" @click="descartarExistente">Es diferente</BaseButton>
        </div>
      </div>
    </div>

    <!-- Paso 2: datos empresa -->
    <div v-if="paso === 2" class="space-y-4">
      <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseInput  v-model="empresa.empresa_nit" label="NIT" required :disabled="!!empresaExistente" />
        <BaseInput  v-model="empresa.empresa_razon_social" label="Razón social" required :disabled="!!empresaExistente" />
        <BaseInput  v-model="empresa.empresa_nombre_comercial" label="Nombre comercial" :disabled="!!empresaExistente" class="sm:col-span-2" />
        <BaseSelect v-model="empresa.empresa_tipo_id" label="Categoría" required :options="opcTipos" :disabled="!!empresaExistente" />
        <BaseSelect v-model="empresa.empresa_sector" label="Sector" :options="opcSectores" :disabled="!!empresaExistente" />
        <BaseSelect v-model="empresa.empresa_periodicidad_seguimiento"
                    label="Periodicidad de seguimiento" :options="opcPeriodicidad"
                    :disabled="!!empresaExistente" class="sm:col-span-2" />
        <div class="sm:col-span-2">
          <SelectorGrupoEmpresarial v-model="empresa.empresa_grupo_empresarial_id" />
        </div>
        <BaseInput  v-model.number="empresa.empresa_num_empleados" label="# empleados" type="number" :disabled="!!empresaExistente" />
        <BaseInput  v-model="empresa.empresa_telefono" label="Teléfono empresa" :disabled="!!empresaExistente" />
        <BaseInput  v-model="empresa.empresa_email_corporativo" label="Email corporativo" type="email" :disabled="!!empresaExistente" />
        <BaseInput  v-model="empresa.empresa_sitio_web" label="Sitio web" :disabled="!!empresaExistente" />
        <BaseInput  v-model="empresa.empresa_direccion" label="Dirección" :disabled="!!empresaExistente" class="sm:col-span-2" />
      </fieldset>
    </div>

    <!-- Paso 3: contacto + prospecto -->
    <div v-if="paso === 3" class="space-y-5">
      <fieldset>
        <legend class="font-serif text-base text-brown-deep mb-2">👤 Contacto principal en la empresa</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseInput v-model="contacto.persona_nombre"   label="Nombres"   required />
          <BaseInput v-model="contacto.persona_apellido" label="Apellidos" />
          <BaseInput v-model="contacto.persona_telefono_principal" label="Teléfono" required />
          <BaseInput v-model="contacto.persona_email" label="Email" type="email" />
        </div>
      </fieldset>

      <fieldset>
        <legend class="font-serif text-base text-brown-deep mb-2">🎯 Datos del prospecto B2B</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseSelect v-model="prospecto.prosp_estado_id" label="Estado inicial" :options="opcEstados" required />
          <BaseSelect v-model="prospecto.prosp_fuente_id" label="Fuente"  :options="opcFuentes" />
          <BaseSelect v-model="prospecto.prosp_punto_id"  label="Punto"   :options="opcPuntos" />
          <BaseSelect v-model="prospecto.prosp_prioridad" label="Prioridad (1-5)" :options="[1,2,3,4,5].map(n => ({ value: n, label: String(n) }))" />
        </div>

        <div class="mt-3">
          <label class="sv-label">Productos / planes de interés</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="prod in opcProductos" :key="prod.prod_id"
                    type="button" @click="toggleProducto(prod.prod_id)"
                    class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                    :class="esSeleccionado(prod.prod_id)
                      ? 'bg-area-emp text-white border-area-emp'
                      : 'bg-white text-text2 border-text3/30 hover:bg-cream'">
              {{ prod.prod_nombre }}
            </button>
          </div>
        </div>

        <BaseTextarea v-model="prospecto.prosp_nota_inicial" label="Nota inicial" class="mt-3" />
      </fieldset>
    </div>

    <template #footer>
      <template v-if="paso === 1">
        <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="loading" :disabled="!empresa.empresa_nit" @click="buscarNit">Validar NIT</BaseButton>
      </template>
      <template v-else-if="paso === 2">
        <BaseButton variant="secondary" @click="paso = 1">← Atrás</BaseButton>
        <BaseButton variant="primary"   @click="irPaso3"
                    :disabled="!empresa.empresa_razon_social || !empresa.empresa_tipo_id">Siguiente →</BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="secondary" @click="paso = 2">← Atrás</BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="finalizar">Crear empresa + prospecto</BaseButton>
      </template>
    </template>
  </BaseModal>
</template>
