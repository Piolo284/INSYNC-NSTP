import { api } from './client';

export const adminAccountsApi = {
  list: () => api.get('/admin-accounts'),
  // confirmReplace: true deactivates the position's current holder.
  create: (body) => api.post('/admin-accounts', body),
};
