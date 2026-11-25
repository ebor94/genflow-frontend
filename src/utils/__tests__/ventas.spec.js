import { describe, it, expect, vi, afterEach } from 'vitest';
import { lineasIniciales, porDefinir, lineasDeVenta, lineaDe, subtotal, totalVenta, errorVenta, itemsVenta, nuevaClave } from '@/utils/ventas';

const p = (prod_id, prod_nombre, prod_precio_base, prod_es_generico = 0) => ({ prod_id, prod_nombre, prod_precio_base, prod_es_generico });
const CATALOGO = [p(1, 'Osarios', null, 1), p(2, 'Osario A2', '8770000.00'), p(3, 'Lote doble', '18950000.00'), p(4, 'Nivel 1A', '0.00')];
const SEL = [{ prod_id: 1 }, { prod_id: 2 }, { prod_id: 4 }, { prod_id: 99 }];
const L = (datos = {}) => ({ prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 2, precio_unitario: 100, ...datos });

describe('líneas iniciales', () => {
  it('toma los productos exactos con el precio ofrecido, o el del catálogo', () => {
    const r = lineasIniciales(SEL, CATALOGO, [{ pp_prod_id: 2, pp_precio_ofrecido: '8000000.00' }]);
    expect(r).toEqual([
      { prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 1, precio_unitario: 8000000 },
      { prod_id: 4, nombre: 'Nivel 1A', vendido: true, cantidad: 1, precio_unitario: null }
    ]);
    expect(lineasIniciales([{ prod_id: 2 }], CATALOGO, [])[0].precio_unitario).toBe(8770000);
    expect(lineasIniciales([{ prod_id: 2 }], CATALOGO, [{ pp_prod_id: 2, pp_precio_ofrecido: null }])[0].precio_unitario).toBe(8770000);
  });
  it('los "por definir" van aparte', () => expect(porDefinir(SEL, CATALOGO)).toEqual(['Osarios']));
  it('sin selección ni catálogo no falla', () => {
    expect(lineasIniciales(null, null, null)).toEqual([]);
    expect(porDefinir(undefined, undefined)).toEqual([]);
  });
  it('una línea nueva usa el precio del catálogo', () => expect(lineaDe(CATALOGO[2])).toEqual({ prod_id: 3, nombre: 'Lote doble', vendido: true, cantidad: 1, precio_unitario: 18950000 }));
});

it('las líneas de una venta guardada conservan lo vendido', () => {
  expect(lineasDeVenta({ items: [
    { vi_prod_id: 2, vi_cantidad: 2, vi_precio_unitario: '8500000.00', producto: { prod_nombre: 'Osario A2' } },
    { vi_prod_id: 9, vi_cantidad: 1, vi_precio_unitario: '5.00', producto: null }
  ] })).toEqual([
    { prod_id: 2, nombre: 'Osario A2', vendido: true, cantidad: 2, precio_unitario: 8500000 },
    { prod_id: 9, nombre: 'Producto no disponible', vendido: true, cantidad: 1, precio_unitario: 5 }
  ]);
  expect(lineasDeVenta(null)).toEqual([]);
});

it('la cantidad siempre es numérica', () => {
  expect(lineasDeVenta({ items: [{ vi_prod_id: 2, vi_cantidad: '2', vi_precio_unitario: '1.00', producto: null }] })[0].cantidad).toBe(2);
});

describe('total, validación y envío', () => {
  it('suma solo lo vendido', () => {
    expect(subtotal(L())).toBe(200);
    expect(totalVenta([L(), L({ prod_id: 3, cantidad: 1 }), L({ prod_id: 4, vendido: false })])).toBe(300);
    expect(totalVenta([L({ cantidad: null }), L({ prod_id: 3, precio_unitario: null })])).toBe(0);
  });
  it.each([
    ['nada marcado', [L({ vendido: false })], 'Marca al menos un producto vendido'],
    ['sin líneas', [], 'Marca al menos un producto vendido'],
    ['cantidad vacía', [L({ cantidad: null })], 'Revisa la cantidad de "Osario A2"'],
    ['cantidad 0', [L({ cantidad: 0 })], 'Revisa la cantidad de "Osario A2"'],
    ['sin precio', [L({ precio_unitario: null })], 'Escribe el precio de "Osario A2"'],
    ['precio 0', [L({ precio_unitario: 0 })], 'Escribe el precio de "Osario A2"'],
    ['completa', [L(), L({ prod_id: 3, vendido: false, precio_unitario: null })], '']
  ])('%s', (_n, lineas, mensaje) => expect(errorVenta(lineas)).toBe(mensaje));
  it('envía solo lo vendido y solo los datos que el servidor espera', () => {
    expect(itemsVenta([L(), L({ prod_id: 3, vendido: false })])).toEqual([{ prod_id: 2, cantidad: 2, precio_unitario: 100 }]);
  });
});

describe('clave de la venta', () => {
  afterEach(() => vi.unstubAllGlobals());
  const claves = () => Array.from({ length: 200 }, nuevaClave);
  const validas = (lista) => {
    expect(new Set(lista).size).toBe(lista.length);
    for (const c of lista) expect(c).toMatch(/^[\w-]{8,40}$/);
  };

  it('usa crypto.randomUUID si el navegador lo tiene', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '3f0c9a2e-7d41-4a55-9b1e-5f1d2c3b4a59' });
    expect(nuevaClave()).toBe('3f0c9a2e-7d41-4a55-9b1e-5f1d2c3b4a59');
  });
  it('da claves distintas que el servidor acepta', () => validas(claves()));
  it.each([['sin randomUUID (página http)', {}], ['sin crypto', undefined]])('también %s', (_n, crypto) => {
    vi.stubGlobal('crypto', crypto);
    validas(claves());
  });
  it('sigue siendo válida si el azar sale en cero', () => {
    vi.stubGlobal('crypto', {});
    const azar = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(nuevaClave()).toMatch(/^[\w-]{8,40}$/);
    azar.mockRestore();
  });
});
