import { describe, it, expect } from 'vitest';
import {
  tieneTipos, agruparProductos, filtrarGrupos, alternarInteres, marcarPrincipalEn, precioDe, detalleInteres
} from '@/utils/catalogoProductos';

const p = (prod_id, prod_nombre, prod_categoria, prod_tipo, extra = {}) =>
  ({ prod_id, prod_nombre, prod_categoria, prod_tipo, prod_es_generico: 0, prod_orden_display: prod_id, ...extra });

const CATALOGO = [
  p(1, 'Osarios', 'Mausoleos', 'Osarios', { prod_es_generico: 1 }),
  p(2, 'Osario mural mármol sector A2, sencillo', 'Mausoleos', 'Osarios', { prod_precio_base: '8770000.00' }),
  p(3, 'Osario mural en cerámica, sencillo', 'Mausoleos', 'Osarios', { prod_precio_base: '8140000.00' }),
  p(4, 'Columbario', 'Mausoleos', 'Columbarios', { prod_precio_base: '4785000.00' }),
  p(5, 'Inhumación de osarios', 'Inhumaciones', 'Osarios', { prod_es_generico: 1 }),
  p(6, 'Inhumación osario mármol', 'Inhumaciones', 'Osarios', { prod_precio_base: '876000.00' })
];
const sel = (prod_id, es_principal = false) => ({ prod_id, es_principal, nota: null });
const plano = (t) => t.replace(/\s/g, ' ');

describe('tieneTipos', () => {
  it('solo si algún producto tiene tipo', () => {
    expect(tieneTipos(CATALOGO)).toBe(true);
    expect(tieneTipos([{ prod_id: 1, prod_tipo: null }, { prod_id: 2, prod_tipo: '' }])).toBe(false);
    expect(tieneTipos(undefined)).toBe(false);
  });
});

describe('agruparProductos', () => {
  it('categoría → tipo → productos, con la fila por definir aparte', () => {
    const g = agruparProductos(CATALOGO);
    expect(g.map((x) => x.categoria)).toEqual(['Mausoleos', 'Inhumaciones']);
    expect(g[0].tipos.map((x) => x.tipo)).toEqual(['Osarios', 'Columbarios']);
    expect(g[0].tipos[0].generico.prod_id).toBe(1);
    expect(g[0].tipos[0].productos.map((x) => x.prod_id)).toEqual([2, 3]);
    expect(g[0].tipos[1].generico).toBeNull();
  });

  it('respeta prod_orden_display sin cambiar el arreglo original', () => {
    const al = [...CATALOGO].reverse();
    expect(agruparProductos(al).map((x) => x.categoria)).toEqual(['Mausoleos', 'Inhumaciones']);
    expect(al[0].prod_id).toBe(6);
  });

  it('lo que no tiene categoría o tipo va en Otros', () => {
    const g = agruparProductos([p(9, 'Suelto', null, null)]);
    expect(g).toEqual([{ categoria: 'Otros', tipos: [expect.objectContaining({ tipo: 'Otros' })] }]);
  });
});

describe('filtrarGrupos', () => {
  const grupos = agruparProductos(CATALOGO);
  const ids = (g) => g.flatMap((x) => x.tipos.flatMap((t) => [t.generico, ...t.productos].filter(Boolean).map((y) => y.prod_id)));

  it('sin texto devuelve todo', () => expect(filtrarGrupos(grupos, '  ')).toBe(grupos));
  it('busca por palabras sueltas, sin tildes ni mayúsculas', () => expect(ids(filtrarGrupos(grupos, 'MARMOL a2'))).toEqual([2]));
  it('también busca por categoría y tipo', () => expect(ids(filtrarGrupos(grupos, 'inhumaciones osarios'))).toEqual([5, 6]));
  it('sin coincidencias devuelve vacío', () => expect(filtrarGrupos(grupos, 'xyz')).toEqual([]));
  it('conserva el por definir cuando solo coincide el tipo', () => expect(ids(filtrarGrupos(grupos, 'osarios mausoleos'))).toEqual([1, 2, 3]));
});

describe('alternarInteres', () => {
  it('el primero que se elige es el principal', () => {
    expect(alternarInteres([], CATALOGO[1], CATALOGO)).toEqual([sel(2, true)]);
  });
  it('el segundo no es principal', () => {
    expect(alternarInteres([sel(2, true)], CATALOGO[3], CATALOGO)).toEqual([sel(2, true), sel(4)]);
  });
  it('elegir un producto quita el por definir de su tipo y hereda el principal', () => {
    expect(alternarInteres([sel(1, true)], CATALOGO[1], CATALOGO)).toEqual([sel(2, true)]);
  });
  it('no quita el por definir del mismo tipo en otra categoría', () => {
    expect(alternarInteres([sel(5, true)], CATALOGO[1], CATALOGO)).toEqual([sel(5, true), sel(2)]);
  });
  it('volver a tocarlo lo quita, y si era el principal pasa al primero que quede', () => {
    expect(alternarInteres([sel(2, true), sel(4)], CATALOGO[1], CATALOGO)).toEqual([sel(4, true)]);
  });
  it('conserva la nota de los demás y no cambia la selección recibida', () => {
    const antes = [{ prod_id: 2, es_principal: true, nota: 'con descuento' }];
    expect(alternarInteres(antes, CATALOGO[3], CATALOGO)[0].nota).toBe('con descuento');
    expect(antes).toHaveLength(1);
  });
  it('si el por definir era el principal y hay otros intereses, lo hereda el producto nuevo', () => {
    expect(alternarInteres([sel(1, true), sel(4)], CATALOGO[1], CATALOGO)).toEqual([sel(4), sel(2, true)]);
  });
  it('si el por definir no era el principal, el principal no cambia', () => {
    expect(alternarInteres([sel(4, true), sel(1)], CATALOGO[1], CATALOGO)).toEqual([sel(4, true), sel(2)]);
  });
});

describe('marcarPrincipalEn', () => {
  it('deja un solo principal', () => {
    expect(marcarPrincipalEn([sel(2, true), sel(4)], 4)).toEqual([sel(2), sel(4, true)]);
  });
});

describe('precioDe', () => {
  it.each([['8770000.00', 8770000], [876000, 876000], [null, null], [undefined, null], ['', null], [0, null], ['0.00', null], ['x', null]])('%s → %s', (v, e) => {
    expect(precioDe(v)).toBe(e);
  });
});

describe('detalleInteres', () => {
  it('por definir', () => expect(detalleInteres({ producto: CATALOGO[0], pp_precio_ofrecido: null })).toBe('por definir'));
  it('precio ofrecido igual al vigente', () => {
    expect(plano(detalleInteres({ producto: CATALOGO[1], pp_precio_ofrecido: '8770000.00' }))).toBe('$ 8.770.000');
  });
  it('precio ofrecido distinto del vigente', () => {
    expect(plano(detalleInteres({ producto: CATALOGO[1], pp_precio_ofrecido: '8000000.00' }))).toBe('$ 8.000.000 (vigente $ 8.770.000)');
  });
  it('precio ofrecido sin precio vigente muestra solo el ofrecido', () => {
    expect(plano(detalleInteres({ producto: { prod_nombre: 'X', prod_precio_base: null }, pp_precio_ofrecido: '100000.00' }))).toBe('$ 100.000');
  });
  it('sin precio guardado no muestra nada', () => {
    expect(detalleInteres({ producto: CATALOGO[1], pp_precio_ofrecido: null })).toBe('');
    expect(detalleInteres({ producto: null })).toBe('');
  });
});
