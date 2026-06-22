/**
 * api/categorizacionApi.js
 * Categorías (tipos) de empresa + grupos empresariales (Grupo Éxito, etc.).
 * Migración 017.
 */
import api from './axios';

export const tiposEmpresaApi = {
  list:   (params = {}) => api.get('/tipos-empresa',     { params }).then(r => r.data),
  create: (data)        => api.post('/tipos-empresa',    data).then(r => r.data),
  update: (id, data)    => api.put(`/tipos-empresa/${id}`, data).then(r => r.data)
};

export const gruposEmpresarialesApi = {
  list:    (params = {})              => api.get('/grupos-empresariales',  { params }).then(r => r.data),
  // findOrCreate: si el nombre existe (case-insensitive) devuelve creado:false con el existente
  findOrCreate: (nombre, descripcion = null) =>
    api.post('/grupos-empresariales', { nombre, descripcion }).then(r => r.data),
  update:  (id, data)                 => api.put(`/grupos-empresariales/${id}`, data).then(r => r.data)
};
