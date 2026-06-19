/**
 * useAgenda — utilidades para el MiniCalendar y AgeCard:
 *   - clasifica urgencia (vencida, hoy, próxima)
 *   - genera matriz semana/mes
 */
import { dayjs } from '@/utils/format';

export function useAgenda() {
  function urgencia(fechaProx) {
    if (!fechaProx) return 'sin';
    const hoy = dayjs().startOf('day');
    const d   = dayjs(fechaProx).startOf('day');
    if (d.isBefore(hoy))         return 'vencida';
    if (d.isSame(hoy, 'day'))    return 'hoy';
    return 'futura';
  }

  function colorUrgencia(u) {
    return { vencida: '#B83227', hoy: '#C97B1A', futura: '#6B8F6E', sin: '#8A6A52' }[u];
  }

  /**
   * Genera matriz 7×N para mostrar un mes completo (semana inicia lunes).
   */
  function matrizMes(anio, mes /* 1-12 */) {
    const primer = dayjs(`${anio}-${String(mes).padStart(2,'0')}-01`);
    const diasMes = primer.daysInMonth();
    // Lunes=1 ... Domingo=7 → ajustar (dayjs domingo=0 → lo movemos a 7)
    const dowPrimero = primer.day() === 0 ? 7 : primer.day();
    const cells = [];
    // Days from previous month
    for (let i = dowPrimero - 1; i > 0; i--) {
      cells.push({ fecha: primer.subtract(i, 'day'), mesActual: false });
    }
    for (let d = 1; d <= diasMes; d++) {
      cells.push({ fecha: primer.date(d), mesActual: true });
    }
    // Fill until multiple of 7
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].fecha;
      cells.push({ fecha: last.add(1, 'day'), mesActual: false });
    }
    return cells;
  }

  return { urgencia, colorUrgencia, matrizMes, dayjs };
}
