import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' }
}));

import { useAuthStore } from '@/stores/useAuthStore';
import BottomNav from '@/components/layout/BottomNav.vue';

function etiquetas(codigoArea) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const auth = useAuthStore(pinia);
  auth.areaActual = { area_codigo: codigoArea };
  auth.rutaInicio = vi.fn(() => ({ name: 'inicio' }));
  const w = mount(BottomNav, { global: { plugins: [pinia] } });
  return w.findAll('a').map((a) => a.find('span:not([aria-hidden])').text());
}

describe('BottomNav', () => {
  it('en PRENEC muestra exactamente Panel, Clientes, Salas, Agenda y Métricas', () => {
    expect(etiquetas('PRENEC')).toEqual(['Panel', 'Clientes', 'Salas', 'Agenda', 'Métricas']);
  });

  it('en SVC no cambia: conserva Perfil al final', () => {
    expect(etiquetas('SVC')).toEqual(['Panel', 'Clientes', 'Agenda', 'Métricas', 'Perfil']);
  });
});
