/**
 * Catálogo de productos con tres niveles: categoría → tipo → producto.
 * Un tipo puede tener una fila "por definir" (prod_es_generico): el cliente pregunta
 * por el tipo, pero todavía no hay un producto exacto.
 * Selección: [{ prod_id, es_principal, nota }].
 */
import { fmtCOP } from '@/utils/format';

export function tieneTipos(productos) {
  return (productos || []).some((p) => !!p.prod_tipo);
}

/** Número positivo o null: sin precio, 0 y vacío no se muestran. */
export function precioDe(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function agruparProductos(productos) {
  const categorias = new Map();
  const ordenados = [...(productos || [])].sort((a, b) => (a.prod_orden_display || 0) - (b.prod_orden_display || 0));
  for (const p of ordenados) {
    const categoria = p.prod_categoria || 'Otros';
    const tipo = p.prod_tipo || 'Otros';
    if (!categorias.has(categoria)) categorias.set(categoria, new Map());
    const tipos = categorias.get(categoria);
    if (!tipos.has(tipo)) tipos.set(tipo, { tipo, generico: null, productos: [] });
    if (p.prod_es_generico) tipos.get(tipo).generico = p;
    else tipos.get(tipo).productos.push(p);
  }
  return [...categorias].map(([categoria, tipos]) => ({ categoria, tipos: [...tipos.values()] }));
}

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filtrarGrupos(grupos, texto) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return grupos;
  const coincide = (...partes) => {
    const t = normalizar(partes.join(' '));
    return palabras.every((palabra) => t.includes(palabra));
  };
  return grupos
    .map((g) => ({
      ...g,
      tipos: g.tipos
        .map((t) => ({
          ...t,
          generico: t.generico && coincide(g.categoria, t.tipo, t.generico.prod_nombre) ? t.generico : null,
          productos: t.productos.filter((p) => coincide(g.categoria, t.tipo, p.prod_nombre))
        }))
        .filter((t) => t.generico || t.productos.length)
    }))
    .filter((g) => g.tipos.length);
}

// Siempre debe haber un principal mientras haya algo elegido.
function conPrincipal(seleccion) {
  if (!seleccion.length || seleccion.some((s) => s.es_principal)) return seleccion;
  return seleccion.map((s, i) => ({ ...s, es_principal: i === 0 }));
}

const claveTipo = (p) => `${p.prod_categoria || ''}|${p.prod_tipo || ''}`;

export function alternarInteres(seleccion, producto, catalogo) {
  if (seleccion.some((s) => s.prod_id === producto.prod_id)) {
    return conPrincipal(seleccion.filter((s) => s.prod_id !== producto.prod_id));
  }
  let base = seleccion;
  let heredaPrincipal = false;
  if (!producto.prod_es_generico && producto.prod_tipo) {
    // Ya se sabe qué quiere: sobra el "por definir" de ese mismo tipo.
    const genericos = new Set((catalogo || [])
      .filter((p) => p.prod_es_generico && claveTipo(p) === claveTipo(producto))
      .map((p) => p.prod_id));
    heredaPrincipal = seleccion.some((s) => genericos.has(s.prod_id) && s.es_principal);
    base = seleccion.filter((s) => !genericos.has(s.prod_id));
  }
  return conPrincipal([...base, { prod_id: producto.prod_id, es_principal: heredaPrincipal, nota: null }]);
}

export function marcarPrincipalEn(seleccion, prodId) {
  return seleccion.map((s) => ({ ...s, es_principal: s.prod_id === prodId }));
}

/** Texto junto al nombre de un interés guardado (fila pp con su producto). */
export function detalleInteres(pp) {
  if (pp?.producto?.prod_es_generico) return 'por definir';
  const ofrecido = precioDe(pp?.pp_precio_ofrecido);
  if (!ofrecido) return '';
  const vigente = precioDe(pp.producto?.prod_precio_base);
  return vigente && vigente !== ofrecido ? `${fmtCOP(ofrecido)} (vigente ${fmtCOP(vigente)})` : fmtCOP(ofrecido);
}
