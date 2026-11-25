import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/api/usuariosApi', () => ({ usuariosApi: { list: vi.fn(async () => ({ data: [] })) } }));

import MisVisitas from '@/views/pap/MisVisitas.vue';
import { useProspectosStore } from '@/stores/useProspectosStore';

enableAutoUnmount(afterEach);

const prospecto = (id, codigo) => ({
  prosp_id: id, prosp_prox_gestion_fecha: '2026-12-01T09:00:00',
  persona: { persona_nombre: 'Ana', persona_telefono_principal: '555' },
  estado: { estado_codigo: codigo, estado_nombre: codigo }
});

async function montar(items) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
  const store = useProspectosStore();
  store.fetchList.mockResolvedValue();
  store.items = items;
  const w = mount(MisVisitas, { global: { plugins: [pinia], stubs: { NuevaGestionPapModal: true, ReasignarProspectoModal: true } } });
  await flushPromises();
  return w;
}

describe('MisVisitas: rótulo de la próxima visita', () => {
  it('VOLVER dice "Volver"', async () => {
    const w = await montar([prospecto(1, 'VOLVER')]);
    expect(w.text()).toContain('🔁 Volver:');
    expect(w.text()).not.toContain('Seguimiento');
  });
  it('INTERESADO dice "Seguimiento"', async () => {
    const w = await montar([prospecto(2, 'INTERESADO')]);
    expect(w.text()).toContain('📅 Seguimiento:');
  });
});
