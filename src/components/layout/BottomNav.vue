<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';

const auth = useAuthStore();

const items = computed(() => {
  // Usa el área ACTIVA (no la principal del usuario) para multi-área
  const cod = auth.areaActual?.area_codigo;
  const base = [];

  if (cod === 'PRENEC') {
    base.push({ to: { name: 'prenec-panel' },    label: 'Panel',   icon: '🏠' });
    base.push({ to: { name: 'prenec-clientes' }, label: 'Clientes', icon: '👥' });
    base.push({ to: { name: 'prenec-agenda' },   label: 'Agenda',  icon: '📅' });
    base.push({ to: { name: 'prenec-metricas' }, label: 'Métricas', icon: '📊' });
  } else if (cod === 'PREV-EMP') {
    const esFideliz = auth.usuario?.grupo?.grupo_codigo === 'FIDELIZACION';
    if (esFideliz) {
      base.push({ to: { name: 'fideliz-panel' },      label: 'Fideliz.',   icon: '💝' });
      base.push({ to: { name: 'fideliz-calendario' }, label: 'Calendario', icon: '📅' });
      base.push({ to: { name: 'fideliz-empresas' },   label: 'Empresas',   icon: '🏢' });
      base.push({ to: { name: 'fideliz-contactos' },  label: 'Contactos',  icon: '👥' });
      base.push({ to: { name: 'fideliz-metricas' },   label: 'Métricas',   icon: '📊' });
    } else {
      base.push({ to: { name: 'emp-panel' },    label: 'Empresas', icon: '🏢' });
      base.push({ to: { name: 'emp-kanban' },   label: 'Kanban',   icon: '🔄' });
      base.push({ to: { name: 'emp-agenda' },   label: 'Agenda',   icon: '📅' });
      base.push({ to: { name: 'emp-metricas' }, label: 'Métricas', icon: '📊' });
    }
  } else if (cod === 'PREV-PAP') {
    if (auth.esJefePap) {
      // JEFE_PAP: nav orientada a supervisión (no registra visitas)
      base.push({ to: { name: 'pap-supervisor' }, label: 'Equipo',   icon: '👥' });
      base.push({ to: { name: 'pap-mapa' },       label: 'Mapa',     icon: '🗺️' });
      base.push({ to: { name: 'tracking-live' },  label: 'En vivo',  icon: '📍' });
      base.push({ to: { name: 'pap-metricas' },   label: 'Métricas', icon: '📊' });
    } else {
      base.push({ to: { name: 'pap-panel' },     label: 'Panel',    icon: '🚶' });
      base.push({ to: { name: 'pap-registrar' }, label: 'Registrar', icon: '⚡' });
      base.push({ to: { name: 'pap-mapa' },      label: 'Mapa',     icon: '🗺️' });
      base.push({ to: { name: 'pap-metricas' },  label: 'Métricas', icon: '📊' });
    }
  } else if (cod === 'SVC' || auth.rolCodigo === 'AGENTE_SVC') {
    base.push({ to: { name: 'svc-panel' },    label: 'Panel',    icon: '🎧' });
    base.push({ to: { name: 'svc-clientes' }, label: 'Clientes', icon: '👥' });
    base.push({ to: { name: 'svc-agenda' },   label: 'Agenda',   icon: '📅' });
    base.push({ to: { name: 'svc-metricas' }, label: 'Métricas', icon: '📊' });
  } else {
    base.push({ to: auth.rutaInicio(), label: 'Inicio', icon: '🏠' });
    if (auth.esSuperAdmin || auth.esAdminArea) base.push({ to: { name: 'admin-areas' }, label: 'Admin', icon: '⚙️' });
  }
  base.push({ to: { name: 'mi-perfil' }, label: 'Perfil', icon: '👤' });
  return base.slice(0, 5);
});
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 bg-brown-deep text-cream border-t border-cream/10 z-40">
    <div class="grid grid-cols-5 max-w-md mx-auto">
      <RouterLink
        v-for="(it, i) in items.slice(0, 5)" :key="i"
        :to="it.to"
        class="flex flex-col items-center justify-center py-2 text-xs text-cream/70 hover:text-gold-bright"
        active-class="text-gold-bright"
      >
        <span class="text-lg" aria-hidden="true">{{ it.icon }}</span>
        <span class="mt-0.5">{{ it.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
