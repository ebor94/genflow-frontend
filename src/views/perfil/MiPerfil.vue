<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import { authApi } from '@/api/authApi';
import { useRouter } from 'vue-router';

import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import AreaBadge from '@/components/common/AreaBadge.vue';
import { trackingApi } from '@/api/trackingApi';
import dayjs from 'dayjs';

const auth   = useAuthStore();
const toast  = useToastStore();
const router = useRouter();
const { notify } = useApiError();

const u = computed(() => auth.usuario || {});
const tema = ref(localStorage.getItem('sv_tema') || 'light');
function aplicarTema() {
  localStorage.setItem('sv_tema', tema.value);
  document.documentElement.classList.toggle('dark', tema.value === 'dark');
  toast.info(`Tema ${tema.value === 'dark' ? 'oscuro' : 'claro'} aplicado`);
}

// Modal cambiar contraseña
const showPwd = ref(false);
const pwd = ref({ actual: '', nueva: '', repetir: '' });
const pwdLoading = ref(false);

async function cambiarPassword() {
  if (pwd.value.nueva.length < 6) return toast.warning('La nueva contraseña debe tener al menos 6 caracteres.');
  if (pwd.value.nueva !== pwd.value.repetir) return toast.warning('Las contraseñas no coinciden.');
  pwdLoading.value = true;
  try {
    await authApi.changePassword({ actual: pwd.value.actual, nueva: pwd.value.nueva });
    toast.success('Contraseña actualizada. Inicia sesión de nuevo.');
    showPwd.value = false;
    await auth.logout();
    router.push({ name: 'login' });
  } catch (e) {
    notify(e);
  } finally {
    pwdLoading.value = false;
  }
}

async function cerrarSesion() {
  await auth.logout();
  router.push({ name: 'login' });
}

// ─── Habeas Data: descargar mis datos de tracking ───
async function descargarMisDatosTracking() {
  try {
    const blob = await trackingApi.exportarMisDatos(
      dayjs().subtract(90, 'day').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD')
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis_datos_ubicacion_${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Descarga iniciada.');
  } catch (e) { notify(e); }
}

</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="font-serif text-3xl text-brown-deep mb-6">Mi perfil</h1>

    <section class="sv-card p-6 mb-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-gold text-brown-deep font-bold flex items-center justify-center text-xl">
          {{ auth.iniciales }}
        </div>
        <div class="flex-1">
          <h2 class="font-serif text-xl text-brown-deep">{{ auth.nombreCompleto }}</h2>
          <p class="text-sm text-text2">{{ u.usr_email }}</p>
          <p class="text-xs text-text3 mt-1">Teléfono: {{ u.usr_telefono || '—' }}</p>
        </div>
        <div class="flex flex-col gap-2 text-right">
          <span class="px-2 py-1 rounded-full bg-gold/10 text-gold text-xs font-semibold">
            {{ u.rol?.rol_nombre }}
          </span>
          <AreaBadge v-if="u.area" :codigo="u.area.area_codigo" :nombre="u.area.area_nombre" :icono="u.area.area_icono" :color-hex="u.area.area_color_hex" size="sm" />
        </div>
      </div>
    </section>

    <section class="sv-card divide-y divide-text3/10">
      <div class="px-5 py-4 flex items-center gap-4">
        <span class="text-xl" aria-hidden="true">🔐</span>
        <div class="flex-1">
          <div class="font-semibold text-text1">Cambiar contraseña</div>
          <div class="text-xs text-text3">Recomendado cada 90 días.</div>
        </div>
        <BaseButton variant="secondary" size="sm" @click="showPwd = true">Cambiar</BaseButton>
      </div>

      <div class="px-5 py-4 flex items-center gap-4">
        <span class="text-xl" aria-hidden="true">🌙</span>
        <div class="flex-1">
          <div class="font-semibold text-text1">Tema</div>
          <div class="text-xs text-text3">Claro u oscuro (oscuro se aplicará en futuras versiones).</div>
        </div>
        <select v-model="tema" @change="aplicarTema" class="sv-input max-w-[150px]">
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </select>
      </div>

      <div class="px-5 py-4 flex items-center gap-4">
        <span class="text-xl" aria-hidden="true">ℹ️</span>
        <div class="flex-1">
          <div class="font-semibold text-text1">Acerca de</div>
          <div class="text-xs text-text3">GenFlow CRM v0.1.0 — Fase 0 (base).</div>
        </div>
      </div>

      <div class="px-5 py-4 flex items-center gap-4">
        <span class="text-xl" aria-hidden="true">🚪</span>
        <div class="flex-1">
          <div class="font-semibold text-danger">Cerrar sesión</div>
        </div>
        <BaseButton variant="danger" size="sm" @click="cerrarSesion">Salir</BaseButton>
      </div>
    </section>

    <!-- Tracking de jornadas (informativo + acceso a recorridos) -->
    <section class="sv-card p-5 mt-6">
      <h2 class="font-serif text-lg text-brown-deep mb-2">📍 Mis recorridos de jornada</h2>
      <p class="text-xs text-text3 mb-4">
        Tu ubicación se registra automáticamente mientras tu sesión esté abierta,
        en horario laboral (08:00-12:00 y 14:00-18:00, L-D). Retención: 90 días.
      </p>

      <div class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-text3/10">
          <div>
            <div class="text-sm font-semibold text-text1">Ver mis recorridos</div>
            <div class="text-xs text-text3">Histórico de mis jornadas en el mapa.</div>
          </div>
          <BaseButton variant="secondary" size="sm" @click="router.push({ name: 'tracking-mios' })">Ver</BaseButton>
        </div>

        <div class="flex items-center justify-between py-2">
          <div>
            <div class="text-sm font-semibold text-text1">Descargar mis datos</div>
            <div class="text-xs text-text3">Exporta todos tus puntos GPS en CSV (últimos 90 días).</div>
          </div>
          <BaseButton variant="secondary" size="sm" @click="descargarMisDatosTracking">📥 CSV</BaseButton>
        </div>
      </div>
    </section>

    <BaseModal :open="showPwd" title="Cambiar contraseña" @close="showPwd = false">
      <div class="space-y-4">
        <BaseInput v-model="pwd.actual"  label="Contraseña actual" type="password" required autocomplete="current-password" />
        <BaseInput v-model="pwd.nueva"   label="Nueva contraseña"  type="password" required autocomplete="new-password" />
        <BaseInput v-model="pwd.repetir" label="Repetir nueva contraseña" type="password" required autocomplete="new-password" />
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showPwd = false">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="pwdLoading" @click="cambiarPassword">Actualizar</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
