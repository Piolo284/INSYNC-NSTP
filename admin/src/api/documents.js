import { api } from './client';

export const documentsApi = {
  listMine: (params) => api.get('/documents', params),
  listForUser: (userId) => api.get(`/documents/user/${userId}`),
  review: (id, status) => api.put(`/documents/${id}`, { status }),
  remove: (id) => api.delete(`/documents/${id}`),
};
