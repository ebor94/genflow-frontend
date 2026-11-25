import { describe, it, expect } from 'vitest';
import router from '@/router';

describe('ruta del presupuesto', () => {
  it('/prenec/presupuesto es de Prenecesidad y exige sesión', () => {
    const r = router.getRoutes().find((x) => x.name === 'prenec-presupuesto');
    expect(r.path).toBe('/prenec/presupuesto');
    expect(r.meta.areaCodigo).toBe('PRENEC');
    expect(r.meta.requiereAuth).toBe(true);
    expect(r.meta.nivelMaximo).toBeUndefined();
  });
});
