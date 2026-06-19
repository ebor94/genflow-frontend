<script setup>
/**
 * FichaContactoFideliz.vue — detalle de un contacto + timeline de envíos.
 */
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFidelizacionStore } from '@/stores/useFidelizacionStore';
import { useApiError } from '@/composables/useApiError';
import { useTelefono } from '@/composables/useTelefono';
import dayjs from 'dayjs';

import EmptyState from '@/components/common/EmptyState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import RegistrarEnvioModal from '@/components/fideliz/RegistrarEnvioModal.vue';

const route   = useRoute();
const router  = useRouter();
const store   = useFidelizacionStore();
const { notify } = useApiError();
const { formato: fmtTel, linkTel } = useTelefono();

const envios = ref([]);
const showEnvio = ref(false);
const eventoActivo = ref(null);

function registrarAdHoc() {
  const c = store.contactoActivo;
  if (!c) return;
  eventoActivo.value = {
    persona_id: c.cf_persona_id,
    persona:    c.persona,
    empresa:    c.empresa,
    cargo:      c.cf_cargo,
    cf_id:      c.cf_id,
    tipo: 'otro',
    descripcion: 'Envío ad-hoc',
    fecha_evento: dayjs().format('YYYY-MM-DD'),
    evento_anio: dayjs().year(),
    fecha_especial_id: null,
    adHoc: true
  };
  showEnvio.value = true;
}

const TIPO_LABEL = {
  nacimiento: '🎂 Cumpleaños',
  aniversario_laboral: '💼 Aniv. laboral',
  aniversario_boda: '💍 Aniv. boda',
  dia_madre: '💐 Día Madre',
  dia_padre: '👔 Día Padre',
  otro: '🎉 Otro'
};

async function cargar() {
  try {
    const c = await store.fetchContacto(parseInt(route.params.cfId));
    envios.value = await store.fetchEnviosPersona(c.cf_persona_id);
  } catch (e) { notify(e); }
}

onMounted(cargar);
watch(() => route.params.cfId, cargar);
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
    <button @click="router.back()" class="text-sm text-text3 hover:text-text1 mb-3">← Volver</button>

    <div v-if="!store.contactoActivo" class="text-text3 text-center py-12">Cargando contacto...</div>

    <template v-else>
      <header class="sv-card p-5 mb-4 border-l-4" style="border-left-color: #be185d">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-full bg-warning/15 text-warning font-bold flex items-center justify-center text-xl">
            {{ (store.contactoActivo.persona?.persona_nombre || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1">
            <h1 class="font-serif text-2xl text-brown-deep">
              {{ store.contactoActivo.persona?.persona_nombre }}
              {{ store.contactoActivo.persona?.persona_apellido }}
              <span v-if="store.contactoActivo.cf_es_titular" class="text-sm text-gold ml-2">⭐ Titular</span>
            </h1>
            <div class="text-sm text-text2 mt-1">
              {{ store.contactoActivo.cf_cargo || '—' }}
              <span v-if="store.contactoActivo.cf_departamento"> · {{ store.contactoActivo.cf_departamento }}</span>
            </div>
            <div class="text-sm text-text2">
              🏢 {{ store.contactoActivo.empresa?.empresa_razon_social }}
            </div>
            <div class="text-xs text-text3 mt-2">
              📞 {{ fmtTel(store.contactoActivo.persona?.persona_telefono_principal) }}
              <span v-if="store.contactoActivo.persona?.persona_email"> · ✉️ {{ store.contactoActivo.persona.persona_email }}</span>
            </div>
          </div>
          <a v-if="store.contactoActivo.persona?.persona_telefono_principal"
             :href="linkTel(store.contactoActivo.persona.persona_telefono_principal)"
             class="sv-btn-secondary py-2 px-3 self-start">📞</a>
        </div>

        <!-- Acciones -->
        <div class="mt-4 flex flex-wrap gap-2">
          <BaseButton variant="primary" @click="registrarAdHoc">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
            Registrar envío
          </BaseButton>
          <a v-if="store.contactoActivo.persona?.persona_email"
             :href="`mailto:${store.contactoActivo.persona.persona_email}`"
             class="sv-btn-secondary py-2 px-3 text-sm">
            ✉️ Enviar correo
          </a>
        </div>
      </header>

      <!-- Fechas registradas -->
      <section class="sv-card p-5 mb-4">
        <h3 class="font-serif text-base text-brown-deep mb-3">📅 Fechas especiales</h3>
        <div class="space-y-2">
          <div v-if="store.contactoActivo.persona?.persona_fecha_nacimiento"
               class="flex items-center gap-2 text-sm">
            <span class="text-lg">🎂</span>
            <span class="text-text2">Cumpleaños:</span>
            <span class="font-semibold">{{ store.contactoActivo.persona.persona_fecha_nacimiento }}</span>
          </div>
          <div v-for="f in (store.contactoActivo.persona?.fechasEspeciales || [])" :key="f.fe_id"
               class="flex items-center gap-2 text-sm">
            <span class="text-lg">{{ TIPO_LABEL[f.fe_tipo]?.slice(0,2) || '🎉' }}</span>
            <span class="text-text2">{{ TIPO_LABEL[f.fe_tipo] || f.fe_tipo }}:</span>
            <span class="font-semibold">{{ f.fe_fecha }}</span>
            <span v-if="f.fe_descripcion" class="text-text3 text-xs"> — {{ f.fe_descripcion }}</span>
          </div>
          <div v-if="store.contactoActivo.persona?.persona_genero === 'F'" class="text-xs text-text3 italic">
            💐 Día de la Madre se calcula automáticamente cada año.
          </div>
          <div v-if="store.contactoActivo.persona?.persona_genero === 'M'" class="text-xs text-text3 italic">
            👔 Día del Padre se calcula automáticamente cada año.
          </div>
        </div>
      </section>

      <!-- Timeline envíos -->
      <section class="sv-card p-5">
        <h3 class="font-serif text-base text-brown-deep mb-3">📤 Historial de envíos</h3>
        <EmptyState v-if="!envios.length" titulo="Sin envíos registrados" size="sm" />
        <div v-else class="space-y-3">
          <div v-for="env in envios" :key="env.env_id"
               class="border-l-4 pl-3 py-2"
               :class="env.env_estado === 'confirmado' ? 'border-sage' : env.env_estado === 'devuelto' ? 'border-danger' : 'border-gold'">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-sm">{{ TIPO_LABEL[env.env_evento_tipo] || env.env_evento_tipo }} {{ env.env_evento_anio }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
                    :class="env.env_estado === 'confirmado' ? 'bg-sage/20 text-sage'
                            : env.env_estado === 'devuelto' ? 'bg-danger/20 text-danger'
                            : 'bg-gold/20 text-gold'">
                {{ env.env_estado }}
              </span>
            </div>
            <div class="text-xs text-text2 mt-1">{{ env.env_tipo_detalle || '—' }}</div>
            <div class="text-xs text-text3">
              {{ dayjs(env.env_fecha_envio).format('DD/MM/YYYY HH:mm') }}
              <span v-if="env.agente"> · por {{ env.agente.usr_nombre }} {{ env.agente.usr_apellido }}</span>
            </div>
            <div v-if="env.env_direccion_entrega" class="text-xs text-text3">📍 {{ env.env_direccion_entrega }}</div>
            <a v-if="env.env_evidencia_url" :href="env.env_evidencia_url" target="_blank"
               class="text-xs text-area-emp underline">📷 Ver foto evidencia</a>
            <div v-if="env.env_comentario" class="text-xs text-text2 italic mt-1">"{{ env.env_comentario }}"</div>
          </div>
        </div>
      </section>
      <RegistrarEnvioModal :open="showEnvio" :evento="eventoActivo"
                           @close="showEnvio = false"
                           @registrado="cargar" />
    </template>
  </div>
</template>
