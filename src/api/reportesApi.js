import api from './axios';

export const reportesApi = {
  dashboard: (params = {}) => api.get('/reportes/dashboard', { params }).then(r => r.data),
  /**
   * Reporte del equipo. Acepta:
   *  - reportesApi.equipo(grupoId, { desde, hasta })       // rango
   *  - reportesApi.equipo(grupoId, '2026-05-25')           // un solo día (legacy)
   *  - reportesApi.equipo(grupoId, { fecha: '2026-05-25' })// también admitido
   */
  equipo: (grupoId, opts = {}) => {
    let params = { grupo_id: grupoId };
    if (typeof opts === 'string') params.fecha = opts;
    else params = { ...params, ...opts };
    return api.get('/reportes/equipo', { params }).then(r => r.data);
  },
  asesor:    (id, params = {}) => api.get(`/reportes/asesor/${id}`, { params }).then(r => r.data)
};
