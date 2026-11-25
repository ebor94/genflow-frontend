import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '900' }, query: {} }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' }
}));
vi.mock('@/api/salasApi', () => ({ salasApi: { obtener: vi.fn() } }));
vi.mock('@/api/personasApi', () => ({ personasApi: { prospectosActivos: vi.fn(async () => ({ data: [] })) } }));

import FichaCliente from '@/views/prenecesidad/FichaCliente.vue';

async function montar(fecha) {
  const activo = {
    prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1, prosp_persona_id: 500, prosp_prioridad: 3, productos: [],
    prosp_prox_gestion_fecha: fecha, prosp_prox_gestion_hora: '10:00:00',
    persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' }, asesor: {}, estado: { estado_nombre: 'Nuevo' }
  };
  const pinia = createTestingPinia({ createSpy: vi.fn, initialState: { svProspectos: { activo } } });
  const w = mount(FichaCliente, {
    global: {
      plugins: [pinia],
      stubs: { teleport: true, RegistrarGestion: true, AgendarProximaModal: true, ReasignarProspectoModal: true,
        ProspectosCrossArea: true, QuickActionRow: true, HistorialItem: true, VentasCliente: true }
    }
  });
  await flushPromises();
  return w;
}

enableAutoUnmount(afterEach);

describe('FichaCliente: color de la próxima gestión', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-28T09:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  const clases = async (fecha) => (await montar(fecha)).find('section.border-l-4.flex').classes();

  it.each(['2026-11-28', '2026-11-28T05:00:00.000Z'])('la del día de hoy (%s) queda pendiente', async (f) => {
    const c = await clases(f);
    expect(c).toContain('border-warning');
    expect(c).not.toContain('border-danger');
  });

  it.each(['2026-11-27', '2026-11-27T05:00:00.000Z'])('la de ayer (%s) sale vencida', async (f) => {
    const c = await clases(f);
    expect(c).toContain('border-danger');
    expect(c).not.toContain('border-warning');
  });

  it.each(['2026-11-29', '2026-11-29T05:00:00.000Z'])('la de mañana (%s) queda pendiente', async (f) => {
    const c = await clases(f);
    expect(c).toContain('border-warning');
  });
});
