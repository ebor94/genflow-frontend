import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { registrarVisita: vi.fn() } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { actualizarProductos: vi.fn() } }));
vi.mock('@/api/ventasApi', () => ({ ventasApi: { deProspecto: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import { ventasApi } from '@/api/ventasApi';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useToastStore } from '@/stores/useToastStore';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';

const prod = (prod_id, prod_nombre, prod_precio_base, extra = {}) => ({
  prod_id, prod_nombre, prod_tipo: 'Osarios', prod_categoria: 'Mausoleos', prod_area_id: 1, prod_activo: 1,
  prod_orden_display: prod_id, prod_es_generico: 0, prod_precio_base, ...extra
});
const PRODUCTOS = [prod(1, 'Osarios', null, { prod_es_generico: 1 }), prod(2, 'Osario A2', '8770000.00'), prod(3, 'Osario F1', '6380000.00')];
const ESTADOS = [
  { estado_id: 11, estado_grupo_id: 1, estado_activo: 1, estado_orden: 2, estado_nombre: 'Contactado', estado_es_ganado: 0 },
  { estado_id: 15, estado_grupo_id: 1, estado_activo: 1, estado_orden: 5, estado_nombre: 'Contrato cerrado', estado_es_ganado: 1 }
];
const RESULTADOS = [
  { resultado_id: 3, resultado_codigo: 'INTERESADO_INFO', resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 1, resultado_nombre: 'Interesado' },
  { resultado_id: 7, resultado_codigo: 'CONTRATO', resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 7, resultado_nombre: 'Contrato firmado' }
];
const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1,
  persona: { persona_nombre: 'Marta', persona_telefono_principal: '3001234567' },
  productos: [
    { pp_prod_id: 1, pp_es_principal: 1, pp_precio_ofrecido: null, producto: PRODUCTOS[0] },
    { pp_prod_id: 2, pp_es_principal: 0, pp_precio_ofrecido: '8000000.00', producto: PRODUCTOS[1] }
  ]
};

async function abrir(props = {}, productos = PRODUCTOS) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = { productos, estados: ESTADOS, resultados: RESULTADOS };
  const w = mount(RegistrarGestion, {
    props: { open: false, prospecto: PROSPECTO, ...props },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  return { w, gestiones: useGestionesStore(pinia), toast: useToastStore(pinia) };
}
// Selects: canal (solo fuera de sala), resultado, estado.
const selects = (w) => w.findAll('form > div select, form select').filter((s) => !s.attributes('data-testid'));
const resultado = (w) => selects(w).at(-2);
const estado = (w) => selects(w).at(-1);
async function cerrarContrato(w) {
  await resultado(w).setValue('3');
  await estado(w).setValue('15');
  await flushPromises();
}
async function registrar(w) {
  await w.findAll('button').find((b) => b.text().trim() === 'Registrar').trigger('click');
  await flushPromises();
}
const plano = (x) => x.text().replace(/\s+/g, ' ').trim();

describe('RegistrarGestion: cerrar el contrato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockResolvedValue({ data: [] });
  });

  it('muestra la venta en vez de los intereses, con lo que se le ofreció', async () => {
    const { w } = await abrir();
    expect(w.find('[data-testid="venta"]').exists()).toBe(false);
    await cerrarContrato(w);
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('8.000.000');
    expect(plano(w.get('[data-testid="por-definir"]'))).toContain('Falta definir: Osarios.');
    expect(w.text()).not.toContain('Productos de interés');
  });

  it('envía la venta con la gestión', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    await w.get('[data-testid="cantidad-2"]').setValue('2');
    await registrar(w);
    expect(gestiones.registrar.mock.calls[0][0]).toEqual(expect.objectContaining({
      gest_prosp_id: 900, gest_estado_nuevo_id: 15, venta: { items: [{ prod_id: 2, cantidad: 2, precio_unitario: 8000000 }] }
    }));
  });

  it('si falta algo avisa y no envía', async () => {
    const { w, gestiones, toast } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="vendido-2"]').setValue(false);
    await registrar(w);
    expect(toast.warning).toHaveBeenCalledWith('Marca al menos un producto vendido');
    expect(gestiones.registrar).not.toHaveBeenCalled();
  });

  it('las demás gestiones no llevan venta', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    await estado(w).setValue('11');
    await registrar(w);
    expect(gestiones.registrar.mock.calls[0][0]).not.toHaveProperty('venta');
  });

  it('cambiar de estado y volver conserva lo escrito', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="precio-2"] input').setValue('7500000');
    await estado(w).setValue('11');
    await estado(w).setValue('15');
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('7.500.000');
    expect(w.findAll('[data-testid^="linea-"]')).toHaveLength(1);
  });

  it('al abrir de nuevo no queda nada de la venta anterior', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="precio-2"] input').setValue('1');
    await w.setProps({ open: false });
    await w.setProps({ open: true });
    await cerrarContrato(w);
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('8.000.000');
  });

  it('"Contrato firmado" pasa el estado solo a "Contrato cerrado", sin pisar uno elegido', async () => {
    const { w } = await abrir();
    await resultado(w).setValue('7');
    await flushPromises();
    expect(estado(w).element.value).toBe('15');
    expect(w.find('[data-testid="venta"]').exists()).toBe(true);

    const otra = (await abrir()).w;
    await estado(otra).setValue('11');
    await resultado(otra).setValue('7');
    expect(estado(otra).element.value).toBe('11');
  });

  it('avisa si el cliente ya tiene una venta activa', async () => {
    ventasApi.deProspecto.mockResolvedValue({ data: [
      { venta_id: 2, venta_anulada: 1, venta_total: '1.00', venta_fecha: '2026-11-20' },
      { venta_id: 1, venta_anulada: 0, venta_total: '42550000.00', venta_fecha: '2026-11-10' }
    ] });
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(ventasApi.deProspecto).toHaveBeenCalledWith(900);
    expect(plano(w.get('[data-testid="venta-previa"]'))).toContain('ya tiene una venta de $ 42.550.000');
  });

  it('si no se pueden consultar las ventas, igual se puede cerrar', async () => {
    ventasApi.deProspecto.mockRejectedValue(new Error('sin red'));
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    await registrar(w);
    expect(gestiones.registrar).toHaveBeenCalledTimes(1);
  });

  it('en sala, el dueño cierra con su venta', async () => {
    salasApi.registrarVisita.mockResolvedValue({ data: { gest_id: 2 } });
    const { w } = await abrir({ homenajeSalaId: 55 });
    await cerrarContrato(w);
    await registrar(w);
    expect(salasApi.registrarVisita.mock.calls[0][1].venta).toEqual({ items: [{ prod_id: 2, cantidad: 1, precio_unitario: 8000000 }] });
  });

  it('en sala, quien visita al cliente de otro no ve "Contrato cerrado"', async () => {
    const { w } = await abrir({ homenajeSalaId: 55, resumenCliente: { duenio_nombre: 'Otro', estado_nombre: 'Contactado' } });
    expect(estado(w).text()).not.toContain('Contrato cerrado');
    await resultado(w).setValue('7');
    expect(estado(w).element.value).toBe('');
    expect(w.findComponent(ProductosVendidos).exists()).toBe(false);
  });

  it('en un área sin tipos no pide venta ni cambia el estado solo', async () => {
    const { w, gestiones } = await abrir({}, [prod(2, 'Plan', '1.00', { prod_tipo: null })]);
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await resultado(w).setValue('7');
    expect(estado(w).element.value).toBe('');
    await cerrarContrato(w);
    expect(w.find('[data-testid="venta"]').exists()).toBe(false);
    await registrar(w);
    expect(gestiones.registrar.mock.calls[0][0]).not.toHaveProperty('venta');
  });
});
