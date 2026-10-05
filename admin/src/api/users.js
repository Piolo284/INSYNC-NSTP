import { api } from './client';

export const usersApi = {
  list: (params) => api.get('/users', params),
  get: (id) => api.get(`/users/${id}`),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.put(`/users/${id}`, payload),
  remove: (id) => api.delete(`/users/${id}`),
  statsOverview: () => api.get('/users/stats/overview'),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.put('/users/me/avatar', fd, { isMultipart: true });
  },
};
