<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
const auth   = useAuthStore();
const toast  = useToastStore();
const { extract } = useApiError();

const email    = ref('');
const password = ref('');
const loading  = ref(false);
const error    = ref('');

async function submit() {
  if (!email.value || !password.value) {
    error.value = 'Email y contraseña son requeridos';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await auth.login(email.value.trim(), password.value);
    toast.success(`Bienvenido/a ${auth.usuario.usr_nombre}`);
    router.push(auth.rutaInicio());
  } catch (e) {
    error.value = extract(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-brown-deep px-4">
    <div class="w-full max-w-md sv-card p-8">
      <div class="text-center mb-6">
        <h1 class="font-serif text-3xl text-gold">GenFlow</h1>
        <p class="text-sm text-text3 mt-1">CRM Serfunorte Los Olivos</p>
      </div>

      <form @submit.prevent="submit" class="space-y-4">
        <BaseInput
          v-model="email"
          label="Correo electrónico"
          type="email"
          placeholder="usuario@serfunorte.com"
          required
          autocomplete="username"
        />
        <BaseInput
          v-model="password"
          label="Contraseña"
          type="password"
          placeholder="••••••••"
          required
          autocomplete="current-password"
        />

        <div v-if="error" class="text-sm text-danger bg-danger/10 border border-danger/40 rounded-sv px-3 py-2">
          {{ error }}
        </div>

        <BaseButton type="submit" :loading="loading" variant="primary" class="w-full">
          Iniciar sesión
        </BaseButton>
      </form>

      <p class="text-xs text-text3 text-center mt-6">
        ¿Olvidaste tu contraseña? Contacta a tu administrador.
      </p>
    </div>
  </div>
</template>
