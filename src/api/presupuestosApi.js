import api from './axios';

export const presupuestosApi = {
  obtener:   (params)   => api.get('/presupuestos', { params }).then(r => r.data),
  // Devuelve la respuesta completa: el nombre del archivo viene en Content-Disposition.
  plantilla: (params)   => api.get('/presupuestos/plantilla', { params, responseType: 'blob' }),
  revisar:   (formData) => api.post('/presupuestos/revisar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
  guardar:   (payload)  => api.post('/presupuestos', payload).then(r => r.data)
};
