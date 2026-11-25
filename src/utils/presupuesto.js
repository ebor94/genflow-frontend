/**
 * Presupuesto contra realizado: cumplimiento, semáforo y meses.
 */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Realizado ÷ presupuesto en %, sin redondear. null si no hay presupuesto. */
export function porcentaje(realizado, presupuesto) {
  const p = Number(presupuesto);
  if (!p) return null;
  return (Number(realizado) || 0) / p * 100;
}

/** Cumplimiento para mostrar: entero, o null sin presupuesto. */
export function cumplimiento(realizado, presupuesto) {
  const pct = porcentaje(realizado, presupuesto);
  return pct === null ? null : Math.round(pct);
}

/** Estado del semáforo. Recibe el % SIN redondear: 99,6 % es 'alerta' aunque se lea 100 %. */
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
