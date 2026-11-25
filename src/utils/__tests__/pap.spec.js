import { describe, it, expect } from 'vitest';
import { pideFechaPap } from '@/utils/pap';

const res = (codigo, extra = {}) => ({ resultado_codigo: codigo, resultado_grupo_id: 3, resultado_activo: true, resultado_requiere_fecha: 0, ...extra });

describe('pideFechaPap', () => {
  it('VOLVER siempre pide fecha, aunque el catálogo diga 0 o esté vacío', () => {
    expect(pideFechaPap([res('VOLVER')], 'VOLVER')).toBe(true);
    expect(pideFechaPap([], 'VOLVER')).toBe(true);
    expect(pideFechaPap(null, 'VOLVER')).toBe(true);
  });
  it('los demás dependen del catálogo (1 o true)', () => {
    expect(pideFechaPap([res('INTERESADO', { resultado_requiere_fecha: 1 })], 'INTERESADO')).toBe(true);
    expect(pideFechaPap([res('INTERESADO', { resultado_requiere_fecha: true })], 'INTERESADO')).toBe(true);
    expect(pideFechaPap([res('INTERESADO', { resultado_requiere_fecha: 0 })], 'INTERESADO')).toBe(false);
  });
  it('ignora el mismo código de otro grupo o inactivo', () => {
    expect(pideFechaPap([res('INTERESADO', { resultado_requiere_fecha: 1, resultado_grupo_id: 1 })], 'INTERESADO')).toBe(false);
    expect(pideFechaPap([res('INTERESADO', { resultado_requiere_fecha: 1, resultado_activo: false })], 'INTERESADO')).toBe(false);
  });
  it('sin catálogo ni código conocido no pide', () => {
    expect(pideFechaPap(null, 'INTERESADO')).toBe(false);
    expect(pideFechaPap([res('VOLVER')], 'OTRO')).toBe(false);
  });
});
