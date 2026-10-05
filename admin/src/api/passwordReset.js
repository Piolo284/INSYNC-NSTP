import { api } from './client';

export const passwordResetApi = {
  list: (params) => api.get('/password-reset-requests', params),
  approve: (id, reviewNote) => api.post(`/password-reset-requests/${id}/approve`, { reviewNote }),
  reject: (id, reviewNote) => api.post(`/password-reset-requests/${id}/reject`, { reviewNote }),
};
