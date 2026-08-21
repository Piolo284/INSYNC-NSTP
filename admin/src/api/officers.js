import { api } from './client';

export const officersApi = {
  list: (params) => api.get('/officers', params),
  get: (id) => api.get(`/officers/${id}`),
  create: (payload) => api.post('/officers', payload),
  update: (id, payload) => api.put(`/officers/${id}`, payload),
  remove: (id) => api.delete(`/officers/${id}`),
};
