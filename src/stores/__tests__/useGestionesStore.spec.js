import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/api/gestionesApi', () => ({ gestionesApi: { create: vi.fn(), historial: vi.fn() } }));

import { gestionesApi } from '@/api/gestionesApi';
import { useGestionesStore } from '@/stores/useGestionesStore';

const GESTION = { gest_id: 77, gest_prosp_id: 900 };
const PAGINA = { items: [GESTION], page: 1, total: 1, hasMore: false };

describe('useGestionesStore.registrar', () => {
  let store;
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    store = useGestionesStore();
  });

  it('guarda y recarga el historial del cliente', async () => {
    gestionesApi.create.mockResolvedValue({ data: GESTION });
    gestionesApi.historial.mockResolvedValue({ data: PAGINA });
    expect(await store.registrar({ gest_prosp_id: 900 })).toEqual(GESTION);
    expect(store.historial.get(900)).toEqual({ ...PAGINA, loading: false });
  });

  it('si el historial falla, la gestión ya guardada no se da por fallida', async () => {
    gestionesApi.create.mockResolvedValue({ data: GESTION });
    gestionesApi.historial.mockRejectedValue(new Error('sin red'));
    await expect(store.registrar({ gest_prosp_id: 900 })).resolves.toEqual(GESTION);
    expect(store.historial.has(900)).toBe(false);
  });

  it('solo quita el historial de ese cliente, y al pedirlo de nuevo carga', async () => {
    gestionesApi.create.mockResolvedValue({ data: GESTION });
    gestionesApi.historial.mockResolvedValueOnce({ data: PAGINA }).mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({ data: PAGINA });
    await store.fetchHistorial(901, { reset: true });
    await store.registrar({ gest_prosp_id: 900 });
    expect([...store.historial.keys()]).toEqual([901]);
    await store.fetchHistorial(900);
    expect(store.historial.get(900)).toEqual({ ...PAGINA, loading: false });
  });

  it('si no se guarda, rechaza y no toca el historial', async () => {
    gestionesApi.create.mockRejectedValue(new Error('no se guardó'));
    await expect(store.registrar({ gest_prosp_id: 900 })).rejects.toThrow('no se guardó');
    expect(gestionesApi.historial).not.toHaveBeenCalled();
    expect(store.historial.size).toBe(0);
  });
});
