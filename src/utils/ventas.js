/**
 * Venta al cerrar un contrato. Una línea por producto:
 * { prod_id, nombre, vendido, cantidad, precio_unitario }.
 * El total que vale es el del servidor; aquí se calcula para mostrarlo.
 */
import { precioDe } from '@/utils/catalogoProductos';

// La lista de Administración admite decimales y el servidor solo acepta pesos enteros.
const enPesos = (valor) => (valor === null ? null : Math.round(valor));

/** El día de la venta como texto: el servidor manda "2026-11-24" o "2026-11-24T05:00:00.000Z". */
export function diaVenta(venta) {
  return typeof venta?.venta_fecha === 'string' ? venta.venta_fecha.slice(0, 10) : '';
}

export function lineaDe(producto, precioOfrecido = null) {
  return {
    prod_id: producto.prod_id,
    nombre: producto.prod_nombre,
    vendido: true,
    cantidad: 1,
    precio_unitario: enPesos(precioDe(precioOfrecido) ?? precioDe(producto.prod_precio_base))
  };
}

function elegidos(seleccion, productos) {
  const catalogo = new Map((productos || []).map((p) => [p.prod_id, p]));
  return (seleccion || []).map((s) => catalogo.get(s.prod_id)).filter(Boolean);
}

/** Los productos exactos que le interesan al cliente, con el precio que se le ofreció. */
export function lineasIniciales(seleccion, productos, intereses) {
  const ofrecidos = new Map((intereses || []).map((pp) => [pp.pp_prod_id, pp.pp_precio_ofrecido]));
  return elegidos(seleccion, productos)
    .filter((p) => !p.prod_es_generico)
    .map((p) => lineaDe(p, ofrecidos.get(p.prod_id)));
}

/** Intereses "por definir": no se pueden vender hasta elegir el producto. */
export function porDefinir(seleccion, productos) {
  return elegidos(seleccion, productos).filter((p) => p.prod_es_generico).map((p) => p.prod_nombre);
}

export function lineasDeVenta(venta) {
  return (venta?.items || []).map((i) => ({
    prod_id: i.vi_prod_id,
    nombre: i.producto?.prod_nombre || 'Producto no disponible',
    vendido: true,
    cantidad: Number(i.vi_cantidad),
    precio_unitario: Number(i.vi_precio_unitario)
  }));
}

const vendidas = (lineas) => lineas.filter((l) => l.vendido);

export function subtotal(linea) {
  return (linea.cantidad || 0) * (linea.precio_unitario || 0);
}

export function totalVenta(lineas) {
  return vendidas(lineas).reduce((suma, l) => suma + subtotal(l), 0);
}

/** Qué falta para poder guardar, o '' si la venta está completa. */
export function errorVenta(lineas) {
  const v = vendidas(lineas);
  if (!v.length) return 'Marca al menos un producto vendido';
  const sinCantidad = v.find((l) => !Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > 999);
  if (sinCantidad) return `Revisa la cantidad de "${sinCantidad.nombre}"`;
  const sinPrecio = v.find((l) => !(l.precio_unitario > 0) || !Number.isInteger(l.precio_unitario));
  if (sinPrecio) return `Escribe el precio de "${sinPrecio.nombre}"`;
  return '';
}

export function itemsVenta(lineas) {
  return vendidas(lineas).map(({ prod_id, cantidad, precio_unitario }) => ({ prod_id, cantidad, precio_unitario }));
}

/** Una por formulario: el servidor rechaza la repetida, así la venta no queda dos veces. */
export function nuevaClave() {
  // randomUUID no existe en páginas http.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const azar = () => Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${azar()}${azar()}`;
}
