/**
 * Utilidades de formato compartidas.
 */
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('es');
dayjs.extend(relativeTime);

export function fmtFecha(d, fmt = 'DD MMM YYYY') {
  if (!d) return '—';
  return dayjs(d).format(fmt);
}

export function fmtFechaHora(d) {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YYYY · HH:mm');
}

export function fmtRelativo(d) {
  if (!d) return '—';
  return dayjs(d).fromNow();
}

export function fmtCOP(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export function fmtNumero(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-CO').format(n);
}

export { dayjs };
