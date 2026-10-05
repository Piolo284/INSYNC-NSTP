import { api } from './client';

export const accountActivityApi = {
  list: (params) => api.get('/account-activity', params),
};
