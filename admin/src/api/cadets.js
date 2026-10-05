import { api } from './client';

export const cadetsApi = {
  list: (params) => api.get('/cadets', params),
  get: (id) => api.get(`/cadets/${id}`),
  create: (payload) => api.post('/cadets', payload),
  update: (id, payload) => api.put(`/cadets/${id}`, payload),
  specialClassRoster: () => api.get('/cadets/special-class'),
  dashboard: (id) => api.get(`/cadets/${id}/dashboard`),
  attendance: (id, params) => api.get(`/cadets/${id}/attendance`, params),
  grades: (id) => api.get(`/cadets/${id}/grades`),
};
