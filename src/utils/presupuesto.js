/**
 * Presupuesto contra realizado: cumplimiento, semáforo y meses.
 */
import { AREAS } from '@/utils/areasIds';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Área de Prenecesidad. El super admin puede no tenerla en su lista: ahí vale el id del seed. */
export function areaPrenec(auth) {
  const a = (auth.areasAccesibles || []).find((x) => x.area_codigo === 'PRENEC');
  return a ? a.area_id : AREAS.PRENEC;
}

/** Realizado ÷ presupuesto en %, sin redondear. null si no hay presupuesto. */
export function porcentaje(realizado, presupuesto) {
  const p = Number(presupuesto);
  if (!p) return null;
  return (Number(realizado) || 0) / p * 100;
}

/**
 * Cumplimiento para mostrar: entero, o null sin presupuesto. Se redondea, pero el texto no
 * cruza un umbral que el valor no alcanza: 99,6 se lee 99 (no 100) y 79,6 se lee 79 (no 80).
 */
export function cumplimiento(realizado, presupuesto) {
  const pct = porcentaje(realizado, presupuesto);
  if (pct === null) return null;
  const r = Math.round(pct);
  if (r === 100 && pct < 100) return 99;
  if (r === 80 && pct < 80) return 79;
  return r;
}

/** Estado del semáforo. Recibe el % SIN redondear (de `porcentaje`); coincide con el texto de `cumplimiento`. */
export function estadoCumplimiento(pct) {
  if (pct === null || pct === undefined) return 'sin';
  if (pct >= 100) return 'ok';
  if (pct >= 80) return 'alerta';
  return 'mal';
}

export function mesLabel(anio, mes) {
  return `${MESES[mes - 1]} ${anio}`;
}

/** n meses en orden descendente, empezando por el siguiente al actual (se presupuesta por adelantado). */
export function mesesOpciones(n, hoy = new Date()) {
  const opciones = [];
  for (let i = 1; i > 1 - n; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    const label = mesLabel(anio, mes);
    opciones.push({ value: `${anio}-${String(mes).padStart(2, '0')}`, label: label[0].toUpperCase() + label.slice(1) });
  }
  return opciones;
}
