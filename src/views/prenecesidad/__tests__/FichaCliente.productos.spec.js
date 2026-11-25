import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '900' }, query: {} }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' }
}));
vi.mock('@/api/salasApi', () => ({ salasApi: { obtener: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { prospectosActivos: vi.fn(async () => ({ data: [] })) } }));

import FichaCliente from '@/views/prenecesidad/FichaCliente.vue';

const pp = (pp_id, producto, pp_precio_ofrecido, pp_es_principal = 0) => ({ pp_id, pp_prod_id: pp_id, pp_es_principal, pp_precio_ofrecido, producto });

it('cada interés muestra por definir, el precio ofrecido o solo el nombre', async () => {
  const activo = {
    prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_prioridad: 3,
    persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
    estado: { estado_nombre: 'Nuevo', estado_color_hex: '#8A6A52' }, asesor: { usr_nombre: 'D', usr_apellido: 'M' },
    productos: [
      pp(1, { prod_nombre: 'Osarios', prod_es_generico: 1 }, null, 1),
      pp(2, { prod_nombre: 'Osario A2', prod_precio_base: '8770000.00' }, '8770000.00'),
      pp(3, { prod_nombre: 'Lote doble', prod_precio_base: '18950000.00' }, '18000000.00'),
      pp(4, { prod_nombre: 'Velación', prod_precio_base: '1200000.00' }, null)
    ]
  };
  const w = mount(FichaCliente, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo } } })],
      stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true, ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true }
    }
  });
  await flushPromises();
  const chips = w.findAll('[data-testid="interes"]').map((c) => c.text().replace(/\s+/g, ' ').trim());
  expect(chips).toEqual([
    '⭐ Osarios · por definir',
    'Osario A2 · $ 8.770.000',
    'Lote doble · $ 18.000.000 (vigente $ 18.950.000)',
    'Velación'
  ]);
});
