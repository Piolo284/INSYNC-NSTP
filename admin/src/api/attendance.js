import { api } from './client';

export const attendanceApi = {
  createSession: (payload) => api.post('/attendance/sessions', payload),
  listSessions: (params) => api.get('/attendance/sessions', params),
  getSession: (id) => api.get(`/attendance/sessions/${id}`),
  closeSession: (id) => api.put(`/attendance/sessions/${id}/close`, {}),
  list: (params) => api.get('/attendance', params),
  create: (payload) => api.post('/attendance', payload),
  update: (id, payload) => api.put(`/attendance/${id}`, payload),
  remove: (id) => api.delete(`/attendance/${id}`),
  summary: (params) => api.get('/attendance/summary', params),
};
