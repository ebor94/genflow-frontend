import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/ventasApi', () => ({ ventasApi: { deProspecto: vi.fn(), corregir: vi.fn(), anular: vi.fn() } }));

import { ventasApi } from '@/api/ventasApi';
import { useToastStore } from '@/stores/useToastStore';
import VentasCliente from '@/components/crm/VentasCliente.vue';
import CambiarVentaModal from '@/components/crm/CambiarVentaModal.vue';

const DENIS = { usr_nombre: 'Denis', usr_apellido: 'Moreno' };
const ANA = { usr_nombre: 'Ana', usr_apellido: 'Ruiz' };
const ACTIVA = {
  venta_id: 40, venta_fecha: '2026-11-24', venta_total: '17000000.00', venta_anulada: 0, asesor: DENIS,
  items: [{ vi_id: 1, vi_prod_id: 2, vi_cantidad: 2, vi_precio_unitario: '8500000.00', producto: { prod_nombre: 'Osario A2' } }],
  cambios: [{ vc_id: 9, vc_accion: 'corregir', vc_motivo: 'precio mal', vc_total_antes: '9000000.00', vc_total_despues: '17000000.00', usuario: ANA, vc_created_at: '2026-11-24T10:00:00' }]
};
const ANULADA = {
  ...ACTIVA, venta_id: 39, venta_total: '8770000.00', venta_anulada: 1,
  cambios: [{ vc_id: 8, vc_accion: 'anular', vc_motivo: 'el cliente desistió', vc_total_antes: '8770000.00', vc_total_despues: '0.00', usuario: ANA, vc_created_at: '2026-11-12T10:00:00' }]
};
const PRODUCTOS = [{ prod_id: 2, prod_nombre: 'Osario A2', prod_categoria: 'Mausoleos', prod_tipo: 'Osarios', prod_precio_base: '8770000.00', prod_es_generico: 0 }];
const plano = (x) => x.text().replace(/\s+/g, ' ').trim();
const boton = (w, t) => w.findAll('button').find((b) => b.text().trim() === t);

async function montar(props = {}, ventas = [ACTIVA, ANULADA]) {
  ventasApi.deProspecto.mockResolvedValue({ data: ventas });
  const pinia = createTestingPinia({ createSpy: vi.fn });
  const w = mount(VentasCliente, {
    props: { prospId: 900, productos: PRODUCTOS, puedeCorregir: true, ...props },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await flushPromises();
  return { w, toast: useToastStore(pinia) };
}

describe('VentasCliente', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin ventas no muestra nada', async () => {
    expect((await montar({}, [])).w.find('[data-testid="ventas"]').exists()).toBe(false);
  });

  it('muestra fecha, asesor, productos, total, correcciones y anulación', async () => {
    const { w } = await montar();
    const activa = plano(w.get('[data-testid="venta-40"]'));
    expect(activa).toContain('Denis Moreno');
    expect(activa).toContain('$ 17.000.000');
    expect(activa).toContain('2 × Osario A2 · $ 8.500.000');
    expect(activa).toContain('Corregida de $ 9.000.000 a $ 17.000.000: precio mal · Ana Ruiz');
    expect(plano(w.get('[data-testid="venta-39"] [data-testid="anulada"]'))).toContain('Anulada: el cliente desistió · Ana Ruiz');
  });

  it('solo quien puede corregir ve los botones, y no en una anulada', async () => {
    const { w } = await montar();
    expect(w.get('[data-testid="venta-40"]').findAll('button')).toHaveLength(2);
    expect(w.get('[data-testid="venta-39"]').findAll('button')).toHaveLength(0);
    expect((await montar({ puedeCorregir: false })).w.findAll('article button')).toHaveLength(0);
  });

  it('recarga al cambiar de cliente o de versión', async () => {
    const { w } = await montar();
    await w.setProps({ version: 1 });
    await w.setProps({ prospId: 901 });
    expect(ventasApi.deProspecto.mock.calls.map((c) => c[0])).toEqual([900, 900, 901]);
  });

  it('una respuesta que llega tarde de otro cliente no se muestra', async () => {
    let tarde;
    const { w } = await montar({}, []);
    ventasApi.deProspecto.mockImplementationOnce(() => new Promise((r) => { tarde = r; })).mockResolvedValueOnce({ data: [] });
    await w.setProps({ prospId: 901 });
    await w.setProps({ prospId: 902 });
    tarde({ data: [ACTIVA] });
    await flushPromises();
    expect(w.find('[data-testid="ventas"]').exists()).toBe(false);
  });

  it.each([
    ['403', { response: { status: 403, data: { message: 'Sin permiso' } } }, 0],
    ['404', { response: { status: 404, data: { message: 'No existe' } } }, 0],
    ['500', { response: { status: 500, data: { message: 'Error interno' } } }, 1],
    ['sin red', new Error('Network Error'), 1]
  ])('si la consulta falla (%s) muestra el error solo cuando corresponde', async (_n, error, avisos) => {
    const { w, toast } = await montar();
    ventasApi.deProspecto.mockRejectedValueOnce(error);
    await w.setProps({ version: 1 });
    await flushPromises();
    expect(toast.error).toHaveBeenCalledTimes(avisos);
    expect(w.find('[data-testid="ventas"]').exists()).toBe(false);
  });

  it('corregir envía los productos, el motivo y los cambios vistos, y recarga', async () => {
    const { w } = await montar();
    ventasApi.corregir.mockResolvedValue({ data: {} });
    await boton(w, 'Corregir').trigger('click');
    await w.get('[data-testid="cantidad-2"]').setValue('1');
    await w.get('textarea').setValue('  era uno  ');
    await boton(w, 'Guardar corrección').trigger('click');
    await flushPromises();
    expect(ventasApi.corregir).toHaveBeenCalledWith(40, { items: [{ prod_id: 2, cantidad: 1, precio_unitario: 8500000 }], motivo: 'era uno', cambios_vistos: 1 });
    expect(ventasApi.deProspecto).toHaveBeenCalledTimes(2);
    expect(w.findComponent(CambiarVentaModal).props('venta')).toBeNull();
  });

  it('anular pide motivo y avisa que el estado del cliente no cambia', async () => {
    const { w, toast } = await montar();
    ventasApi.anular.mockResolvedValue({ data: {} });
    await boton(w, 'Anular').trigger('click');
    expect(w.text()).toContain('El estado del cliente no cambia');
    await boton(w, 'Anular venta').trigger('click');
    expect(toast.warning).toHaveBeenCalledWith('Escribe el motivo');
    expect(ventasApi.anular).not.toHaveBeenCalled();
    await w.get('textarea').setValue('desistió');
    await boton(w, 'Anular venta').trigger('click');
    await flushPromises();
    expect(ventasApi.anular).toHaveBeenCalledWith(40, { motivo: 'desistió', cambios_vistos: 1 });
  });

  it('una corrección incompleta no se envía', async () => {
    const { w, toast } = await montar();
    await boton(w, 'Corregir').trigger('click');
    await w.get('[data-testid="vendido-2"]').setValue(false);
    await w.get('textarea').setValue('motivo');
    await boton(w, 'Guardar corrección').trigger('click');
    expect(toast.warning).toHaveBeenCalledWith('Marca al menos un producto vendido');
    expect(ventasApi.corregir).not.toHaveBeenCalled();
  });

  it('si otra persona la cambió (409), recarga y cierra; con otro error deja la ventana abierta', async () => {
    const { w } = await montar();
    ventasApi.anular.mockRejectedValueOnce({ response: { status: 500, data: {} } }).mockRejectedValueOnce({ response: { status: 409, data: { message: 'Otra persona…' } } });
    await boton(w, 'Anular').trigger('click');
    await w.get('textarea').setValue('desistió');
    await boton(w, 'Anular venta').trigger('click');
    await flushPromises();
    expect(w.findComponent(CambiarVentaModal).props('venta')).not.toBeNull();
    expect(ventasApi.deProspecto).toHaveBeenCalledTimes(1);
    await boton(w, 'Anular venta').trigger('click');
    await flushPromises();
    expect(w.findComponent(CambiarVentaModal).props('venta')).toBeNull();
    expect(ventasApi.deProspecto).toHaveBeenCalledTimes(2);
  });
});

describe('CambiarVentaModal: mientras se cierra', () => {
  beforeEach(() => vi.clearAllMocks());

  // Deja a la vista título y contenido aunque esté cerrada, como durante la transición de salida.
  const Ventana = { name: 'BaseModal', props: ['open', 'title'], template: '<div><h3>{{ title }}</h3><slot /><slot name="footer" /></div>' };
  function abrir(props) {
    const pinia = createTestingPinia({ createSpy: vi.fn });
    const w = mount(CambiarVentaModal, {
      props: { venta: ACTIVA, modo: 'corregir', productos: PRODUCTOS, ...props },
      global: { plugins: [pinia], stubs: { BaseModal: Ventana } }
    });
    return { w, toast: useToastStore(pinia), open: () => w.findComponent(Ventana).props('open') };
  }

  it('el título, el total y los productos siguen siendo los de la última venta', async () => {
    const { w, open } = abrir();
    const antes = plano(w);
    expect(antes).toContain('Corregir venta');
    expect(antes).toContain('por $ 17.000.000');
    expect(plano(w.get('[data-testid="total-venta"]'))).toBe('$ 17.000.000');
    await w.setProps({ venta: null });
    expect(open()).toBe(false);
    expect(plano(w)).toBe(antes);
  });

  it.each(['corregir', 'anular'])('el botón de %s ya no envía nada', async (modo) => {
    const { w, toast } = abrir({ modo });
    await w.get('textarea').setValue('un motivo');
    await w.setProps({ venta: null });
    await w.findAll('button').at(-1).trigger('click');
    await flushPromises();
    expect(ventasApi[modo]).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('al abrirla otra vez con la misma venta empieza de cero', async () => {
    const { w } = abrir();
    await w.get('[data-testid="cantidad-2"]').setValue('9');
    await w.get('textarea').setValue('un motivo');
    await w.setProps({ venta: null });
    await w.setProps({ venta: ACTIVA });
    expect(w.get('[data-testid="cantidad-2"]').element.value).toBe('2');
    expect(w.get('textarea').element.value).toBe('');
  });
});
