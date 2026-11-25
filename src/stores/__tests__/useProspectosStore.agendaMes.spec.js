import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { agendaMes: vi.fn() } }));

import { prospectosApi } from '@/api/prospectosApi';
import { useProspectosStore } from '@/stores/useProspectosStore';

describe('useProspectosStore.fetchAgendaMes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    prospectosApi.agendaMes.mockResolvedValue({ data: [{ total: 1 }] });
  });

  it('pasa los filtros al api y guarda el mes', async () => {
    const store = useProspectosStore();
    await store.fetchAgendaMes(2026, 11, { area_id: 4 });
    expect(prospectosApi.agendaMes).toHaveBeenCalledWith(2026, 11, { area_id: 4 });
    expect(store.agendaMes).toEqual([{ total: 1 }]);
  });

  it('sin filtros manda un objeto vacío', async () => {
    await useProspectosStore().fetchAgendaMes(2026, 11);
    expect(prospectosApi.agendaMes).toHaveBeenCalledWith(2026, 11, {});
  });
});
