<script setup>
/**
 * CrudCatalogo — componente genérico para vistas de Admin/Catálogo.
 *
 * Props:
 *   - titulo: string
 *   - apiResource: objeto { list, create, update, toggle } (ej. configApi.areas)
 *   - columnas: [{ key, label, render?: (item)=>string }]
 *   - campos: [{ key, label, type, required?, options?, hint? }]
 *       type: 'text' | 'textarea' | 'select' | 'number' | 'color' | 'switch' | 'hidden'
 *   - filaActivaKey: nombre del campo booleano para toggle (ej 'area_activa')
 *   - filaIdKey: nombre del PK (ej 'area_id')
 *   - filtros (opcional): slot con filtros
 *   - presetValues (opcional): valores por defecto al crear (para inyectar area_id, grupo_id, etc)
 */
import { ref, onMounted, watch } from 'vue';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const props = defineProps({
  titulo:        { type: String, required: true },
  apiResource:   { type: Object, required: true },
  columnas:      { type: Array, required: true },
  campos:        { type: Array, required: true },
  filaActivaKey: { type: String, default: null },
  filaIdKey:     { type: String, required: true },
  presetValues:  { type: Object, default: () => ({}) }
});

const toast = useToastStore();
const { notify } = useApiError();

const items = ref([]);
const loading = ref(true);
const showModal = ref(false);
const editing = ref(null);
const form = ref({});
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    const r = await props.apiResource.list();
    items.value = r.data || [];
  } catch (e) {
    notify(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function abrirNuevo() {
  editing.value = null;
  form.value = { ...props.presetValues };
  for (const c of props.campos) {
    if (form.value[c.key] === undefined) {
      form.value[c.key] = c.type === 'switch' ? 1 : (c.type === 'number' ? 0 : '');
    }
  }
  showModal.value = true;
}

function abrirEdicion(item) {
  editing.value = item;
  form.value = JSON.parse(JSON.stringify(item));
  showModal.value = true;
}

async function guardar() {
  saving.value = true;
  try {
    // Limpiar campos vacíos opcionales
    const payload = { ...form.value };
    if (editing.value) {
      delete payload[props.filaIdKey];
      await props.apiResource.update(editing.value[props.filaIdKey], payload);
      toast.success('Actualizado.');
    } else {
      await props.apiResource.create(payload);
      toast.success('Creado.');
    }
    showModal.value = false;
    await load();
  } catch (e) {
    notify(e);
  } finally {
    saving.value = false;
  }
}

async function toggle(item) {
  try {
    await props.apiResource.toggle(item[props.filaIdKey]);
    await load();
  } catch (e) {
    notify(e);
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <header class="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <h1 class="font-serif text-3xl text-brown-deep">{{ titulo }}</h1>
      <BaseButton variant="primary" @click="abrirNuevo">+ Nuevo</BaseButton>
    </header>

    <slot name="filtros" />

    <div class="sv-card overflow-hidden">
      <div v-if="loading" class="px-5 py-12 text-text3 text-center">Cargando...</div>
      <EmptyState v-else-if="!items.length" titulo="Sin registros" mensaje="Aún no hay datos en este catálogo." icono="📭" />
      <table v-else class="w-full text-sm">
        <thead class="bg-cream text-text2">
          <tr>
            <th v-for="col in columnas" :key="col.key" class="text-left px-4 py-3 font-semibold">{{ col.label }}</th>
            <th class="text-right px-4 py-3 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-text3/10">
          <tr v-for="item in items" :key="item[filaIdKey]"
              :class="{ 'opacity-60': filaActivaKey && !item[filaActivaKey] }">
            <td v-for="col in columnas" :key="col.key" class="px-4 py-3">
              <template v-if="col.render">{{ col.render(item) }}</template>
              <template v-else-if="col.key === 'color_hex' || /color_hex$/.test(col.key)">
                <span class="inline-flex items-center gap-2">
                  <span class="w-4 h-4 rounded-full border border-text3/30" :style="`background-color: ${item[col.key] || '#ccc'}`"></span>
                  <code class="text-xs text-text3">{{ item[col.key] || '—' }}</code>
                </span>
              </template>
              <template v-else>{{ item[col.key] ?? '—' }}</template>
            </td>
            <td class="px-4 py-3 text-right space-x-2 whitespace-nowrap">
              <BaseButton size="sm" variant="ghost" @click="abrirEdicion(item)">Editar</BaseButton>
              <BaseButton v-if="filaActivaKey" size="sm" :variant="item[filaActivaKey] ? 'secondary' : 'success'" @click="toggle(item)">
                {{ item[filaActivaKey] ? 'Desactivar' : 'Activar' }}
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="showModal" :title="editing ? `Editar ${titulo.toLowerCase()}` : `Nuevo en ${titulo.toLowerCase()}`" @close="showModal = false">
      <form @submit.prevent="guardar" class="space-y-4">
        <template v-for="campo in campos" :key="campo.key">
          <div v-if="campo.type === 'hidden'" style="display:none">
            <input type="hidden" :value="form[campo.key]" />
          </div>

          <BaseInput v-else-if="campo.type === 'text' || !campo.type"
            v-model="form[campo.key]"
            :label="campo.label"
            :required="campo.required"
            :placeholder="campo.placeholder"
            :uppercase="campo.uppercase"
          />

          <BaseInput v-else-if="campo.type === 'number'"
            v-model.number="form[campo.key]"
            :label="campo.label"
            type="number"
            :required="campo.required"
            :placeholder="campo.placeholder"
          />

          <BaseInput v-else-if="campo.type === 'color'"
            v-model="form[campo.key]"
            :label="campo.label"
            type="color"
          />

          <BaseInput v-else-if="campo.type === 'email'"
            v-model="form[campo.key]"
            :label="campo.label"
            type="email"
            :required="campo.required"
          />

          <BaseInput v-else-if="campo.type === 'password'"
            v-model="form[campo.key]"
            :label="campo.label"
            type="password"
            :required="campo.required"
          />

          <BaseSelect v-else-if="campo.type === 'select'"
            v-model="form[campo.key]"
            :label="campo.label"
            :options="campo.options || []"
            :required="campo.required"
          />

          <BaseTextarea v-else-if="campo.type === 'textarea'"
            v-model="form[campo.key]"
            :label="campo.label"
            :rows="campo.rows || 3"
          />

          <label v-else-if="campo.type === 'switch'" class="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" :checked="!!form[campo.key]" @change="form[campo.key] = $event.target.checked ? 1 : 0"
                   class="w-4 h-4 rounded border-text3/40 text-gold focus:ring-gold" />
            <span class="text-sm text-text2 font-semibold">{{ campo.label }}</span>
          </label>

          <p v-if="campo.hint" class="text-xs text-text3 -mt-2 ml-1">{{ campo.hint }}</p>
        </template>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="showModal = false">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="saving" @click="guardar">{{ editing ? 'Guardar' : 'Crear' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
