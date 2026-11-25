import { describe, it, expect } from 'vitest';
import { areaPrenec, porcentaje, cumplimiento, estadoCumplimiento, mesesOpciones, mesLabel } from '@/utils/presupuesto';

describe('cumplimiento', () => {
  it('redondea al entero', () => {
    expect(cumplimiento(50, 100)).toBe(50);
    expect(cumplimiento(887.6, 1000)).toBe(89);
    expect(cumplimiento(994, 1000)).toBe(99);
    expect(cumplimiento(250, 100)).toBe(250);
  });
  it('con presupuesto 0 es null, haya o no realizado', () => {
    expect(cumplimiento(0, 0)).toBeNull();
    expect(cumplimiento(5000, 0)).toBeNull();
    expect(cumplimiento(5000, null)).toBeNull();
  });
  it('con presupuesto y sin realizado es 0', () => {
    expect(cumplimiento(0, 1000)).toBe(0);
  });
});

describe('estadoCumplimiento', () => {
  it('bordes 79 / 80 / 99 / 100', () => {
    expect(estadoCumplimiento(79)).toBe('mal');
    expect(estadoCumplimiento(80)).toBe('alerta');
    expect(estadoCumplimiento(99)).toBe('alerta');
    expect(estadoCumplimiento(100)).toBe('ok');
    expect(estadoCumplimiento(180)).toBe('ok');
    expect(estadoCumplimiento(0)).toBe('mal');
  });
  it('el color sale del valor sin redondear', () => {
    const pct = porcentaje(996, 1000); // 99,6
    expect(cumplimiento(996, 1000)).toBe(99);
    expect(estadoCumplimiento(pct)).toBe('alerta');
    expect(estadoCumplimiento(porcentaje(796, 1000))).toBe('mal');
  });
  it('el texto nunca cruza un umbral que el valor no alcanza', () => {
    const c = (x) => cumplimiento(x * 10, 1000); // x en %
    expect([c(79.4), c(79.6), c(80), c(99.4), c(99.6), c(100)]).toEqual([79, 79, 80, 99, 99, 100]);
    expect(c(100.4)).toBe(100);
    expect(c(80.4)).toBe(80);
  });
  it('sin presupuesto es sin', () => {
    expect(estadoCumplimiento(null)).toBe('sin');
    expect(estadoCumplimiento(porcentaje(5000, 0))).toBe('sin');
  });
});

describe('meses', () => {
  it('mesLabel', () => {
    expect(mesLabel(2026, 10)).toBe('octubre 2026');
    expect(mesLabel(2027, 1)).toBe('enero 2027');
  });
  it('mesesOpciones: del mes siguiente hacia atrás, n opciones, cruzando el año', () => {
    const o = mesesOpciones(4, new Date(2026, 10, 25)); // noviembre 2026
    expect(o.map((x) => x.value)).toEqual(['2026-12', '2026-11', '2026-10', '2026-09']);
    expect(o[0].label).toBe('Diciembre 2026');
    const e = mesesOpciones(3, new Date(2026, 11, 3));
    expect(e.map((x) => x.value)).toEqual(['2027-01', '2026-12', '2026-11']);
  });
});

describe('areaPrenec', () => {
  const PRENEC = { area_id: 3, area_codigo: 'PRENEC' };
  it('usa la de Prenecesidad aunque la activa sea otra', () => {
    expect(areaPrenec({ areasAccesibles: [{ area_id: 9, area_codigo: 'SVC' }, PRENEC], areaActivaId: 9 })).toBe(3);
  });
  it('sin Prenecesidad en la lista, usa la activa', () => {
    expect(areaPrenec({ areasAccesibles: [{ area_id: 9, area_codigo: 'SVC' }], areaActivaId: 9 })).toBe(9);
    expect(areaPrenec({ areasAccesibles: [], areaActivaId: null })).toBeNull();
  });
});
