<script setup>
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';

const auth = useAuthStore();

const cards = [
  { to: { name: 'admin-areas' },      label: 'Áreas de Negocio', icon: '🏛️', desc: '4 áreas configuradas' },
  { to: { name: 'admin-grupos' },     label: 'Grupos de Trabajo', icon: '👥', desc: 'Telemercadeo, Empresariales, PAP, SVC' },
  { to: { name: 'admin-productos' },  label: 'Catálogo de Productos', icon: '📦', desc: 'Productos por área' },
  { to: { name: 'admin-pipeline' },   label: 'Pipelines (Estados)', icon: '🔄', desc: 'Pipeline por grupo' },
  { to: { name: 'admin-resultados' }, label: 'Resultados de Gestión', icon: '✅', desc: 'Opciones del formulario' },
  { to: { name: 'admin-fuentes' },    label: 'Fuentes de Prospecto', icon: '🌱', desc: 'Orígenes por área' },
  { to: { name: 'admin-puntos' },     label: 'Puntos de Atención', icon: '📍', desc: 'Sedes Cúcuta' },
  { to: { name: 'admin-usuarios' },   label: 'Usuarios y Roles', icon: '🔑', desc: 'Asesores, supervisores, administradores' },
  { to: { name: 'admin-tipos-documento' }, label: 'Tipos de Documento', icon: '📎', desc: 'Catálogo de documentos para empresas B2B' }
];
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <header class="mb-6">
      <h1 class="font-serif text-3xl text-brown-deep">Administración</h1>
      <p class="text-text2 mt-1">Parametrización del sistema GenFlow.</p>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink v-for="c in cards" :key="c.label" :to="c.to"
                  class="sv-card p-5 hover:shadow-sv-pop transition-shadow group">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-sv bg-gold/10 text-gold flex items-center justify-center text-xl">{{ c.icon }}</div>
          <div class="flex-1">
            <h3 class="font-serif text-lg text-brown-deep group-hover:text-gold transition-colors">{{ c.label }}</h3>
            <p class="text-xs text-text3 mt-1">{{ c.desc }}</p>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
