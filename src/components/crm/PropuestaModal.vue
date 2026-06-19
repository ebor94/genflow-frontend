<script setup>
/**
 * PropuestaModal.vue — editor de propuesta B2B.
 *   - Lista de items (descripcion, cantidad, precio, %desc, subtotal)
 *   - Total + descuento global + vigencia
 *   - Botones: Guardar borrador / Preview PDF / Enviar por correo
 */
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { propuestasApi } from '@/api/propuestasApi';
import { fmtCOP } from '@/utils/format';

import BaseModal from '@/components/ui/BaseModal.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  prospecto: { type: Object, default: null },   // necesario para crear nueva propuesta
  propuestaId: { type: Number, default: null }  // si se pasa, edita propuesta existente
});
const emit = defineEmits(['close', 'guardada', 'enviada']);

const config = useConfigStore();
const toast  = useToastStore();
const { notify } = useApiError();

const propuesta = ref(null);
const items = ref([]);
const descuentoPct = ref(0);
const vigencia = ref(30);
const notas = ref('');
const destinatario = ref('');
const asunto = ref('');
const mensaje = ref('');
const loading = ref(false);
const enviando = ref(false);

const productosArea = computed(() => (config.actual?.productos || [])
  .filter(p => p.prod_area_id === props.prospecto?.prosp_area_id && p.prod_activo));

watch(() => props.open, async (v) => {
  if (v) {
    if (props.propuestaId) {
      loading.value = true;
      try {
        const r = await propuestasApi.get(props.propuestaId);
        propuesta.value = r.data;
        items.value = (r.data.items || []).map(it => ({ ...it }));
        descuentoPct.value = parseFloat(r.data.prop_descuento_pct) || 0;
        vigencia.value = r.data.prop_vigencia_dias || 30;
        notas.value = r.data.prop_notas || '';
      } catch (e) { notify(e); }
      finally { loading.value = false; }
    } else {
      propuesta.value = null;
      items.value = [];
      descuentoPct.value = 0;
      vigencia.value = 30;
      notas.value = 'Condiciones: Pago a 30 días. Esta propuesta es confidencial.';
      destinatario.value = props.prospecto?.contacto?.persona_email || '';
      asunto.value = '';
      mensaje.value = '';
    }
  }
});

function agregarItem(prod = null) {
  items.value.push({
    pi_prod_id:        prod?.prod_id || null,
    pi_descripcion:    prod?.prod_nombre || '',
    pi_cantidad:       1,
    pi_precio_unitario: parseFloat(prod?.prod_precio_base || 0),
    pi_descuento_pct:  0,
    pi_subtotal:       parseFloat(prod?.prod_precio_base || 0)
  });
  recalcular();
}

function eliminarItem(i) { items.value.splice(i, 1); recalcular(); }

function recalcular() {
  for (const it of items.value) {
    const bruto = it.pi_cantidad * parseFloat(it.pi_precio_unitario || 0);
    const desc = bruto * (parseFloat(it.pi_descuento_pct || 0) / 100);
    it.pi_subtotal = +(bruto - desc).toFixed(2);
  }
}

const subtotal = computed(() => items.value.reduce((s, it) => s + (parseFloat(it.pi_subtotal) || 0), 0));
const total    = computed(() => +(subtotal.value * (1 - (descuentoPct.value || 0) / 100)).toFixed(2));

async function guardar(luegoEnviar = false) {
  if (!items.value.length) return toast.warning('Agrega al menos un item');
  loading.value = true;
  try {
    if (propuesta.value?.prop_id) {
      const r = await propuestasApi.update(propuesta.value.prop_id, {
        prop_descuento_pct: descuentoPct.value,
        prop_vigencia_dias: vigencia.value,
        prop_notas: notas.value,
        prop_destinatario: destinatario.value || undefined,
        items: items.value
      });
      propuesta.value = r.data;
    } else {
      const r = await propuestasApi.create({
        prop_prospecto_id: props.prospecto.prosp_id,
        prop_empresa_id:   props.prospecto.prosp_empresa_id,
        prop_contacto_id:  props.prospecto.prosp_contacto_empresa_id || null,
        prop_descuento_pct: descuentoPct.value,
        prop_vigencia_dias: vigencia.value,
        prop_notas: notas.value,
        items: items.value
      });
      propuesta.value = r.data;
    }
    toast.success('Borrador guardado');
    emit('guardada', propuesta.value);
    if (luegoEnviar) return enviar();
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

async function previsualizar() {
  if (!propuesta.value?.prop_id) await guardar();
  if (!propuesta.value?.prop_id) return;
  window.open(propuestasApi.previewUrl(propuesta.value.prop_id), '_blank');
}

async function enviar() {
  if (!destinatario.value) return toast.warning('Indica el destinatario (email)');
  if (!propuesta.value?.prop_id) {
    await guardar(); if (!propuesta.value?.prop_id) return;
  }
  enviando.value = true;
  try {
    const r = await propuestasApi.enviar(propuesta.value.prop_id, {
      canal: 'correo',
      destinatario: destinatario.value,
      asunto: asunto.value || undefined,
      mensaje: mensaje.value || undefined
    });
    if (r.data.envio?.ok) toast.success('Propuesta enviada por email');
    else toast.warning('Propuesta marcada como enviada (email no se envió: revisar configuración SMTP)');
    emit('enviada', r.data.propuesta);
    emit('close');
  } catch (e) { notify(e); }
  finally { enviando.value = false; }
}
</script>

<template>
  <BaseModal :open="open" :title="propuesta?.prop_numero || 'Nueva propuesta'" max-width="max-w-4xl" @close="emit('close')">
    <div v-if="loading && !propuesta" class="text-text3 text-center py-8">Cargando...</div>

    <template v-else>
      <!-- Items -->
      <section class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-text1">Items de la propuesta</h3>
          <div class="flex gap-2">
            <BaseSelect v-if="productosArea.length"
              :model-value="''"
              @update:model-value="(v) => v && agregarItem(productosArea.find(p => String(p.prod_id) === v))"
              placeholder="+ Agregar producto"
              :options="productosArea.map(p => ({ value: p.prod_id, label: p.prod_nombre }))"
              class="min-w-[200px]"
            />
            <BaseButton size="sm" variant="secondary" @click="agregarItem()">+ Item personalizado</BaseButton>
          </div>
        </div>

        <div class="sv-card overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-cream text-text3">
              <tr>
                <th class="text-left  px-2 py-2">Descripción</th>
                <th class="text-right px-2 py-2 w-20">Cant.</th>
                <th class="text-right px-2 py-2 w-28">Precio</th>
                <th class="text-right px-2 py-2 w-20">% desc</th>
                <th class="text-right px-2 py-2 w-32">Subtotal</th>
                <th class="w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-text3/10">
              <tr v-for="(it, i) in items" :key="i">
                <td class="px-2 py-1"><input v-model="it.pi_descripcion" class="sv-input text-sm" /></td>
                <td class="px-2 py-1"><input v-model.number="it.pi_cantidad" @input="recalcular" type="number" min="1" class="sv-input text-sm text-right" /></td>
                <td class="px-2 py-1"><input v-model.number="it.pi_precio_unitario" @input="recalcular" type="number" min="0" class="sv-input text-sm text-right" /></td>
                <td class="px-2 py-1"><input v-model.number="it.pi_descuento_pct" @input="recalcular" type="number" min="0" max="100" class="sv-input text-sm text-right" /></td>
                <td class="px-2 py-1 text-right font-semibold">{{ fmtCOP(it.pi_subtotal) }}</td>
                <td class="px-2 py-1 text-center">
                  <button @click="eliminarItem(i)" class="text-danger hover:bg-danger/10 rounded p-1" title="Eliminar">✕</button>
                </td>
              </tr>
              <tr v-if="!items.length"><td colspan="6" class="text-center py-6 text-text3">Sin items. Agrega un producto del catálogo o uno personalizado.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Totales + opciones -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <BaseInput v-model.number="descuentoPct" label="Descuento global %" type="number" min="0" max="100" />
            <BaseInput v-model.number="vigencia"     label="Vigencia (días)"    type="number" min="1" />
          </div>
          <BaseTextarea v-model="notas" label="Notas / condiciones" rows="3" />
        </div>

        <div class="sv-card p-4 bg-cream/40">
          <div class="space-y-1 text-sm">
            <div class="flex justify-between"><span class="text-text3">Subtotal</span><span>{{ fmtCOP(subtotal) }}</span></div>
            <div class="flex justify-between"><span class="text-text3">Descuento ({{ descuentoPct }}%)</span><span>- {{ fmtCOP(subtotal - total) }}</span></div>
            <div class="border-t border-text3/20 my-2"></div>
            <div class="flex justify-between font-serif text-xl">
              <span class="text-text1">Total</span>
              <span class="text-area-emp font-bold">{{ fmtCOP(total) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Envío -->
      <section class="sv-card p-4 mb-2 bg-area-emp/5 border border-area-emp/30">
        <h4 class="font-semibold text-text1 mb-3">📧 Envío por correo</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BaseInput v-model="destinatario" label="Email destinatario" type="email" placeholder="contacto@empresa.com" />
          <BaseInput v-model="asunto"       label="Asunto (opcional)" placeholder="Propuesta GenFlow..." />
        </div>
        <BaseTextarea v-model="mensaje" label="Mensaje (opcional)" rows="2" class="mt-3" />
      </section>
    </template>

    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cerrar</BaseButton>
      <BaseButton variant="ghost"     @click="previsualizar" :disabled="!items.length">📄 Preview PDF</BaseButton>
      <BaseButton variant="secondary" @click="guardar(false)" :loading="loading" :disabled="!items.length">💾 Guardar borrador</BaseButton>
      <BaseButton variant="primary"   @click="enviar" :loading="enviando" :disabled="!items.length || !destinatario">✉️ Enviar</BaseButton>
    </template>
  </BaseModal>
</template>
