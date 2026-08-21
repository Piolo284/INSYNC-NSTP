import { api } from './client';

export const announcementsApi = {
  list: (params) => api.get('/announcements', params),
  get: (id) => api.get(`/announcements/${id}`),
  create: (payload) => api.post('/announcements', payload),
  update: (id, payload) => api.put(`/announcements/${id}`, payload),
  remove: (id) => api.delete(`/announcements/${id}`),
  send: (id, payload) => api.post(`/announcements/${id}/send`, payload || {}),
};
