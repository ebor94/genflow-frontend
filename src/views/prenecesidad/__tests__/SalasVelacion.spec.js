import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/api/salasApi', () => ({ salasApi: { listar: vi.fn(), atender: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import SalasVelacion from '@/views/prenecesidad/SalasVelacion.vue';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import AtenderContratanteModal from '@/components/salas/AtenderContratanteModal.vue';

const H = (id, extra = {}) => ({
  id, estado: 'ABIERTO', registrado_at: '2026-11-18T09:00:00', sala_nombre: 'Sala 3', sede_nombre: 'Sede Norte',
  nombre_ser_querido: 'Luis Pérez', contrato: 'C-9', contratante_nombre: 'MARTA GOMEZ', contratante_telefono: '3001234567',
  cliente: null, visitas: [], puede_atender: true, ...extra
});
const LISTA = [
  H(55),
  H(56, { cliente: { prosp_id: 900, es_mio: true, duenio_nombre: 'Denis Moreno', estado_nombre: 'Interesado' } }),
  H(57, {
    cliente: { prosp_id: 901, es_mio: false, duenio_nombre: 'Carmen Contreras', estado_nombre: 'Contactado' },
    visitas: [{ asesor_nombre: 'Carmen Contreras', fecha_hora: '2026-11-18T10:40:00' }]
  })
];

function factory() {
  return mount(SalasVelacion, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: { teleport: true, RegistrarGestion: true, AtenderContratanteModal: true }
    }
  });
}

describe('SalasVelacion', () => {
  beforeEach(() => { vi.clearAllMocks(); salasApi.listar.mockResolvedValue({ success: true, data: LISTA }); });

  it('muestra la etiqueta y el botón que corresponde a cada caso', async () => {
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid="etiqueta-55"]').text()).toBe('Sin atender');
    expect(w.find('[data-testid="etiqueta-56"]').text()).toBe('Tu cliente · Interesado');
    expect(w.find('[data-testid="etiqueta-57"]').text()).toBe('Cliente de Carmen Contreras · Contactado');
    expect(w.find('[data-testid="btn-atender-55"]').text()).toBe('Atender contratante');
    expect(w.find('[data-testid="btn-ficha-56"]').text()).toBe('Abrir ficha');
    expect(w.find('[data-testid="btn-visita-57"]').text()).toBe('Registrar visita');
    expect(w.find('[data-testid="homenaje-57"]').text()).toContain('Carmen Contreras');
  });

  it('sin puede_atender no muestra botones', async () => {
    salasApi.listar.mockResolvedValue({ success: true, data: LISTA.map((h) => ({ ...h, puede_atender: false })) });
    const w = factory();
    await flushPromises();
    expect(w.find('[data-testid^="btn-"]').exists()).toBe(false);
  });

  it('estado vacío', async () => {
    salasApi.listar.mockResolvedValue({ success: true, data: [] });
    const w = factory();
    await flushPromises();
    expect(w.text()).toContain('No hay homenajes en curso en las salas');
  });

  it('Abrir ficha navega con el homenaje en la query', async () => {
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-ficha-56"]').trigger('click');
    expect(push).toHaveBeenCalledWith({ name: 'prenec-ficha', params: { id: 900 }, query: { homenaje: 56 } });
  });

  it('Registrar visita abre el formulario en modo sala con el resumen', async () => {
    salasApi.atender.mockResolvedValue({ success: true, data: {
      prosp_id: 901, prosp_area_id: 1, prosp_grupo_id: 1, es_mio: false, creado: false,
      persona_nombre: 'Marta Gomez', persona_telefono: '3001234567',
      resumen: { duenio_nombre: 'Carmen Contreras', estado_nombre: 'Contactado', prox_gestion_fecha: null, ultima_gestion: null }
    } });
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-visita-57"]').trigger('click');
    await flushPromises();
    expect(salasApi.atender).toHaveBeenCalledWith(57);
    const rg = w.findComponent(RegistrarGestion);
    expect(rg.props('open')).toBe(true);
    expect(rg.props('homenajeSalaId')).toBe(57);
    expect(rg.props('resumenCliente').duenio_nombre).toBe('Carmen Contreras');
    expect(rg.props('prospecto')).toEqual({
      prosp_id: 901, prosp_area_id: 1, prosp_grupo_id: 1,
      persona: { persona_nombre: 'Marta Gomez', persona_telefono_principal: '3001234567' }, productos: []
    });
  });

  it('Atender contratante abre la ventana y, si el cliente queda propio, navega a la ficha', async () => {
    const w = factory();
    await flushPromises();
    await w.find('[data-testid="btn-atender-55"]').trigger('click');
    const modal = w.findComponent(AtenderContratanteModal);
    expect(modal.props('open')).toBe(true);
    expect(modal.props('homenaje').id).toBe(55);
    modal.vm.$emit('atendido', { prosp_id: 905, es_mio: true });
    await flushPromises();
    expect(push).toHaveBeenCalledWith({ name: 'prenec-ficha', params: { id: 905 }, query: { homenaje: 55 } });
  });
});
