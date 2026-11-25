import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '@/api/axios';
import { presupuestosApi } from '@/api/presupuestosApi';

describe('presupuestosApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('obtener: GET /presupuestos con params y devuelve el cuerpo', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { x: 1 } } });
    const r = await presupuestosApi.obtener({ area_id: 7, anio: 2026, mes: 11 });
    expect(api.get).toHaveBeenCalledWith('/presupuestos', { params: { area_id: 7, anio: 2026, mes: 11 } });
    expect(r).toEqual({ success: true, data: { x: 1 } });
  });
  it('plantilla: blob y respuesta completa (trae las cabeceras)', async () => {
    const resp = { data: new Blob(['x']), headers: { 'content-disposition': 'a' } };
    api.get.mockResolvedValue(resp);
    const r = await presupuestosApi.plantilla({ area_id: 7, anio: 2026, mes: 11 });
    expect(api.get).toHaveBeenCalledWith('/presupuestos/plantilla', { params: { area_id: 7, anio: 2026, mes: 11 }, responseType: 'blob' });
    expect(r).toBe(resp);
  });
  it('revisar: POST multipart a /presupuestos/revisar y devuelve el cuerpo', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { filas: [] } } });
    const fd = new FormData();
    const r = await presupuestosApi.revisar(fd);
    expect(api.post).toHaveBeenCalledWith('/presupuestos/revisar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    expect(r).toEqual({ success: true, data: { filas: [] } });
  });
  it('guardar: POST /presupuestos y devuelve el cuerpo', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const payload = { area_id: 7, anio: 2026, mes: 11, filas: [] };
    const r = await presupuestosApi.guardar(payload);
    expect(api.post).toHaveBeenCalledWith('/presupuestos', payload);
    expect(r).toEqual({ success: true });
  });
});
