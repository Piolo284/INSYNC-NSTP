import { api } from './client';

export const officersApi = {
  list: (params) => api.get('/officers', params),
  get: (id) => api.get(`/officers/${id}`),
  create: (payload) => api.post('/officers', payload),
  promote: (payload) => api.post('/officers/promote', payload),
  update: (id, payload) => api.put(`/officers/${id}`, payload),
  remove: (id) => api.delete(`/officers/${id}`),
  // ROTC Special Class track — assigning a new officer auto-clears whoever held it before.
  specialClassOfficer: () => api.get('/officers/special-class'),
  assignSpecialClass: (id, isSpecialClassOfficer) =>
    api.put(`/officers/${id}/special-class`, { isSpecialClassOfficer }),
};
