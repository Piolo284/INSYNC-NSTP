import { api } from './client';

export const notificationsApi = {
  listMine: (params) => api.get('/notifications', params),
  markAllRead: () => api.put('/notifications/read-all', {}),
  markRead: (id) => api.put(`/notifications/${id}/read`, {}),
  remove: (id) => api.delete(`/notifications/${id}`),
  create: (payload) => api.post('/notifications', payload),
};
