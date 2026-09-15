<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <!-- Loader -->
        <div v-if="cargandoEvento" class="p-8 text-center text-sm text-text3">Cargando...</div>

        <!-- Evento cerrado o no existe -->
        <div v-else-if="!evento" class="p-8 text-center">
          <p class="text-lg font-bold text-red-500 mb-2">{{ errorTitle }}</p>
          <p class="text-sm text-text3">{{ errorMsg }}</p>
        </div>

        <!-- Registro completado -->
        <div v-else-if="registrado" class="p-8 text-center">
          <div class="text-4xl mb-3">✓</div>
          <p class="text-lg font-bold text-text1 mb-2">¡Registro recibido!</p>
          <p class="text-sm text-text3">
            Un asesor te contactará pronto sobre <strong>{{ evento.titulo }}</strong>.
          </p>
        </div>

        <!-- Formulario -->
        <div v-else>
          <header class="bg-gradient-to-br from-green-700 to-green-900 px-8 py-6 text-white">
            <h1 class="font-bold text-lg leading-tight">{{ evento.titulo }}</h1>
            <p class="text-green-200 text-xs mt-1">{{ fechasFmt }}</p>
            <p v-if="evento.empresa_nombre" class="text-green-100 text-xs mt-1">
              {{ evento.empresa_nombre }}
            </p>
          </header>

          <form @submit.prevent="enviar" class="px-8 py-6 space-y-4">
            <p class="text-sm text-text2">Déjanos tus datos para el registro:</p>

            <div>
              <label class="text-xs font-medium text-text2">Nombre completo *</label>
              <input v-model="form.nombre" type="text" required minlength="2" maxlength="180"
                     data-testid="input-nombre"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-text2">Teléfono *</label>
              <input v-model="form.telefono" type="tel" required
                     data-testid="input-telefono"
                     placeholder="Ej. 3001234567"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-text2">Correo (opcional)</label>
              <input v-model="form.correo" type="email"
                     data-testid="input-correo"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>

            <p v-if="errorSubmit" class="text-xs text-red-500">{{ errorSubmit }}</p>

            <button type="submit" data-testid="btn-submit"
                    :disabled="!puedeEnviar || enviando"
                    class="w-full py-2.5 px-4 bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white font-semibold text-sm rounded-lg transition-colors">
              {{ enviando ? 'Enviando...' : 'Enviar registro' }}
            </button>
          </form>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 mt-4">
        © {{ new Date().getFullYear() }} Los Olivos
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { publicEventosApi } from '@/api/agendaApi';

const route = useRoute();

const cargandoEvento = ref(true);
const evento         = ref(null);
const errorTitle     = ref('Evento no encontrado');
const errorMsg       = ref('El enlace no es válido o el evento ya no acepta registros.');
const registrado     = ref(false);
const enviando       = ref(false);
const errorSubmit    = ref('');
const form = reactive({ nombre: '', telefono: '', correo: '' });

const fechasFmt = computed(() => {
  if (!evento.value?.fecha_inicio) return '';
  const fmt = (d) => new Date(d).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'
  });
  const inicio = fmt(evento.value.fecha_inicio);
  const fin = evento.value.fecha_fin ? ' → ' + fmt(evento.value.fecha_fin) : '';
  return inicio + fin;
});

const puedeEnviar = computed(() =>
  form.nombre.trim().length >= 2 && form.telefono.trim().length >= 7
);

onMounted(async () => {
  try {
    const r = await publicEventosApi.landing(route.params.hash);
    evento.value = r.data || r;
  } catch (e) {
    const st = e.response?.status;
    if (st === 410) { errorTitle.value = 'Evento cerrado'; errorMsg.value = 'Este evento ya finalizó y no acepta más registros.'; }
    else if (st === 404) { errorTitle.value = 'Evento no encontrado'; errorMsg.value = 'El enlace no es válido o el registro público está deshabilitado.'; }
    else { errorTitle.value = 'Error'; errorMsg.value = 'No pudimos cargar el evento. Intenta más tarde.'; }
  } finally {
    cargandoEvento.value = false;
  }
});

async function enviar() {
  if (!puedeEnviar.value) return;
  enviando.value = true;
  errorSubmit.value = '';
  try {
    await publicEventosApi.registrar(route.params.hash, {
      nombre:   form.nombre.trim(),
      telefono: form.telefono.trim(),
      correo:   form.correo.trim() || undefined
    });
    registrado.value = true;
  } catch (e) {
    const st = e.response?.status;
    if (st === 410) { errorSubmit.value = 'Este evento ya finalizó.'; }
    else if (st === 429) { errorSubmit.value = 'Demasiados intentos, espera un minuto e intenta de nuevo.'; }
    else if (st === 422) { errorSubmit.value = 'Revisa los datos (teléfono en formato válido).'; }
    else { errorSubmit.value = 'No se pudo enviar el registro. Intenta más tarde.'; }
  } finally {
    enviando.value = false;
  }
}
</script>
