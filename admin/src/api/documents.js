import { api } from './client';

export const documentsApi = {
  listMine: (params) => api.get('/documents', params),
  listForUser: (userId) => api.get(`/documents/user/${userId}`),
  listForReview: (params) => api.get('/documents/review', params),
  review: (id, status) => api.put(`/documents/${id}`, { status }),
  remove: (id) => api.delete(`/documents/${id}`),
};
