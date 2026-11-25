import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ params: {}, query: {} }) }));
vi.mock('@/api/buscadorApi', () => ({ buscadorApi: { buscar: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { buscar: vi.fn(), create: vi.fn() } }));

import BaseModal from '@/components/ui/BaseModal.vue';
import BusquedaGlobalModal from '@/components/crm/BusquedaGlobalModal.vue';
import NuevoProspecto from '@/components/crm/NuevoProspecto.vue';
import NuevaEmpresa from '@/components/crm/NuevaEmpresa.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

function montar(componente, props) {
  return mount(componente, {
    props,
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
  });
}
const fondo = (w) => w.get('[data-testid="modal-fondo"]');

describe('cierre de las ventanas', () => {
  it('el buscador global sí se cierra con clic afuera', async () => {
    const w = montar(BusquedaGlobalModal, { open: true });
    await fondo(w).trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
  });

  it.each([
    ['Nuevo prospecto', NuevoProspecto, { open: true, areaId: 1, grupoId: 1 }],
    ['Nueva empresa', NuevaEmpresa, { open: true }],
    ['Registrar gestión', RegistrarGestion, { open: true, prospecto: null }]
  ])('%s no se cierra con clic afuera', async (_n, componente, props) => {
    const w = montar(componente, props);
    await fondo(w).trigger('click');
    expect(w.emitted('close')).toBeUndefined();
  });
});

describe('formularios por pasos', () => {
  it.each([
    ['Nuevo prospecto', NuevoProspecto, { open: true, areaId: 1, grupoId: 1 }],
    ['Nueva empresa', NuevaEmpresa, { open: true }]
  ])('%s le dice su paso a la ventana', (_n, componente, props) => {
    const w = montar(componente, props);
    expect(w.findComponent(BaseModal).props('paso')).toBe(1);
  });
});
