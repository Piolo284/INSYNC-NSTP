import { api } from './client';

export const authApi = {
  login: (identifier, password) => api.post('/auth/login', { identifier, password }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/password', { currentPassword, newPassword }),
};
