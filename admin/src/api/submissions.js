import { api } from './client';

export const submissionsApi = {
  list: (params) => api.get('/submissions', params),
  get: (id) => api.get(`/submissions/${id}`),
  update: (id, payload) => api.put(`/submissions/${id}`, payload),
  grade: (id, payload) => api.post(`/submissions/${id}/grade`, payload),
  remove: (id) => api.delete(`/submissions/${id}`),
};
