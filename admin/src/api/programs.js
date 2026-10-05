import { api } from './client';

export const programsApi = {
  list: (params) => api.get('/programs', params),
  get: (id) => api.get(`/programs/${id}`),
  create: (payload) => api.post('/programs', payload),
  update: (id, payload) => api.put(`/programs/${id}`, payload),
  remove: (id) => api.delete(`/programs/${id}`),
};

export const brigadesApi = {
  list: (params) => api.get('/brigades', params),
  get: (id) => api.get(`/brigades/${id}`),
  update: (id, payload) => api.put(`/brigades/${id}`, payload),
};
