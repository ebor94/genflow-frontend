import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }));

import api from '@/api/axios';
import { prospectosApi } from '@/api/prospectosApi';

describe('prospectosApi.agendaMes', () => {
  beforeEach(() => { vi.resetAllMocks(); api.get.mockResolvedValue({ data: { data: [] } }); });

  it('manda año y mes', async () => {
    await prospectosApi.agendaMes(2026, 11);
    expect(api.get).toHaveBeenCalledWith('/prospectos/agenda-mes', { params: { anio: 2026, mes: 11 } });
  });

  it('suma los filtros extra, como el área', async () => {
    await prospectosApi.agendaMes(2026, 11, { area_id: 4 });
    expect(api.get).toHaveBeenCalledWith('/prospectos/agenda-mes', { params: { anio: 2026, mes: 11, area_id: 4 } });
  });
});
