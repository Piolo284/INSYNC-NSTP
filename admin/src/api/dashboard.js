import { api } from './client';

export const dashboardApi = {
  admin: (params) => api.get('/dashboard/admin', params),
};
