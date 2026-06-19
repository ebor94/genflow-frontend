<script setup>
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
const auth = useAuthStore();
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
    <div class="text-7xl mb-4">🪦</div>
    <h1 class="font-serif text-4xl text-brown-deep">404</h1>
    <p class="text-text2 mt-2">La página que buscas no existe.</p>
    <RouterLink :to="auth.rutaInicio()" class="mt-6 inline-block sv-btn-primary">Volver al inicio</RouterLink>
  </div>
</template>
