import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '@/api/axios';
import { salasApi } from '@/api/salasApi';

describe('salasApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listar', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    expect(await salasApi.listar()).toEqual({ success: true, data: [] });
    expect(api.get).toHaveBeenCalledWith('/salas/homenajes');
  });

  it('obtener', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { id: 56 } } });
    await salasApi.obtener(56);
    expect(api.get).toHaveBeenCalledWith('/salas/homenajes/56');
  });

  it('atender envía los datos o un objeto vacío', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: {} } });
    await salasApi.atender(55);
    expect(api.post).toHaveBeenCalledWith('/salas/homenajes/55/atender', {});
    await salasApi.atender(55, { telefono: '3001234567' });
    expect(api.post).toHaveBeenLastCalledWith('/salas/homenajes/55/atender', { telefono: '3001234567' });
  });

  it('registrarVisita', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { gest_id: 1 } } });
    await salasApi.registrarVisita(57, { gest_resultado_id: 3 });
    expect(api.post).toHaveBeenCalledWith('/salas/homenajes/57/visitas', { gest_resultado_id: 3 });
  });
});
