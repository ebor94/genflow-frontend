import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { registrarVisita: vi.fn() } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { actualizarProductos: vi.fn() } }));
vi.mock('@/api/ventasApi', () => ({ ventasApi: { deProspecto: vi.fn() } }));

import { prospectosApi } from '@/api/prospectosApi';
import { salasApi } from '@/api/salasApi';
import { ventasApi } from '@/api/ventasApi';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import { useToastStore } from '@/stores/useToastStore';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';
import ProductosVendidos from '@/components/crm/ProductosVendidos.vue';
import SelectorProductos from '@/components/crm/SelectorProductos.vue';

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

const OTRO = {
  prosp_id: 901, prosp_area_id: 1, prosp_grupo_id: 1,
  persona: { persona_nombre: 'Luis', persona_telefono_principal: '3009876543' },
  productos: [{ pp_prod_id: 3, pp_es_principal: 1, pp_precio_ofrecido: '6000000.00', producto: PRODUCTOS[2] }]
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
// Los intereses se editan fuera del cierre: con otro estado, o antes de elegirlo.
async function cambiarIntereses(w, ids) {
  if (!w.findComponent(SelectorProductos).exists()) {
    await w.findAll('button').find((b) => b.text().trim() === 'Editar').trigger('click');
  }
  w.findComponent(SelectorProductos).vm.$emit('update:modelValue', ids.map((prod_id, i) => ({ prod_id, es_principal: i === 0, nota: null })));
  await w.vm.$nextTick();
}
const vendidos = (w) => w.findAll('[data-testid^="linea-"]').map((l) => Number(l.attributes('data-testid').slice(6)));
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
      gest_prosp_id: 900, gest_estado_nuevo_id: 15, venta: { clave: expect.any(String), items: [{ prod_id: 2, cantidad: 2, precio_unitario: 8000000 }] }
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
    expect(salasApi.registrarVisita.mock.calls[0][1].venta).toEqual({ clave: expect.any(String), items: [{ prod_id: 2, cantidad: 1, precio_unitario: 8000000 }] });
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

describe('RegistrarGestion: el estado que se puso solo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockResolvedValue({ data: [] });
  });

  it('se deshace al cambiar "Contrato firmado" por otro resultado, y no queda venta', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await resultado(w).setValue('7');
    await flushPromises();
    await resultado(w).setValue('3');
    expect(estado(w).element.value).toBe('');
    expect(w.find('[data-testid="venta"]').exists()).toBe(false);
    await registrar(w);
    const enviado = gestiones.registrar.mock.calls[0][0];
    expect(enviado.gest_estado_nuevo_id).toBeNull();
    expect(enviado).not.toHaveProperty('venta');
  });

  it('vuelve a ponerse y a deshacerse las veces que haga falta', async () => {
    const { w } = await abrir();
    for (let i = 0; i < 2; i += 1) {
      await resultado(w).setValue('7');
      expect(estado(w).element.value).toBe('15');
      await resultado(w).setValue('3');
      expect(estado(w).element.value).toBe('');
    }
  });

  it('el que se elige a mano no se deshace, aunque sea el mismo', async () => {
    const { w } = await abrir();
    await resultado(w).setValue('7');
    await estado(w).setValue('11');
    await estado(w).setValue('15');
    await resultado(w).setValue('3');
    expect(estado(w).element.value).toBe('15');
    expect(w.find('[data-testid="venta"]').exists()).toBe(true);
  });

  it('otro estado elegido a mano tampoco', async () => {
    const { w } = await abrir();
    await resultado(w).setValue('7');
    await estado(w).setValue('11');
    await resultado(w).setValue('3');
    expect(estado(w).element.value).toBe('11');
  });

  it('al abrir de nuevo ya no hay estado automático que deshacer', async () => {
    const { w } = await abrir();
    await resultado(w).setValue('7');
    await w.setProps({ open: false });
    await w.setProps({ open: true });
    await estado(w).setValue('15');
    await resultado(w).setValue('3');
    expect(estado(w).element.value).toBe('15');
  });
});

describe('RegistrarGestion: los intereses que cambian entre un cierre y otro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockResolvedValue({ data: [] });
  });

  it('un interés que se quitó no queda vendido', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    expect(vendidos(w)).toEqual([2]);
    await estado(w).setValue('11');
    await cambiarIntereses(w, [3]);
    await estado(w).setValue('15');
    expect(vendidos(w)).toEqual([3]);
    await registrar(w);
    expect(gestiones.registrar.mock.calls[0][0].venta.items).toEqual([{ prod_id: 3, cantidad: 1, precio_unitario: 6380000 }]);
  });

  it('lo que se agregó a mano se conserva con lo escrito', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="agregar-producto"]').setValue('3');
    await w.get('[data-testid="precio-3"] input').setValue('6000000');
    await estado(w).setValue('11');
    await cambiarIntereses(w, []);
    await estado(w).setValue('15');
    expect(vendidos(w)).toEqual([3]);
    expect(w.get('[data-testid="precio-3"] input').element.value).toBe('6.000.000');
  });

  it('lo agregado a mano sigue siendo a mano aunque haya sido un interés que se quitó', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await estado(w).setValue('11');
    await cambiarIntereses(w, [1]);
    await estado(w).setValue('15');
    expect(vendidos(w)).toEqual([]);
    await w.get('[data-testid="agregar-producto"]').setValue('2');
    await estado(w).setValue('11');
    await estado(w).setValue('15');
    expect(vendidos(w)).toEqual([2]);
  });

  it('un interés que se quita y se vuelve a poner entra de nuevo con su precio', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.get('[data-testid="precio-2"] input').setValue('1');
    await estado(w).setValue('11');
    await cambiarIntereses(w, [3]);
    await estado(w).setValue('15');
    await estado(w).setValue('11');
    await cambiarIntereses(w, [2]);
    await estado(w).setValue('15');
    expect(vendidos(w)).toEqual([2]);
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('8.000.000');
  });
});

describe('RegistrarGestion: cambia el cliente con la ventana abierta', () => {
  const VENTA_900 = { venta_id: 1, venta_anulada: 0, venta_total: '42550000.00', venta_fecha: '2026-11-10' };

  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockImplementation(async (id) => ({ data: id === 900 ? [VENTA_900] : [] }));
  });

  it('el formulario empieza de cero y la venta es del cliente nuevo', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cerrarContrato(w);
    await w.get('textarea').setValue('cierra hoy');
    await w.get('[data-testid="agregar-producto"]').setValue('3');
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(true);

    await w.setProps({ prospecto: OTRO });
    expect(resultado(w).element.value).toBe('');
    expect(estado(w).element.value).toBe('');
    expect(w.get('textarea').element.value).toBe('');
    expect(w.find('[data-testid="venta"]').exists()).toBe(false);

    await cerrarContrato(w);
    expect(ventasApi.deProspecto.mock.calls.map((c) => c[0])).toEqual([900, 901]);
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(false);
    expect(vendidos(w)).toEqual([3]);
    await registrar(w);
    const enviado = gestiones.registrar.mock.calls[0][0];
    expect(enviado.gest_prosp_id).toBe(901);
    expect(enviado.venta.items).toEqual([{ prod_id: 3, cantidad: 1, precio_unitario: 6000000 }]);
  });

  it('un refresco del mismo cliente conserva lo escrito', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.get('textarea').setValue('cierra hoy');
    await w.get('[data-testid="precio-2"] input').setValue('7500000');
    await w.setProps({ prospecto: { ...PROSPECTO, productos: [...PROSPECTO.productos] } });
    expect(resultado(w).element.value).toBe('3');
    expect(estado(w).element.value).toBe('15');
    expect(w.get('textarea').element.value).toBe('cierra hoy');
    expect(w.get('[data-testid="precio-2"] input').element.value).toBe('7.500.000');
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(true);
  });

  it('las ventas del cliente anterior que llegan tarde no se muestran', async () => {
    let tarde;
    ventasApi.deProspecto.mockImplementationOnce(() => new Promise((r) => { tarde = r; }));
    const { w } = await abrir();
    await cerrarContrato(w);
    await w.setProps({ prospecto: OTRO });
    await cerrarContrato(w);
    tarde({ data: [VENTA_900] });
    await flushPromises();
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(false);
  });
});

describe('RegistrarGestion: lo que se envía se decide antes de empezar a guardar', () => {
  let terminar;
  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockResolvedValue({ data: [] });
    prospectosApi.actualizarProductos.mockImplementation(() => new Promise((r) => { terminar = r; }));
  });

  // Deja el guardado detenido en los intereses.
  async function empezarAGuardar(props) {
    const { w, gestiones } = await abrir(props);
    gestiones.registrar.mockResolvedValue({ gest_id: 1 });
    await cambiarIntereses(w, [2]);
    await cerrarContrato(w);
    await w.get('textarea').setValue('cierra hoy');
    await registrar(w);
    expect(prospectosApi.actualizarProductos).toHaveBeenCalledWith(900, [{ prod_id: 2, es_principal: true, nota: null }]);
    return { w, gestiones };
  }
  const venta = { clave: expect.any(String), items: [{ prod_id: 2, cantidad: 1, precio_unitario: 8000000 }] };

  it('cambiar el formulario mientras se guardan los intereses no cambia lo que se envía', async () => {
    const { w, gestiones } = await empezarAGuardar();
    await selects(w)[0].setValue('correo');
    await estado(w).setValue('11');
    await w.get('textarea').setValue('otra cosa');
    terminar();
    await flushPromises();
    expect(gestiones.registrar).toHaveBeenCalledWith({
      gest_prosp_id: 900, gest_canal: 'llamada', gest_duracion_seg: null, gest_resultado_id: 3, gest_estado_nuevo_id: 15,
      gest_comentario: 'cierra hoy', gest_prox_fecha: null, gest_prox_hora: null, venta
    });
  });

  it('si llega otro cliente, la venta sigue siendo del que se estaba cerrando', async () => {
    const { w, gestiones } = await empezarAGuardar();
    await w.setProps({ prospecto: OTRO });
    terminar();
    await flushPromises();
    expect(gestiones.registrar).toHaveBeenCalledTimes(1);
    expect(gestiones.registrar).toHaveBeenCalledWith(expect.objectContaining({ gest_prosp_id: 900, gest_estado_nuevo_id: 15, venta }));
  });

  it('en sala también', async () => {
    salasApi.registrarVisita.mockResolvedValue({ data: { gest_id: 2 } });
    const { w, gestiones } = await empezarAGuardar({ homenajeSalaId: 55 });
    await estado(w).setValue('11');
    await w.setProps({ homenajeSalaId: null });
    terminar();
    await flushPromises();
    expect(salasApi.registrarVisita).toHaveBeenCalledWith(55, expect.objectContaining({ gest_estado_nuevo_id: 15, venta }));
    expect(gestiones.registrar).not.toHaveBeenCalled();
  });
});

describe('RegistrarGestion: la venta no se registra dos veces', () => {
  const REPETIDA = { response: { status: 409, data: { error: 'CONFLICT', message: 'Esta venta ya quedó registrada. Recarga la ficha para verla' } } };
  const FALLA = { response: { status: 500, data: { error: 'INTERNAL_ERROR', message: 'Error interno' } } };
  const VENTA = { venta_id: 1, venta_anulada: 0, venta_total: '8000000.00', venta_fecha: '2026-11-24' };
  const botonRegistrar = (w) => w.findAll('button').find((b) => b.text().trim() === 'Registrar');

  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockReset().mockResolvedValue({ data: [] });
    salasApi.registrarVisita.mockReset();
  });

  it('dos intentos del mismo formulario llevan la misma clave; abrir de nuevo u otro cliente, otra', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockRejectedValue(FALLA);
    const intentar = async () => { await registrar(w); return gestiones.registrar.mock.lastCall[0].venta.clave; };

    await cerrarContrato(w);
    const primera = await intentar();
    expect(primera).toMatch(/^[\w-]{8,40}$/);
    await w.get('[data-testid="precio-2"] input').setValue('7000000');
    await estado(w).setValue('11');
    await estado(w).setValue('15');
    expect(await intentar()).toBe(primera);

    await w.setProps({ open: false });
    await w.setProps({ open: true });
    await cerrarContrato(w);
    const alReabrir = await intentar();
    await w.setProps({ prospecto: OTRO });
    await cerrarContrato(w);
    expect(new Set([primera, alReabrir, await intentar()]).size).toBe(3);
  });

  it('si ya había quedado registrada, avisa y cierra sin error', async () => {
    const { w, gestiones, toast } = await abrir();
    gestiones.registrar.mockRejectedValue(REPETIDA);
    await cerrarContrato(w);
    await registrar(w);
    expect(toast.info).toHaveBeenCalledWith('La venta ya había quedado registrada con lo que se envió primero. Revísala en la ficha.');
    expect(w.emitted('registrada')).toEqual([[null]]);
    expect(w.emitted('close')).toHaveLength(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(ventasApi.deProspecto).toHaveBeenCalledTimes(1);
  });

  it('en sala también', async () => {
    salasApi.registrarVisita.mockRejectedValue(REPETIDA);
    const { w, toast } = await abrir({ homenajeSalaId: 55 });
    await cerrarContrato(w);
    await registrar(w);
    expect(toast.info).toHaveBeenCalledWith('La venta ya había quedado registrada con lo que se envió primero. Revísala en la ficha.');
    expect(w.emitted('registrada')).toEqual([[null]]);
    expect(w.emitted('close')).toHaveLength(1);
    expect(w.emitted('sala-cerrada')).toBeUndefined();
  });

  it('cuenta lo que se envió, aunque el estado cambie mientras responde', async () => {
    let fallar;
    const { w, gestiones, toast } = await abrir();
    gestiones.registrar.mockImplementation(() => new Promise((_r, rechazar) => { fallar = rechazar; }));
    await cerrarContrato(w);
    await registrar(w);
    await estado(w).setValue('11');
    fallar(REPETIDA);
    await flushPromises();
    expect(w.emitted('registrada')).toEqual([[null]]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('un conflicto de una gestión sin venta sigue siendo un error', async () => {
    const { w, gestiones, toast } = await abrir();
    gestiones.registrar.mockRejectedValue(REPETIDA);
    await resultado(w).setValue('3');
    await registrar(w);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(w.emitted('registrada')).toBeUndefined();
    expect(w.emitted('close')).toBeUndefined();
  });

  it('con otro error consulta las ventas antes de dejar reintentar', async () => {
    let responder;
    ventasApi.deProspecto.mockResolvedValueOnce({ data: [] }).mockImplementationOnce(() => new Promise((r) => { responder = r; }));
    const { w, gestiones, toast } = await abrir();
    gestiones.registrar.mockRejectedValue(FALLA);
    await cerrarContrato(w);
    await registrar(w);
    expect(toast.error).toHaveBeenCalledWith('Error interno');
    expect(ventasApi.deProspecto.mock.calls).toEqual([[900], [900]]);
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(false);
    expect(botonRegistrar(w).attributes()).toHaveProperty('disabled');
    responder({ data: [VENTA] });
    await flushPromises();
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(true);
    expect(botonRegistrar(w).attributes()).not.toHaveProperty('disabled');
    expect(w.emitted('close')).toBeUndefined();
  });

  it('si esa consulta también falla, se puede reintentar igual', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockRejectedValue(new Error('Network Error'));
    await cerrarContrato(w);
    ventasApi.deProspecto.mockRejectedValue(new Error('Network Error'));
    await registrar(w);
    await registrar(w);
    expect(gestiones.registrar).toHaveBeenCalledTimes(2);
  });

  it('sin venta, un error no consulta nada', async () => {
    const { w, gestiones } = await abrir();
    gestiones.registrar.mockRejectedValue(FALLA);
    await resultado(w).setValue('3');
    await registrar(w);
    expect(ventasApi.deProspecto).not.toHaveBeenCalled();
  });
});

describe('RegistrarGestion: avisos al cerrar', () => {
  const venta = (venta_id, venta_total, venta_fecha, venta_anulada = 0) => ({ venta_id, venta_total, venta_fecha, venta_anulada });
  const aviso = (w) => plano(w.get('[data-testid="venta-previa"]'));
  beforeEach(() => {
    vi.clearAllMocks();
    ventasApi.deProspecto.mockReset().mockResolvedValue({ data: [] });
  });

  it('si cambió los intereses, dice que también se guardarán', async () => {
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(w.find('[data-testid="intereses-sin-guardar"]').exists()).toBe(false);
    await estado(w).setValue('11');
    await cambiarIntereses(w, [2]);
    await estado(w).setValue('15');
    expect(plano(w.get('[data-testid="venta"] [data-testid="intereses-sin-guardar"]')))
      .toBe('También se guardarán los cambios en los productos de interés.');
  });

  it('cuenta todas las ventas activas y da la fecha de la última', async () => {
    ventasApi.deProspecto.mockResolvedValue({ data: [
      venta(3, '20000000.00', '2026-11-24'), venta(2, '99000000.00', '2026-11-20', 1), venta(1, '30000000.00', '2026-11-10')
    ] });
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(aviso(w)).toBe('Este cliente ya tiene 2 ventas por $ 50.000.000; la última, del 24 nov 2026. Si registras otra, se suman.');
  });

  it('con una activa, el texto de siempre', async () => {
    ventasApi.deProspecto.mockResolvedValue({ data: [venta(2, '99000000.00', '2026-11-20', 1), venta(1, '42550000.00', '2026-11-10')] });
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(aviso(w)).toBe('Este cliente ya tiene una venta de $ 42.550.000 del 10 nov 2026. Si registras otra, se suman.');
  });

  it('la fecha de la última es el día, aunque el servidor mande la hora', async () => {
    ventasApi.deProspecto.mockResolvedValue({ data: [venta(1, '42550000.00', '2026-11-24T05:00:00.000Z')] });
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(aviso(w)).toBe('Este cliente ya tiene una venta de $ 42.550.000 del 24 nov 2026. Si registras otra, se suman.');
  });

  it('solo con anuladas no avisa', async () => {
    ventasApi.deProspecto.mockResolvedValue({ data: [venta(2, '99000000.00', '2026-11-20', 1)] });
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(false);
  });

  it('si anularon la que había, el aviso desaparece al volver a consultar', async () => {
    ventasApi.deProspecto.mockResolvedValueOnce({ data: [venta(1, '42550000.00', '2026-11-10')] });
    const { w } = await abrir();
    await cerrarContrato(w);
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(true);
    await estado(w).setValue('11');
    await estado(w).setValue('15');
    await flushPromises();
    expect(w.find('[data-testid="venta-previa"]').exists()).toBe(false);
  });
});
