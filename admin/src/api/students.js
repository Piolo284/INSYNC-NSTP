import { api } from './client';

export const studentsApi = {
  list: (params) => api.get('/students', params),
  get: (id) => api.get(`/students/${id}`),
  create: (payload) => api.post('/students', payload),
  update: (id, payload) => api.put(`/students/${id}`, payload),
  atRisk: (params) => api.get('/students/at-risk', params),
  dashboard: (id) => api.get(`/students/${id}/dashboard`),
  attendance: (id, params) => api.get(`/students/${id}/attendance`, params),
  submissions: (id) => api.get(`/students/${id}/submissions`),
  grades: (id) => api.get(`/students/${id}/grades`),
};
